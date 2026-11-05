import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const baseUrl = process.env.DATABASE_URL;
let databaseName = '';
let isolatedUrl = '';
let app: Awaited<ReturnType<typeof import('../../src/app.js').buildApp>> | undefined;
let pool: (typeof import('../../src/db/client.js'))['pool'] | undefined;

beforeAll(async () => {
  if (!baseUrl) throw new Error('DATABASE_URL must point to a local PostgreSQL admin database.');
  databaseName = `runtime_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query(`CREATE DATABASE "${databaseName}"`); } finally { await admin.end(); }
  const url = new URL(baseUrl); url.pathname = `/${databaseName}`; url.searchParams.delete('schema'); isolatedUrl = url.toString();
  execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: isolatedUrl }, stdio: 'pipe' });
  process.env.DATABASE_URL = isolatedUrl;
  process.env.JWT_SECRET = 'runtime-test-jwt-secret-at-least-32-characters';
  process.env.ADMIN_PASSWORD = 'runtime-test-password';
  pool = (await import('../../src/db/client.js')).pool;
  app = await (await import('../../src/app.js')).buildApp();
}, 60000);

afterAll(async () => {
  await app?.close(); await pool?.end();
  if (!baseUrl || !databaseName) return;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect();
  try { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]); await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`); } finally { await admin.end(); }
});

describe('runtime backed by an isolated migrated PostgreSQL database', () => {
  it.each(['/health', '/api/health'])('reports database connectivity at %s', async (url) => {
    const response = await app!.inject({ method: 'GET', url });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, backend: 'up', database: 'up' });
  });

  it('serves the OpenAPI document in JSON and YAML from the docs-compatible endpoints', async () => {
    const json = await app!.inject({ method: 'GET', url: '/api/openapi.json' });
    const yaml = await app!.inject({ method: 'GET', url: '/api/openapi.yaml' });
    expect(json.statusCode).toBe(200);
    expect(json.headers['content-type']).toContain('application/json');
    expect(yaml.statusCode).toBe(200);
    expect(yaml.headers['content-type']).toContain('application/yaml');
    expect(JSON.parse(yaml.body)).toEqual(json.json());
  });

  it('seeds the initial admin, roles, and papeleria in the real database', async () => {
    const client = new Client({ connectionString: isolatedUrl }); await client.connect();
    try {
      expect(Number((await client.query(`SELECT count(*)::int AS n FROM "User" WHERE username='admin'`)).rows[0].n)).toBe(1);
      expect(Number((await client.query(`SELECT count(*)::int AS n FROM "Role" WHERE name IN ('admin','user')`)).rows[0].n)).toBe(2);
      expect(Number((await client.query(`SELECT count(*)::int AS n FROM "PapeleriaItem"`)).rows[0].n)).toBeGreaterThan(0);
    } finally { await client.end(); }
  });

  it('closes the Fastify instance cleanly', async () => {
    await expect(app!.close()).resolves.toBeUndefined();
    app = undefined;
  });
});
