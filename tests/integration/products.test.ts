import { Client } from 'pg';
import Fastify from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const connectionString = process.env.DATABASE_URL;
let client: Client;
let app: ReturnType<typeof Fastify>;
let token: string;
let userToken: string;

beforeAll(async () => {
  if (!connectionString) throw new Error('DATABASE_URL must target the isolated PostgreSQL test database');
  process.env.JWT_SECRET = 'task4-inventory-test-secret-at-least-32';
  const [{ productRoutes }, auth, dbModule] = await Promise.all([import('../../src/routes/products.js'), import('../../src/lib/auth.js'), import('../../src/db/client.js')]);
  client = new Client({ connectionString }); await client.connect();
  app = Fastify(); await app.register(productRoutes); await app.ready();
  token = auth.signToken({ id: 'admin1', username: 'admin', role: 'admin' });
  userToken = auth.signToken({ id: 'user1', username: 'worker', role: 'worker' });
  void dbModule;
  await client.query(`INSERT INTO "Role" (id,name,description,permissions,updated_at) VALUES ('role-worker','worker','Worker',ARRAY['products'],now()) ON CONFLICT (name) DO UPDATE SET permissions=EXCLUDED.permissions`);
  await client.query(`INSERT INTO "User" (id,username,password,role,updated_at) VALUES ('admin1','admin','x','admin',now()),('user1','worker','x','worker',now()) ON CONFLICT (id) DO NOTHING`);
}, 60000);

beforeEach(async () => {
  await client.query('TRUNCATE TABLE "InventoryMovement", "LocationHistory", "Product", "AuditLog", "Setting" CASCADE');
});

afterAll(async () => { await app?.close(); await client?.end(); const { pool } = await import('../../src/db/client.js'); await pool.end(); });

const request = (method: string, url: string, payload?: unknown, auth = token) => app.inject({ method, url, headers: { authorization: `Bearer ${auth}` }, payload: payload as object | undefined });

describe('product and inventory HTTP routes on isolated PostgreSQL', () => {
  it('creates, lists with search and pagination, edits, archives, and deletes products', async () => {
    const created = await request('POST', '/api/products', { sku: 'A-1', name: 'Bolt', quantity: 4 });
    expect(created.statusCode).toBe(200); expect(created.json()).toMatchObject({ sku: 'A-1', quantity: 4, location: 'admin' });
    const listing = await request('GET', '/api/products?q=bol&page=1&pageSize=1');
    expect(listing.json()).toMatchObject({ total: 1, page: 1, pageSize: 1 }); expect(listing.json().items[0].sku).toBe('A-1');
    expect((await request('GET', '/api/products/A-1/history')).json()).toMatchObject({ total: 1, items: [expect.objectContaining({ to_location: 'admin' })] });
    expect((await request('PUT', '/api/products/A-1', { name: 'Bolt updated', quantity: 8 })).json()).toMatchObject({ name: 'Bolt updated', quantity: 8 });
    expect((await request('PUT', '/api/products/A-1', { name: 'unauthorized change' }, userToken)).statusCode).toBe(403);
    expect((await request('POST', '/api/products/A-1/archive')).json()).toMatchObject({ location: 'Archivo' });
    const history = (await request('GET', '/api/products/A-1/history')).json();
    expect(history.total).toBe(2); expect(history.items).toContainEqual(expect.objectContaining({ to_location: 'Archivo' }));
    expect((await request('POST', '/api/products/missing/archive')).json()).toEqual({ error: 'not found' });
    expect((await request('DELETE', '/api/products/A-1')).json()).toEqual({ ok: true });
    expect((await request('GET', '/api/products/A-1')).statusCode).toBe(404);
  });

  it('preserves conflict, missing-resource, permission and validation responses', async () => {
    await request('POST', '/api/products', { sku: 'DUP', name: 'one' });
    await client.query(`INSERT INTO "Setting" (key,value) VALUES ('prevent_duplicates','true')`);
    expect((await request('POST', '/api/products', { sku: 'DUP', name: 'two' })).statusCode).toBe(409);
    const duplicate = await request('POST', '/api/products', { sku: 'DUP', name: 'two' });
    expect(duplicate.json()).toEqual({ error: 'SKU already captured (duplicate rule enabled)' });
    expect((await request('PUT', '/api/products/missing', { name: 'none' })).json()).toEqual({ error: 'not found' });
    expect((await request('DELETE', '/api/products/DUP', undefined, userToken)).statusCode).toBe(403);
    expect((await request('POST', '/api/inventory/movement', { sku: 'DUP', type: 'OUT', quantity: -1 })).json()).toEqual({ error: 'quantity must be positive' });
    expect((await request('POST', '/api/products', {})).json()).toEqual({ error: 'sku and name are required' });
    expect((await request('PUT', '/api/products/DUP', {})).json()).toEqual({ error: 'name required' });
  });

  it('records movements atomically and rejects concurrent outs that would make stock negative', async () => {
    await request('POST', '/api/products', { sku: 'STOCK', name: 'Stock', quantity: 5 });
    const [one, two] = await Promise.all([
      request('POST', '/api/inventory/movement', { sku: 'STOCK', type: 'OUT', quantity: 4 }),
      request('POST', '/api/inventory/movement', { sku: 'STOCK', type: 'OUT', quantity: 4 }),
    ]);
    expect([one.statusCode, two.statusCode].sort()).toEqual([200, 400]);
    expect(Number((await client.query(`SELECT quantity FROM "Product" WHERE sku='STOCK'`)).rows[0].quantity)).toBe(1);
    expect(Number((await client.query(`SELECT count(*)::int AS n FROM "InventoryMovement"`)).rows[0].n)).toBe(1);
    expect(Number((await client.query(`SELECT count(*)::int AS n FROM "AuditLog" WHERE action='inventory.movement'`)).rows[0].n)).toBe(1);
    expect((await request('POST', '/api/inventory/movement', { sku: 'absent', type: 'IN', quantity: 1 })).json()).toEqual({ error: 'product not found' });
  });
});
