import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { auditRepository, backupRepository } from '../db/repositories/index.js';
import { db } from '../db/client.js';
import { authenticate, adminOnly } from '../lib/auth.js';
import { invalidateSettingsCache } from '../lib/settings.js';
import { toHttpError } from '../lib/errors.js';

const objectRows = z.array(z.record(z.string(), z.unknown()));
const backupDataSchema = z.object({
  settings: objectRows, users: objectRows,
  products: z.array(z.object({ id: z.string(), sku: z.string(), name: z.string(), quantity: z.number().int(), min_stock: z.number().int() }).passthrough()),
  movements: objectRows, locationHistory: objectRows, employees: objectRows, constancias: objectRows,
  papeleriaItems: objectRows, orders: objectRows, orderItems: objectRows,
}).strict();
const backupSchema = z.object({
  meta: z.object({ app: z.literal('inventario'), version: z.literal(1), includes_sensitive_user_data: z.boolean() }).passthrough(),
  data: backupDataSchema,
});
const userCredentialsSchema = z.array(z.object({ password: z.string().min(1), totp_secret: z.string().nullable() }).passthrough());

const auditEvent = (req: any, action: string, details?: Record<string, unknown>) => ({
  user_id: req.user?.id ?? null,
  username: req.user?.username ?? null,
  action,
  entity_type: 'backup',
  entity_id: null,
  details: details ? JSON.stringify(details) : null,
  ip: req.ip ?? null,
});

export async function backupRoutes(app: FastifyInstance) {
  app.get('/api/backup', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const query = z.object({ includeSensitive: z.enum(['true', 'false']).default('false') }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid input' });
    const includeSensitive = query.data.includeSensitive === 'true';
    const data = await db.transaction(async tx => {
      const exported = await backupRepository.exportAll(tx, { includeSensitiveUserData: includeSensitive });
      await auditRepository.create(tx, auditEvent(req, 'backup.exported', { includeSensitive }));
      return exported;
    });
    return { meta: { app: 'inventario', version: 1, exported_at: new Date().toISOString(), includes_sensitive_user_data: includeSensitive }, data };
  });

  app.post('/api/backup/restore', { preHandler: [authenticate, adminOnly], bodyLimit: 50 * 1024 * 1024 }, async (req, reply) => {
    const parsed = backupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid backup file' });
    if (!parsed.data.meta.includes_sensitive_user_data) {
      return reply.code(400).send({ error: 'backup excludes password and TOTP; export with includeSensitive=true to restore' });
    }
    const usersParsed = userCredentialsSchema.safeParse(parsed.data.data.users);
    if (!usersParsed.success) return reply.code(400).send({ error: 'invalid backup file' });
    const data = parsed.data.data;
    try {
      await backupRepository.restore(data, auditEvent(req, 'backup.restored'));
      invalidateSettingsCache();
      return { ok: true, restored_at: new Date().toISOString() };
    } catch (error) {
      const mapped = toHttpError(error);
      if (mapped.statusCode === 500) app.log.error(error);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });
}
