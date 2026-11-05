import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../src/db/schema.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const baseUrl = process.env.DATABASE_URL;
let isolatedUrl: string;
let databaseName: string;
let client: Client;
let pool: Pool;
let orm: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  // Let the tests fail individually with an actionable error instead of reporting skips.
  if (!baseUrl) return;
  const adminUrl = new URL(baseUrl);
  if (adminUrl.protocol !== 'postgres:' && adminUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must be a PostgreSQL URL for an isolated test server.');
  }
  databaseName = `drizzle_test_${process.pid}_${randomBytes(4).toString('hex')}`;
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
  } finally {
    await admin.end();
  }
  const dbUrl = new URL(baseUrl);
  dbUrl.pathname = `/${databaseName}`;
  dbUrl.searchParams.delete('schema');
  isolatedUrl = dbUrl.toString();

  execFileSync(process.execPath, ['node_modules/drizzle-kit/bin.cjs', 'migrate'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: isolatedUrl },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  client = new Client({ connectionString: isolatedUrl });
  await client.connect();
  pool = new Pool({ connectionString: isolatedUrl });
  orm = drizzle(pool, { schema });
}, 60_000);

afterAll(async () => {
  if (!baseUrl || !databaseName) return;
  await client?.end();
  await pool?.end();
  const admin = new Client({ connectionString: baseUrl });
  await admin.connect();
  try {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [databaseName]);
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await admin.end();
  }
});

function requireDbClient(): Client {
  if (!baseUrl) throw new Error('DATABASE_URL is required for database tests; point it at an isolated PostgreSQL test server.');
  if (!client) throw new Error('PostgreSQL test database setup did not complete.');
  return client;
}

describe('initial migration on a disposable PostgreSQL database', () => {
  it('applies the versioned migration from an empty database and creates all models', async () => {
    const result = await requireDbClient().query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '__drizzle_migrations'");
    expect(result.rows.map((row) => row.tablename).sort()).toEqual([
      'AuditLog', 'Constancia', 'Employee', 'InventoryMovement', 'LocationHistory', 'LoginAttempt',
      'PapeleriaItem', 'PapeleriaOrder', 'PapeleriaOrderItem', 'Product', 'Role', 'Setting', 'User',
    ].sort());
  });

  it('preserves SQL defaults and every declared unique and secondary index', async () => {
    const db = requireDbClient();
    const columns = await db.query(`
      SELECT table_name, column_name, column_default FROM information_schema.columns
      WHERE table_schema='public'
    `);
    const defaults = new Map(columns.rows.map((row) => [`${row.table_name}.${row.column_name}`, row.column_default]));
    const sqlDefaults = Object.fromEntries([...defaults].filter(([, value]) => value !== null));
    expect(sqlDefaults).toEqual({
      'Product.quantity': '0', 'Product.min_stock': '0', 'Product.created_at': 'now()',
      'InventoryMovement.created_at': 'now()', 'LocationHistory.created_at': 'now()',
      'User.role': "'user'::text", 'User.two_factor_enabled': 'false', 'User.created_at': 'now()',
      'AuditLog.created_at': 'now()', 'Role.created_at': 'now()',
      'LoginAttempt.failures': '0', 'LoginAttempt.last_attempt': 'now()',
      'Employee.created_at': 'now()', 'Constancia.created_at': 'now()',
      'PapeleriaItem.quantity': '0', 'PapeleriaItem.created_at': 'now()',
      'PapeleriaOrder.status': "'OPEN'::text", 'PapeleriaOrder.created_at': 'now()',
    });
    expect(defaults.get('Product.id')).toBeNull();
    expect(defaults.get('Product.updated_at')).toBeNull();

    const indexes = await db.query("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND indexname NOT LIKE '%_pkey'");
    const indexDefs = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef]));
    expect([...indexDefs.keys()].sort()).toEqual([
      'audit_logs_created_at_idx', 'audit_logs_user_id_idx', 'constancias_employee_id_created_at_idx',
      'employees_created_at_idx', 'employees_name_idx', 'inventory_movements_created_at_idx',
      'inventory_movements_product_id_idx', 'location_histories_product_id_created_at_idx',
      'login_attempts_blocked_until_idx', 'papeleria_items_name_idx', 'papeleria_items_name_key',
      'papeleria_order_items_order_id_idx', 'papeleria_orders_created_at_idx', 'papeleria_orders_folio_key',
      'papeleria_orders_status_idx', 'papeleria_orders_user_id_created_at_idx', 'products_location_updated_at_idx',
      'products_sku_idx', 'products_sku_key', 'roles_name_idx', 'roles_name_key', 'users_email_key',
      'users_username_idx', 'users_username_key',
    ].sort());
    for (const name of ['papeleria_items_name_key', 'papeleria_orders_folio_key', 'products_sku_key', 'roles_name_key', 'users_email_key', 'users_username_key']) {
      expect(indexDefs.get(name)).toMatch(/^CREATE UNIQUE INDEX/i);
    }
  });

  it('creates all seven foreign keys with the Prisma delete actions', async () => {
    const result = await requireDbClient().query(`
      SELECT source.relname AS table_name, source_col.attname AS column_name, fk.confdeltype AS delete_action
      FROM pg_constraint fk
      JOIN pg_class source ON source.oid=fk.conrelid
      JOIN LATERAL unnest(fk.conkey) WITH ORDINALITY AS source_key(attnum, ord) ON true
      JOIN pg_attribute source_col ON source_col.attrelid=source.oid AND source_col.attnum=source_key.attnum
      WHERE fk.contype='f'
    `);
    const actions = new Map(result.rows.map((row) => [`${row.table_name}.${row.column_name}`, row.delete_action]));
    expect(Object.fromEntries(actions)).toEqual({
      'AuditLog.user_id': 'n',
      'Constancia.employee_id': 'c',
      'InventoryMovement.product_id': 'c',
      'LocationHistory.product_id': 'c',
      'PapeleriaOrder.user_id': 'a',
      'PapeleriaOrderItem.order_id': 'c',
      'PapeleriaOrderItem.papeleria_item_id': 'a',
    });
  });

  it('enforces unique, cascade, SetNull, and inventory transaction behavior', async () => {
    const db = requireDbClient();
    await db.query('BEGIN');
    try {
      await db.query(`INSERT INTO "Product" (id, sku, name, updated_at) VALUES ('p1', 'sku1', 'Test', now())`);
      await db.query(`INSERT INTO "InventoryMovement" (id, product_id, type, quantity) VALUES ('m1', 'p1', 'IN', 4)`);
      await db.query(`UPDATE "Product" SET quantity=quantity+4 WHERE id='p1'`);
      expect((await db.query(`SELECT quantity FROM "Product" WHERE id='p1'`)).rows[0].quantity).toBe(4);
      await db.query('SAVEPOINT unique_check');
      await expect(db.query(`INSERT INTO "Product" (id, sku, name, updated_at) VALUES ('p2', 'sku1', 'Duplicate', now())`)).rejects.toMatchObject({ code: '23505' });
      await db.query('ROLLBACK TO SAVEPOINT unique_check');
      await db.query('RELEASE SAVEPOINT unique_check');

      await db.query(`INSERT INTO "User" (id, username, password, updated_at) VALUES ('u1', 'user1', 'x', now())`);
      await db.query(`INSERT INTO "AuditLog" (id, user_id, action) VALUES ('a1', 'u1', 'test')`);
      await db.query(`DELETE FROM "User" WHERE id='u1'`);
      expect((await db.query(`SELECT user_id FROM "AuditLog" WHERE id='a1'`)).rows[0].user_id).toBeNull();
      await db.query(`DELETE FROM "Product" WHERE id='p1'`);
      expect((await db.query(`SELECT id FROM "InventoryMovement" WHERE id='m1'`)).rowCount).toBe(0);
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('omits sensitive user fields by default and includes them only on explicit administrative export', async () => {
    const db = requireDbClient();
    const { backupRepository } = await import('../../src/db/repositories/index.js');
    await db.query(`INSERT INTO "User" (id, username, password, totp_secret, updated_at) VALUES ('backup-user', 'backup-test', 'test-hash', 'test-totp', now())`);
    const safe = await backupRepository.exportAll(orm);
    expect(safe.users[0]).not.toHaveProperty('password');
    expect(safe.users[0]).not.toHaveProperty('totp_secret');

    const administrative = await backupRepository.exportAll(orm, { includeSensitiveUserData: true });
    expect(administrative.users[0]).toMatchObject({ password: 'test-hash', totp_secret: 'test-totp' });
  });

  it('commits inventory movement and stock update atomically', async () => {
    const db = requireDbClient();
    const { recordMovement } = await import('../../src/services/inventory.js');
    await db.query(`INSERT INTO "Product" (id, sku, name, quantity, updated_at) VALUES ('movement-product', 'movement-sku', 'Movement test', 2, now())`);
    await recordMovement(orm, { sku: 'movement-sku', type: 'OUT', quantity: 1 });
    expect((await db.query(`SELECT quantity FROM "Product" WHERE id='movement-product'`)).rows[0].quantity).toBe(1);
    expect((await db.query(`SELECT count(*)::int AS count FROM "InventoryMovement" WHERE product_id='movement-product'`)).rows[0].count).toBe(1);
    await expect(recordMovement(orm, { sku: 'movement-sku', type: 'OUT', quantity: 2 })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    expect((await db.query(`SELECT count(*)::int AS count FROM "InventoryMovement" WHERE product_id='movement-product'`)).rows[0].count).toBe(1);
  });

  it('closes an order and reports a concurrent/already-closed state explicitly', async () => {
    const db = requireDbClient();
    const { closeOrder } = await import('../../src/services/papeleria.js');
    await db.query(`INSERT INTO "User" (id, username, password, updated_at) VALUES ('close-user', 'close-test', 'test-hash', now())`);
    await db.query(`INSERT INTO "PapeleriaOrder" (id, folio, user_id, status, updated_at) VALUES ('close-order', 'close-folio', 'close-user', 'OPEN', now())`);
    const closed = await closeOrder(orm, 'close-order', 'close-test');
    expect(closed).toMatchObject({ status: 'CLOSED', closed_by: 'close-test' });
    await expect(closeOrder(orm, 'close-order', 'close-test')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
