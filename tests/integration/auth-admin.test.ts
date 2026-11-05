import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client, Pool } from 'pg';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcryptjs';
import { generateSync } from 'otplib';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const baseUrl = process.env.DATABASE_URL;
let databaseName = '';
let isolatedUrl = '';
let client: Client;
let pool: Pool;
let app: ReturnType<typeof Fastify>;
let routes: { authRoutes: (app: ReturnType<typeof Fastify>) => Promise<void>; userRoutes: (app: ReturnType<typeof Fastify>) => Promise<void>; roleRoutes: (app: ReturnType<typeof Fastify>) => Promise<void> };
let routePool: Pool | undefined;
let loginSequence = 20;
const loginAs = (username: string) => app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: `10.20.0.${loginSequence++}`, payload: { username, password: 'Pass12345' } });

beforeAll(async () => {
  if (!baseUrl) throw new Error('DATABASE_URL is required; tests need a PostgreSQL admin URL to create a disposable database.');
  databaseName = `auth_integration_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query(`CREATE DATABASE "${databaseName}"`); } finally { await admin.end(); }
  const url = new URL(baseUrl); url.pathname = `/${databaseName}`; url.searchParams.delete('schema'); isolatedUrl = url.toString();
  execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: isolatedUrl }, stdio: 'pipe' });
  process.env.DATABASE_URL = isolatedUrl; process.env.JWT_SECRET = 'integration-test-jwt-secret-32chars';
  process.env.LOGIN_MAX_FAILURES = '2';
  pool = new Pool({ connectionString: isolatedUrl }); client = new Client({ connectionString: isolatedUrl }); await client.connect();
  routes = { authRoutes: (await import('../../src/routes/auth.js')).authRoutes, userRoutes: (await import('../../src/routes/users.js')).userRoutes, roleRoutes: (await import('../../src/routes/roles.js')).roleRoutes };
  routePool = (await import('../../src/db/client.js')).pool;
  app = Fastify(); await app.register(cookie, { secret: process.env.JWT_SECRET }); await app.register(rateLimit, { global: false });
  await app.register(routes.authRoutes); await app.register(routes.userRoutes); await app.register(routes.roleRoutes); await app.ready();
  await client.query(`INSERT INTO "Role" (id,name,description,permissions,updated_at) VALUES ('role-admin','admin','Admin',ARRAY['users','roles'],now()),('role-user','user','User',ARRAY[]::text[],now())`);
  await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('admin1','admin', $1,'admin',now()),('admin2','admin2',$1,'admin',now()),('user1','user1',$1,'user',now())`, [await bcrypt.hash('Pass12345', 10)]);
}, 60000);

beforeEach(async () => {
  await client.query('TRUNCATE TABLE "PapeleriaOrder", "AuditLog", "User", "Role", "LoginAttempt", "Setting" CASCADE');
  await client.query(`INSERT INTO "Role" (id,name,description,permissions,updated_at) VALUES ('role-admin','admin','Admin',ARRAY['users','roles'],now()),('role-user','user','User',ARRAY[]::text[],now())`);
  await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('admin1','admin', $1,'admin',now()),('admin2','admin2',$1,'admin',now()),('user1','user1',$1,'user',now())`, [await bcrypt.hash('Pass12345', 10)]);
});

afterAll(async () => {
  await app?.close(); await client?.end(); await pool?.end(); await routePool?.end();
  if (!baseUrl || !databaseName) return;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]); await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`); } finally { await admin.end(); }
});

describe('auth/admin routes backed by isolated PostgreSQL', () => {
  it('authenticates a user, sets the compatible cookie, and returns permissions', async () => {
    const response = await loginAs('admin');
    expect(response.statusCode).toBe(200); expect(response.json().user).toMatchObject({ username: 'admin', role: 'admin', permissions: expect.arrayContaining(['users']) });
    expect(response.headers['set-cookie']).toContain('token=');
    expect((await client.query(`SELECT action FROM "AuditLog" WHERE action='login.success'`)).rowCount).toBe(1);
  });

  it('serializes concurrent demotions so an administrator always remains', async () => {
    const [login1, login2] = await Promise.all([
      loginAs('admin'), loginAs('admin2'),
    ]);
    const [first, second] = await Promise.all([
      app.inject({ method: 'PUT', url: '/api/users/admin1', headers: { authorization: `Bearer ${login1.json().token}` }, payload: { role: 'user' } }),
      app.inject({ method: 'PUT', url: '/api/users/admin2', headers: { authorization: `Bearer ${login2.json().token}` }, payload: { role: 'user' } }),
    ]);
    expect([first.statusCode, second.statusCode].filter((status) => status === 400)).toHaveLength(1);
    expect(Number((await client.query(`SELECT count(*)::int AS count FROM "User" WHERE role='admin'`)).rows[0].count)).toBeGreaterThanOrEqual(1);
    await client.query(`UPDATE "User" SET role='admin' WHERE id IN ('admin1','admin2')`);
  });

  it('serializes concurrent administrator deletions so one request is rejected', async () => {
    const [login1, login2] = await Promise.all([loginAs('admin'), loginAs('admin2')]);
    const [deleteAdmin2, deleteAdmin1] = await Promise.all([
      app.inject({ method: 'DELETE', url: '/api/users/admin2', headers: { authorization: `Bearer ${login1.json().token}` } }),
      app.inject({ method: 'DELETE', url: '/api/users/admin1', headers: { authorization: `Bearer ${login2.json().token}` } }),
    ]);
    expect([deleteAdmin1.statusCode, deleteAdmin2.statusCode].sort()).toEqual([200, 400]);
    expect(Number((await client.query(`SELECT count(*)::int AS count FROM "User" WHERE role='admin'`)).rows[0].count)).toBe(1);
  });

  it('completes enrollment, verifies TOTP, and completes the required 2FA login', async () => {
    const login = await loginAs('admin');
    const token = login.json().token;
    const setup = await app.inject({ method: 'POST', url: '/api/auth/2fa/setup', headers: { authorization: `Bearer ${token}` } });
    expect(setup.statusCode).toBe(200);
    const enabled = await app.inject({ method: 'POST', url: '/api/auth/2fa/verify', headers: { authorization: `Bearer ${token}` }, payload: { code: generateSync({ secret: setup.json().secret }) } });
    expect(enabled.statusCode).toBe(200);
    const challenge = await loginAs('admin');
    expect(challenge.json().requires2fa).toBe(true);
    const completed = await app.inject({ method: 'POST', url: '/api/auth/2fa/complete', payload: { tempToken: challenge.json().tempToken, code: generateSync({ secret: setup.json().secret }) } });
    expect(completed.statusCode).toBe(200); expect(completed.headers['set-cookie']).toContain('token=');
  });

  it('blocks repeated login failures and returns Retry-After', async () => {
    const first = await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: '10.1.1.10', payload: { username: 'blocked-user', password: 'bad' } });
    expect(first.statusCode).toBe(401);
    const second = await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: '10.1.1.10', payload: { username: 'blocked-user', password: 'bad' } });
    expect(second.statusCode).toBe(429); expect(second.headers['retry-after']).toBe('900');
    const blocked = await app.inject({ method: 'POST', url: '/api/auth/login', remoteAddress: '10.1.1.10', payload: { username: 'blocked-user', password: 'Pass12345' } });
    expect(blocked.statusCode).toBe(429); expect(Number(blocked.json().retry_after_seconds)).toBeGreaterThan(0);
  });

  it('authenticates the configured API key and enforces role permissions', async () => {
    const key = 'integration-api-key';
    await client.query(`INSERT INTO "Setting" (key,value) VALUES ('api_enabled','true'),('api_key_hash',$1)`, [createHash('sha256').update(key).digest('hex')]);
    const viaKey = await app.inject({ method: 'GET', url: '/api/users', headers: { 'x-api-key': key } });
    expect(viaKey.statusCode).toBe(200);
    const userLogin = await loginAs('user1');
    const denied = await app.inject({ method: 'GET', url: '/api/users', headers: { authorization: `Bearer ${userLogin.json().token}` } });
    expect(denied.statusCode).toBe(403); expect(denied.json()).toEqual({ error: 'forbidden' });
  });

  it('preserves username uniqueness and foreign-key delete response', async () => {
    const login = await loginAs('admin');
    const duplicate = await app.inject({ method: 'POST', url: '/api/auth/register', headers: { authorization: `Bearer ${login.json().token}` }, payload: { username: 'user1', password: 'Pass12345' } });
    expect(duplicate.statusCode).toBe(409); expect(duplicate.json()).toEqual({ error: 'username already exists' });
    await client.query(`INSERT INTO "PapeleriaOrder" (id,folio,user_id,updated_at) VALUES ('fk-order','fk-order','user1',now())`);
    const deleted = await app.inject({ method: 'DELETE', url: '/api/users/user1', headers: { authorization: `Bearer ${login.json().token}` } });
    expect(deleted.statusCode).toBe(400); expect(deleted.json()).toEqual({ error: 'user has related records (orders); cannot delete' });
  });

  it('returns a centralized 500 for an unexpected deletion error', async () => {
    const login = await loginAs('admin');
    await client.query(`CREATE FUNCTION fail_user_deletion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic unexpected failure'; END $$; CREATE TRIGGER fail_user_deletion BEFORE DELETE ON "User" FOR EACH ROW WHEN (OLD.id='user1') EXECUTE FUNCTION fail_user_deletion()`);
    const response = await app.inject({ method: 'DELETE', url: '/api/users/user1', headers: { authorization: `Bearer ${login.json().token}` } });
    expect(response.statusCode).toBe(500); expect(response.json()).toEqual({ error: 'internal server error' });
    await client.query(`DROP TRIGGER fail_user_deletion ON "User"; DROP FUNCTION fail_user_deletion()`);
  });

  it('prevents demoting the last administrator but permits demotion when another remains', async () => {
    const login = await loginAs('admin');
    const token = login.json().token;
    await client.query(`DELETE FROM "User" WHERE id='admin2'`);
    const forbiddenLast = await app.inject({ method: 'PUT', url: '/api/users/admin1', headers: { authorization: `Bearer ${token}` }, payload: { role: 'user' } });
    expect(forbiddenLast.statusCode).toBe(400); expect(forbiddenLast.json()).toEqual({ error: 'cannot demote the last admin' });
    await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('admin2','admin2',$1,'admin',now())`, [await bcrypt.hash('Pass12345', 10)]);
    const permitted = await app.inject({ method: 'PUT', url: '/api/users/admin1', headers: { authorization: `Bearer ${token}` }, payload: { role: 'user' } });
    expect(permitted.statusCode).toBe(200); expect(permitted.json().role).toBe('user');
  });

  it('rejects duplicate roles with the original conflict response', async () => {
    const login = await loginAs('admin2');
    const response = await app.inject({ method: 'POST', url: '/api/roles', headers: { authorization: `Bearer ${login.json().token}` }, payload: { name: 'user' } });
    expect(response.statusCode).toBe(409); expect(response.json()).toEqual({ error: 'role already exists' });
  });
});
