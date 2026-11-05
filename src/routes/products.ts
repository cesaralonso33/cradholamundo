import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { locationHistoryRepository, productRepository, settingsRepository } from '../db/repositories/index.js';
import { recordMovement } from '../services/inventory.js';
import { adminOnly, authenticate, requirePermission } from '../lib/auth.js';
import { logAudit } from '../lib/audit.js';
import { toHttpError } from '../lib/errors.js';

const skuParams = z.object({ sku: z.string().min(1) });
const pageQuery = z.object({ page: z.coerce.number().finite().optional(), pageSize: z.coerce.number().finite().optional(), search: z.string().optional(), q: z.string().optional() });
const createBody = z.object({ sku: z.string().min(1), name: z.string().min(1), category: z.string().nullable().optional(), quantity: z.coerce.number().finite().optional() });
const updateBody = z.object({ name: z.string().min(1), category: z.string().nullable().optional(), quantity: z.coerce.number().finite().optional() });
const movementBody = z.object({ sku: z.string().min(1), type: z.string(), quantity: z.coerce.number().finite(), note: z.string().nullable().optional() });
const parse = <T>(schema: z.ZodType<T>, value: unknown): T => schema.parse(value);
const quantity = (n: number | undefined) => n == null ? 0 : Math.max(0, Math.floor(n || 0));

export async function productRoutes(app: FastifyInstance) {
  const guarded = [authenticate, requirePermission('products')];
  app.post('/api/products', { preHandler: guarded }, async (req, reply) => {
    try {
      const parsed = createBody.safeParse(req.body);
      if (!parsed.success && (!(req.body as any)?.sku || !(req.body as any)?.name)) return reply.code(400).send({ error: 'sku and name are required' });
      const { sku, name, category, quantity: requested } = parse(createBody, req.body);
      const location = req.user.username;
      const [existing, duplicateSetting] = await Promise.all([productRepository.findBySku(db, sku), settingsRepository.get(db, 'prevent_duplicates')]);
      if (duplicateSetting?.value === 'true' && existing) return reply.code(409).send({ error: 'SKU already captured (duplicate rule enabled)' });
      const product = await productRepository.saveBySku(db, { sku, name, category: category ?? null, location, quantity: quantity(requested), min_stock: 0 });
      if (!existing || existing.location !== location) await locationHistoryRepository.create(db, { product_id: product.id, from_location: existing?.location ?? null, to_location: location, changed_by: req.user.username });
      await logAudit(req, existing ? 'product.updated' : 'product.created', 'product', product.id, { sku, name, location });
      return product;
    } catch (error) { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.post('/api/products/:sku/archive', { preHandler: guarded }, async (req, reply) => {
    try {
      const { sku } = parse(skuParams, req.params); const product = await productRepository.findBySku(db, sku);
      if (!product) return reply.code(404).send({ error: 'not found' });
      if (req.user.role !== 'admin' && product.location !== req.user.username) return reply.code(403).send({ error: 'forbidden' });
      const updated = await db.transaction(async tx => {
        const row = await productRepository.updateBySku(tx, sku, { location: 'Archivo' });
        await locationHistoryRepository.create(tx, { product_id: product.id, from_location: product.location, to_location: 'Archivo', changed_by: req.user.username }); return row;
      });
      await logAudit(req, 'product.archived', 'product', product.id, { sku, from: product.location, to: 'Archivo' }); return updated;
    } catch (error) { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.put('/api/products/:sku', { preHandler: guarded }, async (req, reply) => {
    try {
      const { sku } = parse(skuParams, req.params);
      if (!(req.body as any)?.name) return reply.code(400).send({ error: 'name required' });
      const { name, category, quantity: requested } = parse(updateBody, req.body);
      const product = await productRepository.findBySku(db, sku); if (!product) return reply.code(404).send({ error: 'not found' });
      if (req.user.role !== 'admin' && product.location !== req.user.username) return reply.code(403).send({ error: 'forbidden' });
      const updated = await productRepository.updateBySku(db, sku, { name: name.trim(), category: category ? category.trim() : null, quantity: requested != null ? quantity(requested) : product.quantity });
      await logAudit(req, 'product.edited', 'product', updated.id, { sku, name: updated.name, quantity: updated.quantity }); return updated;
    } catch (error) { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
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
    try { const { sku } = parse(skuParams, req.params); const product = await productRepository.findBySku(db, sku); if (!product) return reply.code(404).send({ error: 'not found' }); await productRepository.deleteBySku(db, sku); await logAudit(req, 'product.deleted', 'product', product.id, { sku }); return { ok: true }; }
    catch (error) { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
  app.post('/api/inventory/movement', { preHandler: guarded }, async (req, reply) => {
    try { const value = req.body as any; if (!value?.sku || !value?.type || value?.quantity == null) return reply.code(400).send({ error: 'sku, type, quantity required' }); const input = parse(movementBody, req.body); const type = input.type.toUpperCase(); if (type !== 'IN' && type !== 'OUT') return reply.code(400).send({ error: 'type must be IN or OUT' }); if (input.quantity <= 0) return reply.code(400).send({ error: 'quantity must be positive' }); const result = await recordMovement(db, { ...input, type }); await logAudit(req, 'inventory.movement', 'product', result.product.id, { sku: input.sku, type, quantity: input.quantity }); return result; }
    catch (error) { if ((error as { code?: string }).code === 'NOT_FOUND') return reply.code(404).send({ error: 'product not found' }); if ((error as { code?: string }).code === 'INSUFFICIENT_STOCK') return reply.code(400).send({ error: 'invalid operation' }); const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); }
  });
}
