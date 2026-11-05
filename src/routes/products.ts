import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { auditRepository, locationHistoryRepository, productRepository, settingsRepository } from '../db/repositories/index.js';
import { recordMovement } from '../services/inventory.js';
import { adminOnly, authenticate, requirePermission } from '../lib/auth.js';
import { toHttpError } from '../lib/errors.js';
import { sql } from 'drizzle-orm';

const skuParams = z.object({ sku: z.string().min(1) });
const pageQuery = z.object({ page: z.coerce.number().finite().optional(), pageSize: z.coerce.number().finite().optional(), search: z.string().optional(), q: z.string().optional() });
const createBody = z.object({ sku: z.string().min(1), name: z.string().min(1), category: z.string().nullable().optional(), quantity: z.coerce.number().finite().optional() });
const updateBody = z.object({ name: z.string().min(1), category: z.string().nullable().optional(), quantity: z.coerce.number().finite().optional() });
const movementBody = z.object({ sku: z.string().min(1), type: z.string(), quantity: z.coerce.number().int().positive(), note: z.string().nullable().optional() });
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => schema.parse(value);
const quantity = (n: number | undefined) => n == null ? 0 : Math.max(0, Math.floor(n || 0));
const writeAudit = (executor: Parameters<Parameters<typeof db.transaction>[0]>[0], req: any, action: string, entityId: string, details: Record<string, unknown>) => auditRepository.create(executor, { user_id: req.user?.id ?? null, username: req.user?.username ?? null, action, entity_type: 'product', entity_id: entityId, details: JSON.stringify(details), ip: req.ip ?? null });

export async function productRoutes(app: FastifyInstance) {
  const guarded = [authenticate, requirePermission('products')];
  app.post('/api/products', { preHandler: guarded }, async (req, reply) => {
    try {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success && (!(req.body as any)?.sku || !(req.body as any)?.name)) return reply.code(400).send({ error: 'sku and name are required' });
      const { sku, name, category, quantity: requested } = parse(createBody, req.body);
      const location = req.user.username;
      const product = await db.transaction(async tx => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${sku}, 0))`);
        const [existing, duplicateSetting] = await Promise.all([productRepository.findBySku(tx, sku), settingsRepository.get(tx, 'prevent_duplicates')]);
        if (duplicateSetting?.value === 'true' && existing) throw Object.assign(new Error('duplicate sku'), { code: 'DUPLICATE_SKU' });
        const saved = await productRepository.saveBySku(tx, { sku, name, category: category ?? null, location, quantity: quantity(requested), min_stock: 0 });
        if (!existing || existing.location !== location) await locationHistoryRepository.create(tx, { product_id: saved.id, from_location: existing?.location ?? null, to_location: location, changed_by: req.user.username });
        await writeAudit(tx, req, existing ? 'product.updated' : 'product.created', saved.id, { sku, name, location });
        return saved;
      });
      return product;
    } catch (error) { if ((error as { code?: string }).code === 'DUPLICATE_SKU') return reply.code(409).send({ error: 'SKU already captured (duplicate rule enabled)' }); const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.post('/api/products/:sku/archive', { preHandler: guarded }, async (req, reply) => {
    try {
      const { sku } = parse(skuParams, req.params);
      const updated = await db.transaction(async tx => {
        const product = await productRepository.findBySkuForUpdate(tx, sku);
        if (!product) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
        if (req.user.role !== 'admin' && product.location !== req.user.username) throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
        if (product.location === 'Archivo') throw Object.assign(new Error('already archived'), { code: 'CONFLICT' });
        const row = await productRepository.updateBySku(tx, sku, { location: 'Archivo' });
        await locationHistoryRepository.create(tx, { product_id: product.id, from_location: product.location, to_location: 'Archivo', changed_by: req.user.username });
        await writeAudit(tx, req, 'product.archived', product.id, { sku, from: product.location, to: 'Archivo' });
        return row;
      });
      return updated;
    } catch (error) { const code = (error as { code?: string }).code; if (code === 'NOT_FOUND') return reply.code(404).send({ error: 'not found' }); if (code === 'FORBIDDEN') return reply.code(403).send({ error: 'forbidden' }); if (code === 'CONFLICT') return reply.code(409).send({ error: 'resource state conflict' }); const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.put('/api/products/:sku', { preHandler: guarded }, async (req, reply) => {
    try {
      const { sku } = parse(skuParams, req.params);
      if (!(req.body as any)?.name) return reply.code(400).send({ error: 'name required' });
      const { name, category, quantity: requested } = parse(updateBody, req.body);
      const updated = await db.transaction(async tx => {
        const product = await productRepository.findBySkuForUpdate(tx, sku);
        if (!product) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
        if (req.user.role !== 'admin' && product.location !== req.user.username) throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
        const saved = await productRepository.updateBySku(tx, sku, { name: name.trim(), category: category ? category.trim() : null, quantity: requested != null ? quantity(requested) : product.quantity });
        await writeAudit(tx, req, 'product.edited', saved.id, { sku, name: saved.name, quantity: saved.quantity });
        return saved;
      });
      return updated;
    } catch (error) { const code = (error as { code?: string }).code; if (code === 'NOT_FOUND') return reply.code(404).send({ error: 'not found' }); if (code === 'FORBIDDEN') return reply.code(403).send({ error: 'forbidden' }); const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.get('/api/products', { preHandler: guarded }, async (req, reply) => {
    try { const query = parse(pageQuery, req.query); return productRepository.list(db, { search: (query.search || query.q || '').trim(), location: req.user.role === 'admin' ? undefined : req.user.username, page: query.page, pageSize: query.pageSize }); }
    catch (error) { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.get('/api/products/:sku/history', { preHandler: guarded }, async (req, reply) => {
    try { const { sku } = parse(skuParams, req.params); const query = parse(pageQuery, req.query); const product = await productRepository.findBySku(db, sku); if (!product) return reply.code(404).send({ error: 'not found' }); return locationHistoryRepository.listForProduct(db, product.id, query.page, query.pageSize); }
    catch (error) { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.get('/api/products/:sku', { preHandler: guarded }, async (req, reply) => { try { const { sku } = parse(skuParams, req.params); const product = await productRepository.findBySku(db, sku); return product ?? reply.code(404).send({ error: 'not found' }); } catch (error) { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); } });
  app.delete('/api/products/:sku', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    try { const { sku } = parse(skuParams, req.params); await db.transaction(async tx => { const product = await productRepository.findBySkuForUpdate(tx, sku); if (!product) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' }); await productRepository.deleteBySku(tx, sku); await writeAudit(tx, req, 'product.deleted', product.id, { sku }); }); return { ok: true }; }
    catch (error) { if ((error as { code?: string }).code === 'NOT_FOUND') return reply.code(404).send({ error: 'not found' }); const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.post('/api/inventory/movement', { preHandler: guarded }, async (req, reply) => {
    try { const value = req.body as any; if (!value?.sku || !value?.type || value?.quantity == null) return reply.code(400).send({ error: 'sku, type, quantity required' }); if (Number(value.quantity) <= 0) return reply.code(400).send({ error: 'quantity must be positive' }); const parsed = movementBody.safeParse(req.body); if (!parsed.success) return reply.code(400).send({ error: 'quantity must be a positive integer' }); const input = parsed.data; const type = input.type.toUpperCase(); if (type !== 'IN' && type !== 'OUT') return reply.code(400).send({ error: 'type must be IN or OUT' }); const result = await recordMovement(db, { ...input, type }, async (tx, moved) => { await writeAudit(tx, req, 'inventory.movement', moved.product.id, { sku: input.sku, type, quantity: input.quantity }); }); return result; }
    catch (error) { if ((error as { code?: string }).code === 'NOT_FOUND') return reply.code(404).send({ error: 'product not found' }); if ((error as { code?: string }).code === 'INSUFFICIENT_STOCK') return reply.code(400).send({ error: 'invalid operation' }); const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
}
