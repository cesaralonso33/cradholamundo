import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
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
    const user = await userRepository.findById(db, id);
    if (!user) return reply.code(404).send({ error: 'not found' });
    const newRole = String(role || user.role);
    if (!(await roleRepository.findByName(db, newRole))) return reply.code(400).send({ error: 'role does not exist' });
    if (newRole === 'admin' && req.user.role !== 'admin') return reply.code(403).send({ error: 'only admins can assign the admin role' });
    if (user.role === 'admin' && newRole !== 'admin' && await userRepository.countByRole(db, 'admin') <= 1) return reply.code(400).send({ error: 'cannot demote the last admin' });
    const data: Partial<typeof users.$inferInsert> = { username: username ? String(username).trim() : user.username, email: email !== undefined ? email || null : user.email, role: newRole };
    if (password) { const error = validatePassword(password); if (error) return reply.code(400).send({ error }); data.password = await bcrypt.hash(password, 10); }
    try {
      const updated = await db.update(users).set(data).where(eq(users.id, id)).returning({ id: users.id, username: users.username, email: users.email, role: users.role, created_at: users.created_at, updated_at: users.updated_at });
      const result = updated[0];
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
    if (user.role === 'admin' && await userRepository.countByRole(db, 'admin') <= 1) return reply.code(400).send({ error: 'cannot delete the last admin' });
    try {
      await userRepository.delete(db, id);
      await logAudit(req, 'user.deleted', 'user', id, { username: user.username });
      return { ok: true };
    } catch (error: any) { if (error.code === '23503' || error.cause?.code === '23503') return reply.code(400).send({ error: 'user has related records (orders); cannot delete' }); return reply.code(404).send({ error: 'not found' }); }
  });
}
