import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client, Pool } from 'pg';
import Fastify from 'fastify';

const baseUrl = process.env.DATABASE_URL;
let databaseName = '';
let client: Client;
let app: ReturnType<typeof Fastify>;
let pool: Pool;
let routePool: Pool;
let adminToken: string;
let userToken: string;

beforeAll(async () => {
  if (!baseUrl) throw new Error('DATABASE_URL must point to a local PostgreSQL admin database.');
  databaseName = `backup_http_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query(`CREATE DATABASE "${databaseName}"`); } finally { await admin.end(); }
  const url = new URL(baseUrl); url.pathname = `/${databaseName}`; url.searchParams.delete('schema');
  process.env.DATABASE_URL = url.toString();
  process.env.JWT_SECRET = 'backup-test-secret-that-is-long-enough';
  execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], { cwd: process.cwd(), env: process.env, stdio: 'pipe' });
  const [{ backupRoutes }, auth, db] = await Promise.all([import('../../src/routes/backup.js'), import('../../src/lib/auth.js'), import('../../src/db/client.js')]);
  client = new Client({ connectionString: url.toString() }); await client.connect();
  pool = new Pool({ connectionString: url.toString() }); routePool = db.pool;
  app = Fastify(); await app.register(backupRoutes); await app.ready();
  adminToken = auth.signToken({ id: 'backup-admin', username: 'backup-admin', role: 'admin' });
  userToken = auth.signToken({ id: 'backup-user', username: 'backup-user', role: 'user' });
}, 60000);

beforeEach(async () => {
  await client.query('TRUNCATE TABLE "AuditLog", "PapeleriaOrder", "User", "Setting" CASCADE');
  await client.query(`INSERT INTO "User" (id,username,password,totp_secret,role,updated_at) VALUES ('backup-admin','backup-admin','admin-hash','admin-totp','admin',now()),('backup-user','backup-user','user-hash','user-totp','user',now())`);
});

afterAll(async () => {
  await app?.close(); await client?.end(); await pool?.end(); await routePool?.end();
  if (!baseUrl || !databaseName) return;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]); await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`); } finally { await admin.end(); }
});

const request = (method: string, url: string, payload?: unknown, token = adminToken) => app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as object | undefined });

describe('backup security over isolated PostgreSQL', () => {
  it('exports no password or TOTP unless includeSensitive=true is explicit', async () => {
    const safe = await request('GET', '/api/backup');
    expect(safe.statusCode).toBe(200);
    expect(safe.json().data.users[0]).not.toHaveProperty('password');
    expect(safe.json().data.users[0]).not.toHaveProperty('totp_secret');
    const sensitive = await request('GET', '/api/backup?includeSensitive=true');
    expect(sensitive.json().data.users).toContainEqual(expect.objectContaining({ password: 'admin-hash', totp_secret: 'admin-totp' }));
    const events = await client.query(`SELECT action,details FROM "AuditLog" WHERE action='backup.exported' ORDER BY details`);
    expect(events.rows).toHaveLength(2);
    expect(events.rows.map(row => row.details)).toContain('{"includeSensitive":false}');
    expect(events.rows.map(row => row.details)).toContain('{"includeSensitive":true}');
    expect(JSON.stringify(events.rows)).not.toContain('admin-hash');
    expect(JSON.stringify(events.rows)).not.toContain('admin-totp');
  });

  it('restores an explicit sensitive backup and denies non-admin access', async () => {
    const exported = await request('GET', '/api/backup?includeSensitive=true');
    await client.query(`UPDATE "User" SET username='changed' WHERE id='backup-admin'`);
    const restored = await request('POST', '/api/backup/restore', exported.json());
    expect(restored.statusCode).toBe(200);
    expect((await client.query(`SELECT username,password,totp_secret FROM "User" WHERE id='backup-admin'`)).rows[0]).toEqual({ username: 'backup-admin', password: 'admin-hash', totp_secret: 'admin-totp' });
    expect(Number((await client.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action='backup.restored'`)).rows[0].count)).toBe(1);
    expect((await request('GET', '/api/backup', undefined, userToken)).statusCode).toBe(403);
    expect((await request('POST', '/api/backup/restore', exported.json(), userToken)).statusCode).toBe(403);
  });

  it('rejects safe and malformed backups without changing existing rows', async () => {
    const safe = (await request('GET', '/api/backup')).json();
    const safeRestore = await request('POST', '/api/backup/restore', safe);
    expect(safeRestore.statusCode).toBe(400);
    expect(safeRestore.json()).toEqual({ error: 'backup excludes password and TOTP; export with includeSensitive=true to restore' });
    expect((await client.query(`SELECT username FROM "User" WHERE id='backup-admin'`)).rows[0].username).toBe('backup-admin');

    const full = (await request('GET', '/api/backup?includeSensitive=true')).json();
    full.data.products = [{ id: 'bad', sku: 'rollback', name: 'bad', quantity: 'not-an-integer' }];
    const invalid = await request('POST', '/api/backup/restore', full);
    expect(invalid.statusCode).toBe(400);
    expect((await client.query(`SELECT username FROM "User" WHERE id='backup-admin'`)).rows[0].username).toBe('backup-admin');
    expect((await client.query(`SELECT count(*)::int AS count FROM "Product"`)).rows[0].count).toBe(0);
  });

  it('rolls back restore and withholds export when the audit insert fails', async () => {
    const exported = (await request('GET', '/api/backup?includeSensitive=true')).json();
    await client.query(`UPDATE "User" SET username='changed' WHERE id='backup-admin'`);
    await client.query(`INSERT INTO "Product" (id,sku,name,quantity,min_stock,updated_at) VALUES ('keep-product','KEEP','Keep on rollback',3,0,now())`);
    await client.query(`CREATE FUNCTION reject_backup_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('backup.exported','backup.restored') THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_backup_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_backup_audit()`);
    try {
      const restore = await request('POST', '/api/backup/restore', exported);
      expect(restore.statusCode).toBe(500);
      expect((await client.query(`SELECT username FROM "User" WHERE id='backup-admin'`)).rows[0].username).toBe('changed');
      expect((await client.query(`SELECT sku FROM "Product"`)).rows.map(row => row.sku)).toEqual(['KEEP']);
      const exportResponse = await request('GET', '/api/backup?includeSensitive=true');
      expect(exportResponse.statusCode).toBe(500);
      expect(exportResponse.body).not.toContain('admin-hash');
      expect(exportResponse.body).not.toContain('admin-totp');
      expect(Number((await client.query(`SELECT count(*)::int AS count FROM "AuditLog" WHERE action IN ('backup.exported','backup.restored')`)).rows[0].count)).toBe(1);
    } finally {
      await client.query('DROP TRIGGER IF EXISTS reject_backup_audit ON "AuditLog"; DROP FUNCTION IF EXISTS reject_backup_audit()');
    }
  });
});
