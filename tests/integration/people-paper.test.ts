import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client, Pool } from 'pg';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const baseUrl = process.env.DATABASE_URL;
let databaseName = ''; let isolatedUrl = ''; let client: Client; let pool: Pool; let routePool: Pool; let app: ReturnType<typeof Fastify>; let adminToken: string; let workerToken: string;
beforeAll(async () => {
  if (!baseUrl) throw new Error('DATABASE_URL must point to isolated PostgreSQL');
  databaseName = `people_paper_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl }); await admin.connect(); try { await admin.query(`CREATE DATABASE "${databaseName}"`); } finally { await admin.end(); }
  const url = new URL(baseUrl); url.pathname = `/${databaseName}`; url.searchParams.delete('schema'); isolatedUrl = url.toString();
  execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: isolatedUrl }, stdio: 'pipe' });
  process.env.DATABASE_URL = isolatedUrl; process.env.JWT_SECRET = 'task4-people-paper-test-secret-32chars';
  client = new Client({ connectionString: isolatedUrl }); await client.connect(); pool = new Pool({ connectionString: isolatedUrl });
  const [employees, papeleria, auth, dbModule] = await Promise.all([import('../../src/routes/employees.js'), import('../../src/routes/papeleria.js'), import('../../src/lib/auth.js'), import('../../src/db/client.js')]);
  routePool = dbModule.pool; app = Fastify(); await app.register(multipart); await app.register(employees.employeeRoutes); await app.register(papeleria.papeleriaRoutes); await app.ready();
  adminToken = auth.signToken({ id: 'admin1', username: 'admin', role: 'admin' }); workerToken = auth.signToken({ id: 'worker1', username: 'worker', role: 'worker' });
  await client.query(`INSERT INTO "Role" (id,name,description,permissions,updated_at) VALUES ('role-worker','worker','Worker',ARRAY['employees','papeleria'],now())`);
  await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('admin1','admin','x','admin',now()),('worker1','worker','x','worker',now())`);
}, 60000);
beforeEach(async () => { await client.query('TRUNCATE TABLE "PapeleriaOrder", "PapeleriaItem", "Employee", "AuditLog" CASCADE'); });
afterAll(async () => { await app?.close(); await client?.end(); await pool?.end(); await routePool?.end(); if (baseUrl && databaseName) { const admin = new Client({ connectionString: baseUrl }); await admin.connect(); try { await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()', [databaseName]); await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`); } finally { await admin.end(); } } });
const request = (method: string, url: string, payload?: unknown, token = adminToken) => app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload: payload as any });

describe('employees, constancias and papeleria HTTP routes (isolated PostgreSQL)', () => {
  it('preserves employee permissions, CRUD and constancia multipart validation', async () => {
    expect((await request('POST', '/api/employees', { name: 'Alice' }, workerToken)).statusCode).toBe(200);
    const created = await request('POST', '/api/employees', { name: 'Bob', position: 'Clerk' }); expect(created.statusCode).toBe(200);
    const id = created.json().id;
    expect((await request('GET', '/api/employees', undefined, workerToken)).json().items[0]._count.constancias).toBe(0);
    expect((await request('POST', `/api/employees/${id}/constancias`, { title: 'Need multipart' }, workerToken)).statusCode).toBe(400);
    const multipartBody = ['--task4', 'Content-Disposition: form-data; name="title"', '', 'Certificate', '--task4', 'Content-Disposition: form-data; name="file"; filename="bad.exe"', 'Content-Type: application/octet-stream', '', 'x', '--task4--', ''].join('\r\n');
    const badFile = await app.inject({ method: 'POST', url: `/api/employees/${id}/constancias`, headers: { authorization: `Bearer ${workerToken}`, 'content-type': 'multipart/form-data; boundary=task4' }, payload: multipartBody });
    expect(badFile.statusCode).toBe(400); expect(badFile.json()).toEqual({ error: 'file type not allowed' });
    expect((await request('DELETE', `/api/employees/${id}`, undefined, workerToken)).statusCode).toBe(403);
    expect((await request('DELETE', `/api/employees/${id}`)).json()).toEqual({ ok: true });
  });
  it('preserves paper item validation, role scopes, order ownership and close concurrency atomically', async () => {
    const item = await request('POST', '/api/papeleria', { name: 'Papel', quantity: 10 }); expect(item.statusCode).toBe(200);
    const orderResponse = await request('POST', '/api/papeleria/orders', { items: [{ itemId: item.json().id, quantity: 3 }] }, workerToken); expect(orderResponse.statusCode).toBe(200);
    const order = orderResponse.json();
    expect((await request('GET', `/api/papeleria/orders/${order.id}`, undefined, adminToken)).statusCode).toBe(200);
    const otherWorkerToken = (await import('../../src/lib/auth.js')).signToken({ id: 'worker2', username: 'worker2', role: 'worker' });
    await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('worker2','worker2','x','worker',now())`);
    expect((await request('GET', `/api/papeleria/orders/${order.id}`, undefined, otherWorkerToken)).statusCode).toBe(403);
    expect((await request('GET', '/api/papeleria/orders', undefined, workerToken)).json()).toMatchObject({ total: 1, items: [{ folio: 'PAP-000001' }] });
    const closeResults = await Promise.all([request('POST', `/api/papeleria/orders/${order.id}/close`), request('POST', `/api/papeleria/orders/${order.id}/close`)]);
    expect(closeResults.map(r => r.statusCode).sort()).toEqual([200, 400]);
    expect((await client.query(`SELECT status FROM "PapeleriaOrder" WHERE id=$1`, [order.id])).rows[0].status).toBe('CLOSED');
    expect(Number((await client.query(`SELECT quantity FROM "PapeleriaItem" WHERE id=$1`, [item.json().id])).rows[0].quantity)).toBe(10);
  });
  it('rolls back a partially replaced order when a referenced item violates a foreign key', async () => {
    const item = await request('POST', '/api/papeleria', { name: 'Item' });
    const created = await request('POST', '/api/papeleria/orders', { items: [{ itemId: item.json().id, quantity: 2 }] }); const id = created.json().id;
    const bad = await request('PUT', `/api/papeleria/orders/${id}`, { items: [{ itemId: 'missing', quantity: 1 }] }); expect(bad.statusCode).toBe(400);
    expect(Number((await client.query(`SELECT count(*)::int AS n FROM "PapeleriaOrderItem" WHERE order_id=$1`, [id])).rows[0].n)).toBe(1);
  });
});
