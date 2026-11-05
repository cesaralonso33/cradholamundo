import { z } from 'zod';
import type { Database } from '../db/client.js';

const orderItemsSchema = z.array(z.object({ itemId: z.string().min(1), quantity: z.number().int().positive(), note: z.string().nullable().optional() })).min(1);
export type NormalizedOrderItem = z.infer<typeof orderItemsSchema>[number];
export const normalizeOrderItems = (input: unknown): NormalizedOrderItem[] => orderItemsSchema.parse(input);
export function assertOrderCanClose(status: string): void {
  if (status !== 'OPEN') throw Object.assign(new Error('order is not open'), { code: 'CONFLICT' });
}
export async function closeOrder(database: Database, id: string, username: string) {
  const { papeleriaOrderRepository } = await import('../db/repositories/index.js');
  return database.transaction(async (tx) => {
    const order = await papeleriaOrderRepository.findById(tx, id);
    if (!order) throw Object.assign(new Error('order not found'), { code: 'NOT_FOUND' });
    assertOrderCanClose(order.status);
    const closed = await papeleriaOrderRepository.close(tx, id, username);
    if (!closed) throw Object.assign(new Error('order was closed concurrently'), { code: 'CONFLICT' });
    return closed;
  });
}
