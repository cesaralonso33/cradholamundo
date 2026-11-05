import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

const baseUrl = process.env.DATABASE_URL;
let databaseName = '';
let isolatedUrl = '';
let app: { inject: (options: { method: string; url: string }) => Promise<{ statusCode: number; json: () => unknown }>; close: () => Promise<void> };
let pool: { end: () => Promise<void> };

beforeAll(async () => {
  if (!baseUrl) throw new Error('DATABASE_URL must point to a PostgreSQL admin database for disposable test databases.');
  databaseName = `health_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query(`CREATE DATABASE "${databaseName}"`); } finally { await admin.end(); }
  const url = new URL(baseUrl); url.pathname = `/${databaseName}`; url.searchParams.delete('schema'); isolatedUrl = url.toString();
  execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: isolatedUrl }, stdio: 'pipe' });
  process.env.DATABASE_URL = isolatedUrl;
  process.env.JWT_SECRET = 'health-test-jwt-secret-at-least-32-characters';
  process.env.ADMIN_PASSWORD = 'health-test-password';
  pool = (await import('../src/db/client.js')).pool;
  app = await (await import('../src/app.js')).buildApp();
}, 60000);

afterAll(async () => {
  await app?.close(); await pool?.end();
  if (!baseUrl || !databaseName) return;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]); await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`); } finally { await admin.end(); }
});

describe('health endpoint', () => {
  it.each(['/health', '/api/health'])('returns ok when the Drizzle database is available at %s', async (url) => {
    const response = await app.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, backend: 'up', database: 'up' });
  });
});
