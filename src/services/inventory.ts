import { z } from 'zod';
import type { Database } from '../db/client.js';
import type { InventoryMovement, Product } from '../db/schema.js';

const movementInput = z.object({ sku: z.string().trim().min(1), type: z.string().transform((v) => v.toUpperCase()).pipe(z.enum(['IN', 'OUT'])), quantity: z.number().int().positive(), note: z.string().nullable().optional() });
export type MovementInput = z.infer<typeof movementInput>;
export const normalizeMovementInput = (input: unknown): MovementInput => movementInput.parse(input);

export async function recordMovement(database: Database, input: unknown, onRecorded?: (tx: Parameters<Parameters<Database['transaction']>[0]>[0], result: { movement: InventoryMovement; product: Product }) => Promise<void>) {
  const movement = normalizeMovementInput(input);
  const { inventoryMovementRepository, productRepository } = await import('../db/repositories/index.js');
  return database.transaction(async (tx) => {
    const product = await productRepository.findBySku(tx, movement.sku);
    if (!product) throw Object.assign(new Error('product not found'), { code: 'NOT_FOUND' });
    const updated = await productRepository.adjustStock(tx, product.id, movement.type, movement.quantity);
    if (!updated) throw Object.assign(new Error('insufficient stock'), { code: 'INSUFFICIENT_STOCK' });
    const created = await inventoryMovementRepository.create(tx, { product_id: product.id, type: movement.type, quantity: movement.quantity, note: movement.note ?? null });
    const result = { movement: created, product: updated };
    await onRecorded?.(tx, result);
    return result;
  });
}
