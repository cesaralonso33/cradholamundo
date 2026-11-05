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
  await client.query('DROP TRIGGER IF EXISTS fail_inventory_audit ON "AuditLog"; DROP FUNCTION IF EXISTS fail_inventory_audit()');
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
    expect((await request('POST', '/api/inventory/movement', { sku: 'DUP', type: 'IN', quantity: 1.5 })).json()).toEqual({ error: 'quantity must be a positive integer' });
    expect((await request('POST', '/api/products', {})).json()).toEqual({ error: 'sku and name are required' });
    expect((await request('PUT', '/api/products/DUP', {})).json()).toEqual({ error: 'name required' });
  });

  it('applies search inside user location and preserves search-before-q precedence including empty search', async () => {
    await client.query(`INSERT INTO "Product" (id,sku,name,location,quantity,updated_at) VALUES ('owned','OWN','Owned widget','worker',1,now()),('foreign','FOR','Secret widget','admin',1,now())`);
    const escaped = await request('GET', '/api/products?search=Secret', undefined, userToken);
    expect(escaped.json().total).toBe(0);
    expect((await request('GET', '/api/products?search=&q=Owned', undefined, userToken)).json().total).toBe(1);
    expect((await request('GET', '/api/products?search=Owned&q=Secret', undefined, userToken)).json().total).toBe(1);
    expect((await request('GET', '/api/products?search=Secret&q=Owned', undefined, userToken)).json().total).toBe(0);
    expect((await request('GET', '/api/products/OWN/history', undefined, userToken)).statusCode).toBe(200);
    expect((await request('POST', '/api/products/OWN/archive', undefined, userToken)).statusCode).toBe(200);
    expect((await request('POST', '/api/products/FOR/archive', undefined, userToken)).statusCode).toBe(403);
  });

  it('rolls product changes back if their audit insert fails', async () => {
    await client.query(`CREATE FUNCTION fail_inventory_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='product.created' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_inventory_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_inventory_audit()`);
    try {
      const response = await request('POST', '/api/products', { sku: 'AUDIT-FAIL', name: 'Must roll back' });
      expect(response.statusCode).toBe(500);
      expect(Number((await client.query(`SELECT count(*)::int AS n FROM "Product" WHERE sku='AUDIT-FAIL'`)).rows[0].n)).toBe(0);
    } finally { await client.query('DROP TRIGGER IF EXISTS fail_inventory_audit ON "AuditLog"; DROP FUNCTION IF EXISTS fail_inventory_audit()'); }
  });

  it('rolls stock and movement back if movement auditing fails', async () => {
    await request('POST', '/api/products', { sku: 'AUDIT-MOVE', name: 'Stock', quantity: 3 });
    await client.query(`CREATE FUNCTION fail_inventory_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='inventory.movement' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_inventory_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_inventory_audit()`);
    try {
      const response = await request('POST', '/api/inventory/movement', { sku: 'AUDIT-MOVE', type: 'OUT', quantity: 2 });
      expect(response.statusCode).toBe(500);
      expect(Number((await client.query(`SELECT quantity FROM "Product" WHERE sku='AUDIT-MOVE'`)).rows[0].quantity)).toBe(3);
      expect(Number((await client.query(`SELECT count(*)::int AS n FROM "InventoryMovement"`)).rows[0].n)).toBe(0);
    } finally { await client.query('DROP TRIGGER IF EXISTS fail_inventory_audit ON "AuditLog"; DROP FUNCTION IF EXISTS fail_inventory_audit()'); }
  });

  it('serializes duplicate SKU creation and concurrent archive state changes', async () => {
    await client.query(`INSERT INTO "Setting" (key,value) VALUES ('prevent_duplicates','true')`);
    const creates = await Promise.all([
      request('POST', '/api/products', { sku: 'RACE', name: 'First' }),
      request('POST', '/api/products', { sku: 'RACE', name: 'Second' }),
    ]);
    expect(creates.map(response => response.statusCode).sort()).toEqual([200, 409]);
    await client.query(`UPDATE "Setting" SET value='false' WHERE key='prevent_duplicates'`);
    const archived = await Promise.all([
      request('POST', '/api/products/RACE/archive'),
      request('POST', '/api/products/RACE/archive'),
    ]);
    expect(archived.map(response => response.statusCode).sort()).toEqual([200, 409]);
    expect(Number((await client.query(`SELECT count(*)::int AS n FROM "LocationHistory" WHERE to_location='Archivo'`)).rows[0].n)).toBe(1);
  });

  it('preserves an omitted quantity across concurrent edits', async () => {
    await request('POST', '/api/products', { sku: 'EDIT-RACE', name: 'Original', quantity: 2 });
    const [quantityEdit, nameEdit] = await Promise.all([
      request('PUT', '/api/products/EDIT-RACE', { name: 'Quantity edit', quantity: 8 }),
      request('PUT', '/api/products/EDIT-RACE', { name: 'Name edit' }),
    ]);
    expect([quantityEdit.statusCode, nameEdit.statusCode]).toEqual([200, 200]);
    expect(Number((await client.query(`SELECT quantity FROM "Product" WHERE sku='EDIT-RACE'`)).rows[0].quantity)).toBe(8);
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
