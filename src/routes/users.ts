import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userRepository, roleRepository } from '../db/repositories/index.js';
import { users } from '../db/schema.js';
import { authenticate, requirePermission } from '../lib/auth.js';
import { validatePassword } from '../lib/security.js';
import { logAudit } from '../lib/audit.js';
import { toHttpError } from '../lib/errors.js';
import { z } from 'zod';

const idSchema = z.object({ id: z.string().min(1) });
const updateSchema = z.object({ username: z.string().optional(), email: z.string().nullable().optional(), role: z.string().optional(), password: z.string().optional() });

export async function userRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); });
  app.get('/api/users', { preHandler: [authenticate, requirePermission('users')] }, async () => ({ items: await userRepository.list(db) }));

  app.put('/api/users/:id', { preHandler: [authenticate, requirePermission('users')] }, async (req, reply) => {
    const params = idSchema.safeParse(req.params); const body = updateSchema.safeParse(req.body || {});
    if (!params.success || !body.success) return reply.code(400).send({ error: 'invalid input' });
    const { id } = params.data; const { username, email, role, password } = body.data;
    const initial = await userRepository.findById(db, id);
    if (!initial) return reply.code(404).send({ error: 'not found' });
    const newRole = String(role || initial.role);
    if (!(await roleRepository.findByName(db, newRole))) return reply.code(400).send({ error: 'role does not exist' });
    if (newRole === 'admin' && req.user.role !== 'admin') return reply.code(403).send({ error: 'only admins can assign the admin role' });
    const data: Partial<typeof users.$inferInsert> = { username: username ? String(username).trim() : initial.username, email: email !== undefined ? email || null : initial.email, role: newRole };
    if (password) { const error = validatePassword(password); if (error) return reply.code(400).send({ error }); data.password = await bcrypt.hash(password, 10); }
    try {
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(1748362841)`);
        const user = await userRepository.findById(tx, id);
        if (!user) return null;
        if (user.role === 'admin' && newRole !== 'admin' && await userRepository.countByRole(tx, 'admin') <= 1) return 'last-admin' as const;
        return (await tx.update(users).set(data).where(eq(users.id, id)).returning({ id: users.id, username: users.username, email: users.email, role: users.role, created_at: users.created_at, updated_at: users.updated_at }))[0] ?? null;
      });
      if (result === 'last-admin') return reply.code(400).send({ error: 'cannot demote the last admin' });
      if (!result) return reply.code(404).send({ error: 'not found' });
      await logAudit(req, 'user.updated', 'user', id, { username: result.username, role: result.role });
      return result;
    } catch (error: any) { if (error.code === '23505' || error.cause?.code === '23505') return reply.code(409).send({ error: 'username or email already exists' }); throw error; }
  });

  app.delete('/api/users/:id', { preHandler: [authenticate, requirePermission('users')] }, async (req, reply) => {
    const parsed = idSchema.safeParse(req.params); if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const { id } = parsed.data;
    if (req.user.id === id) return reply.code(400).send({ error: 'cannot delete yourself' });
    const user = await userRepository.findById(db, id); if (!user) return reply.code(404).send({ error: 'not found' });
    try {
      const deleted = await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(1748362841)`);
        const current = await userRepository.findById(tx, id);
        if (!current) return { kind: 'missing' as const };
        if (current.role === 'admin' && await userRepository.countByRole(tx, 'admin') <= 1) return { kind: 'last-admin' as const };
        const row = await userRepository.delete(tx, id);
        return row ? { kind: 'deleted' as const, username: current.username } : { kind: 'missing' as const };
      });
      if (deleted.kind === 'missing') return reply.code(404).send({ error: 'not found' });
      if (deleted.kind === 'last-admin') return reply.code(400).send({ error: 'cannot delete the last admin' });
      await logAudit(req, 'user.deleted', 'user', id, { username: deleted.username });
      return { ok: true };
    } catch (error: any) { if (error.code === '23503' || error.cause?.code === '23503') return reply.code(400).send({ error: 'user has related records (orders); cannot delete' }); throw error; }
  });
}
