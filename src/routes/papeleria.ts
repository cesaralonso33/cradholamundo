import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { papeleriaItems, papeleriaOrderItems, papeleriaOrders, users } from '../db/schema.js';
import { papeleriaRepository, papeleriaOrderRepository } from '../db/repositories/index.js';
import { closeOrder } from '../services/papeleria.js';
import { adminOnly, authenticate, requirePermission } from '../lib/auth.js';
import { toHttpError } from '../lib/errors.js';
import { readExcelRows } from '../lib/excel.js';
import { logAudit } from '../lib/audit.js';

const idParams = z.object({ id: z.string().min(1) });
const orderItem = z.object({ itemId: z.string().min(1), quantity: z.unknown().transform(value => Math.max(1, Math.floor(Number(value) || 1))), note: z.string().nullable().optional() });
const itemsSchema = z.array(orderItem).min(1);
const itemBody = z.object({ name: z.string().min(1), unit: z.string().nullable().optional(), quantity: z.coerce.number().int().optional() });
const parseError = (error: unknown, reply: any) => { const e = toHttpError(error); return reply.code(e.statusCode).send(e.body); };
const orderInclude = async (order: any) => {
  const items = await db.select({ id: papeleriaOrderItems.id, order_id: papeleriaOrderItems.order_id, papeleria_item_id: papeleriaOrderItems.papeleria_item_id, quantity: papeleriaOrderItems.quantity, note: papeleriaOrderItems.note, item: papeleriaItems }).from(papeleriaOrderItems).innerJoin(papeleriaItems, eq(papeleriaOrderItems.papeleria_item_id, papeleriaItems.id)).where(eq(papeleriaOrderItems.order_id, order.id));
  const user = await db.select({ id: users.id, username: users.username }).from(users).where(eq(users.id, order.user_id)).then(r => r[0]);
  return { ...order, items, user };
};
const insertOrderItems = async (executor: any, orderId: string, items: z.infer<typeof itemsSchema>) => {
  const found = await papeleriaRepository.findItems(executor, [...new Set(items.map(it => it.itemId))]);
  if (found.length !== new Set(items.map(it => it.itemId)).size) throw Object.assign(new Error('missing items'), { code: 'INVALID_STATE' });
  await executor.insert(papeleriaOrderItems).values(items.map(it => ({ order_id: orderId, papeleria_item_id: it.itemId, quantity: it.quantity, note: it.note ?? null })));
};

export async function papeleriaRoutes(app: FastifyInstance) {
  const guarded = [authenticate, requirePermission('papeleria')];
  app.get('/api/papeleria/orders', { preHandler: guarded }, async (req, reply) => {
    try { const query = z.object({ limit: z.coerce.number().finite().optional() }).parse(req.query); const where = req.user.role === 'admin' ? undefined : eq(papeleriaOrders.user_id, req.user.id); const [rows, totals, pending] = await Promise.all([db.select({ order: papeleriaOrders, user: { id: users.id, username: users.username }, itemCount: sql<number>`count(${papeleriaOrderItems.id})::int` }).from(papeleriaOrders).leftJoin(users, eq(papeleriaOrders.user_id, users.id)).leftJoin(papeleriaOrderItems, eq(papeleriaOrders.id, papeleriaOrderItems.order_id)).where(where).groupBy(papeleriaOrders.id, users.id).orderBy(sql`${papeleriaOrders.created_at} DESC`).limit(Math.min(200, Math.max(1, Math.floor(query.limit ?? 100)))), db.select({ count: count() }).from(papeleriaOrders).where(where), req.user.role === 'admin' ? db.select({ count: count() }).from(papeleriaOrders).where(eq(papeleriaOrders.status, 'OPEN')) : Promise.resolve([{ count: 0 }])]); return { items: rows.map(r => ({ ...r.order, user: r.user, _count: { items: r.itemCount } })), total: totals[0].count, pending: pending[0].count }; }
    catch (error) { return parseError(error, reply); }
  });
  app.post('/api/papeleria/orders', { preHandler: guarded }, async (req, reply) => {
    try { if (!Array.isArray((req.body as any)?.items) || !(req.body as any).items.length) return reply.code(400).send({ error: 'items required' }); const items = itemsSchema.parse((req.body as any).items); const order = await db.transaction(async tx => { await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('papeleria-folio'))`); const [{ n }] = await tx.select({ n: count() }).from(papeleriaOrders); const folio = `PAP-${String(Number(n) + 1).padStart(6, '0')}`; const [created] = await tx.insert(papeleriaOrders).values({ folio, user_id: req.user.id }).returning(); await insertOrderItems(tx, created.id, items); return created; }); await logAudit(req, 'papeleria.order.created', 'papeleria_order', order.id, { folio: order.folio, items: items.length }); return orderInclude(order); }
    catch (error) { if ((error as any)?.code === 'INVALID_STATE') return reply.code(400).send({ error: 'one or more items do not exist' }); if ((error as Error)?.name === 'ZodError') return reply.code(400).send({ error: 'invalid items' }); return parseError(error, reply); }
  });
  app.get('/api/papeleria/orders/:id', { preHandler: guarded }, async (req, reply) => {
    try { const id = idParams.parse(req.params).id; const order = await papeleriaOrderRepository.findById(db, id); if (!order) return reply.code(404).send({ error: 'not found' }); if (req.user.role !== 'admin' && order.user_id !== req.user.id) return reply.code(403).send({ error: 'forbidden' }); return orderInclude(order); }
    catch (error) { return parseError(error, reply); }
  });
  app.put('/api/papeleria/orders/:id', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    try { const id = idParams.parse(req.params).id; const parsed = z.object({ items: itemsSchema.optional() }).parse(req.body); const result = await db.transaction(async tx => { const order = await papeleriaOrderRepository.findById(tx, id); if (!order) throw Object.assign(new Error('missing'), { code: 'NOT_FOUND' }); if (order.status === 'CLOSED') throw Object.assign(new Error('closed'), { code: 'INVALID_STATE' }); if (parsed.items) { await tx.delete(papeleriaOrderItems).where(eq(papeleriaOrderItems.order_id, id)); await insertOrderItems(tx, id, parsed.items); } return order; }); await logAudit(req, 'papeleria.order.updated', 'papeleria_order', id); return orderInclude(result); }
    catch (error) { if ((error as any)?.code === 'INVALID_STATE' && (error as Error).message === 'closed') return reply.code(400).send({ error: 'order closed' }); if ((error as any)?.code === 'INVALID_STATE') return reply.code(400).send({ error: 'one or more items do not exist' }); if ((error as Error)?.name === 'ZodError') return reply.code(400).send({ error: 'invalid items' }); return parseError(error, reply); }
  });
  app.post('/api/papeleria/orders/:id/close', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    try { const id = idParams.parse(req.params).id; const closed = await closeOrder(db, id, req.user.username); await logAudit(req, 'papeleria.order.closed', 'papeleria_order', id, { folio: closed.folio }); return orderInclude(closed); }
    catch (error) { if ((error as any)?.code === 'NOT_FOUND') return reply.code(404).send({ error: 'not found' }); if ((error as any)?.code === 'CONFLICT') return reply.code(400).send({ error: 'already closed' }); return parseError(error, reply); }
  });
  app.get('/api/papeleria', { preHandler: guarded }, async () => ({ items: await papeleriaRepository.listItems(db) }));
  app.post('/api/papeleria', { preHandler: [authenticate, adminOnly] }, async (req, reply) => { try { if (!(req.body as any)?.name) return reply.code(400).send({ error: 'name required' }); const body = itemBody.parse(req.body); const item = await papeleriaRepository.createItem(db, { name: body.name, unit: body.unit ?? null, quantity: body.quantity ?? 0 }); await logAudit(req, 'papeleria.item.created', 'papeleria_item', item.id, { name: item.name }); return item; } catch (e) { return parseError(e, reply); } });
  app.put('/api/papeleria/:id', { preHandler: [authenticate, adminOnly] }, async (req, reply) => { try { const id = idParams.parse(req.params).id; const body = itemBody.partial().parse(req.body); const item = await papeleriaRepository.updateItem(db, id, body); if (!item) return reply.code(404).send({ error: 'not found' }); await logAudit(req, 'papeleria.item.updated', 'papeleria_item', id, { name: item.name }); return item; } catch (e) { return parseError(e, reply); } });
  app.delete('/api/papeleria/:id', { preHandler: [authenticate, adminOnly] }, async (req, reply) => { try { const id = idParams.parse(req.params).id; if (!await papeleriaRepository.deleteItem(db, id)) return reply.code(404).send({ error: 'not found' }); await logAudit(req, 'papeleria.item.deleted', 'papeleria_item', id); return { ok: true }; } catch (e) { return parseError(e, reply); } });
  app.post('/api/papeleria/import', { preHandler: [authenticate, adminOnly] }, async (req: any, reply) => { const file = await req.file(); if (!file) return reply.code(400).send({ error: 'file required' }); let rows: any[]; try { rows = await readExcelRows(file); } catch { return reply.code(400).send({ error: 'invalid excel file' }); } let created = 0; const errors: string[] = []; for (let i = 0; i < rows.length; i++) { const row = rows[i]; const name = String(row.Nombre || row.nombre || row.Articulo || row.Artículo || row.name || '').trim(); const unit = String(row.Unidad || row.unidad || row.Unit || '').trim(); const qtyRaw = row.Cantidad || row.cantidad || row.Qty || row.qty || 0; if (!name) { errors.push(`Fila ${i + 2}: nombre vacío`); continue; } try { await papeleriaRepository.createItem(db, { name, unit: unit || null, quantity: Number(qtyRaw) || 0 }); created++; } catch (e: any) { errors.push(`Fila ${i + 2}: ${e.message || 'error'}`); } } await logAudit(req, 'papeleria.imported', 'papeleria_item', undefined, { created, total: rows.length, errors: errors.length }); return { created, total: rows.length, errors }; });
}
