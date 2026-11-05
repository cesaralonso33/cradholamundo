import { describe, expect, it } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../../src/db/schema.js';

describe('Drizzle schema', () => {
  it('defines all thirteen Prisma entities with mapped SQL table names', () => {
    const tables = Object.values(schema).filter((value) =>
      typeof value === 'object' && value !== null && 'enableRLS' in value,
    );
    expect(tables.map((table) => getTableConfig(table as never).name).sort()).toEqual([
      'AuditLog', 'Constancia', 'Employee', 'InventoryMovement', 'LocationHistory',
      'LoginAttempt', 'PapeleriaItem', 'PapeleriaOrderItem', 'PapeleriaOrder',
      'Product', 'Role', 'Setting', 'User',
    ].sort());
  });

  it('uses client-generated cuid IDs and application-updated timestamps', () => {
    expect(schema.createProductSchema.parse({ sku: 'SKU-1', name: 'Producto' })).toMatchObject({
      id: expect.stringMatching(/^c[a-z0-9]{24}$/), quantity: 0, min_stock: 0,
    });
    expect(schema.products.updated_at.onUpdateFn).toBeTypeOf('function');
  });

  it('keeps uniqueness, indexes, and delete actions aligned with Prisma', () => {
    const product = getTableConfig(schema.products);
    expect(product.indexes.some((index) => index.config.unique && index.config.name?.includes('sku'))).toBe(true);
    const movement = getTableConfig(schema.inventoryMovements);
    expect(movement.foreignKeys[0]?.onDelete).toBe('cascade');
    const audit = getTableConfig(schema.auditLogs);
    expect(audit.foreignKeys[0]?.onDelete).toBe('set null');
  });
});
