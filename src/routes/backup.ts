import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { backupRepository } from '../db/repositories/index.js';
import { authenticate, adminOnly } from '../lib/auth.js';
import { logAudit } from '../lib/audit.js';
import { invalidateSettingsCache } from '../lib/settings.js';
import { toHttpError } from '../lib/errors.js';

const backupSchema = z.object({ meta: z.object({ app: z.literal('inventario'), version: z.literal(1) }).passthrough().optional(), data: z.record(z.string(), z.array(z.record(z.string(), z.unknown())).default([])) });

export async function backupRoutes(app: FastifyInstance) {
  app.get('/api/backup', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const query = z.object({ includeSensitive: z.enum(['true', 'false']).default('false') }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid input' });
    const includeSensitive = query.data.includeSensitive === 'true';
    const data = await backupRepository.exportAll(undefined, { includeSensitiveUserData: includeSensitive });
    await logAudit(req, 'backup.exported', 'backup', undefined, { includeSensitive });
    return { meta: { app: 'inventario', version: 1, exported_at: new Date().toISOString() }, data };
  });

  app.post('/api/backup/restore', { preHandler: [authenticate, adminOnly], bodyLimit: 50 * 1024 * 1024 }, async (req, reply) => {
    const parsed = backupSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid backup file' });
    const data = parsed.data.data;
    try {
      await backupRepository.restore(data);
      invalidateSettingsCache();
      await logAudit(req, 'backup.restored', 'backup');
      return { ok: true, restored_at: new Date().toISOString() };
    } catch (error) {
      const mapped = toHttpError(error);
      if (mapped.statusCode === 500) app.log.error(error);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });
}
