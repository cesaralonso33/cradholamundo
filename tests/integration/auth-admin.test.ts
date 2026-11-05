import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client, Pool } from 'pg';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const baseUrl = process.env.DATABASE_URL;
let databaseName = '';
let isolatedUrl = '';
let client: Client;
let pool: Pool;
let app: ReturnType<typeof Fastify>;
let routes: { authRoutes: (app: ReturnType<typeof Fastify>) => Promise<void>; userRoutes: (app: ReturnType<typeof Fastify>) => Promise<void>; roleRoutes: (app: ReturnType<typeof Fastify>) => Promise<void> };
let routePool: Pool | undefined;

beforeAll(async () => {
  if (!baseUrl) throw new Error('DATABASE_URL is required; tests need a PostgreSQL admin URL to create a disposable database.');
  databaseName = `auth_integration_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query(`CREATE DATABASE "${databaseName}"`); } finally { await admin.end(); }
  const url = new URL(baseUrl); url.pathname = `/${databaseName}`; url.searchParams.delete('schema'); isolatedUrl = url.toString();
  execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: isolatedUrl }, stdio: 'pipe' });
  process.env.DATABASE_URL = isolatedUrl; process.env.JWT_SECRET = 'integration-test-jwt-secret-32chars';
  pool = new Pool({ connectionString: isolatedUrl }); client = new Client({ connectionString: isolatedUrl }); await client.connect();
  routes = { authRoutes: (await import('../../src/routes/auth.js')).authRoutes, userRoutes: (await import('../../src/routes/users.js')).userRoutes, roleRoutes: (await import('../../src/routes/roles.js')).roleRoutes };
  routePool = (await import('../../src/db/client.js')).pool;
  app = Fastify(); await app.register(cookie, { secret: process.env.JWT_SECRET }); await app.register(rateLimit, { global: false });
  await app.register(routes.authRoutes); await app.register(routes.userRoutes); await app.register(routes.roleRoutes); await app.ready();
  await client.query(`INSERT INTO "Role" (id,name,description,permissions,updated_at) VALUES ('role-admin','admin','Admin',ARRAY['users','roles'],now()),('role-user','user','User',ARRAY[]::text[],now())`);
  await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('admin1','admin', $1,'admin',now()),('admin2','admin2',$1,'admin',now()),('user1','user1',$1,'user',now())`, [await bcrypt.hash('Pass12345', 10)]);
}, 60000);

afterAll(async () => {
  await app?.close(); await client?.end(); await pool?.end(); await routePool?.end();
  if (!baseUrl || !databaseName) return;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]); await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`); } finally { await admin.end(); }
});

describe('auth/admin routes backed by isolated PostgreSQL', () => {
  it('authenticates a user, sets the compatible cookie, and returns permissions', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'Pass12345' } });
    expect(response.statusCode).toBe(200); expect(response.json().user).toMatchObject({ username: 'admin', role: 'admin', permissions: expect.arrayContaining(['users']) });
    expect(response.headers['set-cookie']).toContain('token=');
    expect((await client.query(`SELECT action FROM "AuditLog" WHERE action='login.success'`)).rowCount).toBe(1);
  });

  it('prevents demoting the last administrator but permits demotion when another remains', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin', password: 'Pass12345' } });
    const token = login.json().token;
    await client.query(`DELETE FROM "User" WHERE id='admin2'`);
    const forbiddenLast = await app.inject({ method: 'PUT', url: '/api/users/admin1', headers: { authorization: `Bearer ${token}` }, payload: { role: 'user' } });
    expect(forbiddenLast.statusCode).toBe(400); expect(forbiddenLast.json()).toEqual({ error: 'cannot demote the last admin' });
    await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('admin2','admin2',$1,'admin',now())`, [await bcrypt.hash('Pass12345', 10)]);
    const permitted = await app.inject({ method: 'PUT', url: '/api/users/admin1', headers: { authorization: `Bearer ${token}` }, payload: { role: 'user' } });
    expect(permitted.statusCode).toBe(200); expect(permitted.json().role).toBe('user');
  });

  it('rejects duplicate roles with the original conflict response', async () => {
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'admin2', password: 'Pass12345' } });
    const response = await app.inject({ method: 'POST', url: '/api/roles', headers: { authorization: `Bearer ${login.json().token}` }, payload: { name: 'user' } });
    expect(response.statusCode).toBe(409); expect(response.json()).toEqual({ error: 'role already exists' });
  });
});
