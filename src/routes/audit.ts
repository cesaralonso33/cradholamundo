import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { auditRepository } from '../db/repositories/index.js';
import { authenticate, adminOnly } from '../lib/auth.js';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  action: z.string().trim().max(100).optional(),
  username: z.string().trim().max(100).optional(),
  entityType: z.string().trim().max(100).optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/audit-logs', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const { page, pageSize, action, username, entityType } = parsed.data;
    return auditRepository.list(db, { page, pageSize, action, username, entityType });
  });
}
