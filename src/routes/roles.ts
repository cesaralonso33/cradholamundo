import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { roleRepository, userRepository } from '../db/repositories/index.js';
import { roles, users } from '../db/schema.js';
import { adminOnly, authenticate, requirePermission } from '../lib/auth.js';
import { ALL_PERMISSIONS, PERMISSIONS, isValidPermission } from '../lib/permissions.js';
import { logAudit } from '../lib/audit.js';
import { toHttpError } from '../lib/errors.js';
import { z } from 'zod';

const idSchema = z.object({ id: z.string().min(1) });
const roleBodySchema = z.object({ name: z.string().optional(), description: z.string().nullable().optional(), permissions: z.array(z.string()).optional() });
function sanitizePermissions(input: unknown): string[] { return Array.isArray(input) ? [...new Set(input.filter((p): p is string => typeof p === 'string' && isValidPermission(p)))] : []; }

export async function roleRoutes(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => { const mapped = toHttpError(error); return reply.code(mapped.statusCode).send(mapped.body); });
  app.get('/api/permissions', { preHandler: [authenticate, adminOnly] }, async () => ({ items: PERMISSIONS }));
  app.get('/api/roles/options', { preHandler: [authenticate, requirePermission('users')] }, async () => ({ items: await db.select({ name: roles.name, description: roles.description }).from(roles).orderBy(roles.name) }));
  app.get('/api/roles', { preHandler: [authenticate, adminOnly] }, async () => {
    const [allRoles, counts] = await Promise.all([roleRepository.list(db), roleRepository.countsByRole(db)]);
    const countMap = new Map(counts.map((row) => [row.role, row.count]));
    return { items: allRoles.map((role) => ({ ...role, user_count: countMap.get(role.name) || 0, is_system: role.name === 'admin' })) };
  });
  app.post('/api/roles', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const parsed = roleBodySchema.safeParse(req.body || {}); if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const { name: givenName, description } = parsed.data; const name = String(givenName || '').trim().toLowerCase();
    if (!name) return reply.code(400).send({ error: 'name required' });
    if (!/^[a-z0-9_-]+$/.test(name)) return reply.code(400).send({ error: 'name only allows letters, numbers, _ and -' });
    const permissions = name === 'admin' ? [...ALL_PERMISSIONS] : sanitizePermissions(parsed.data.permissions);
    try { const role = await roleRepository.create(db, { name, description: description || null, permissions }); await logAudit(req, 'role.created', 'role', role.id, { name, permissions }); return role; }
    catch (error: any) { if (error.code === '23505' || error.cause?.code === '23505') return reply.code(409).send({ error: 'role already exists' }); throw error; }
  });
  app.put('/api/roles/:id', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const params = idSchema.safeParse(req.params); const parsed = roleBodySchema.safeParse(req.body || {});
    if (!params.success || !parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const { id } = params.data; const body = parsed.data; const role = await roleRepository.findById(db, id);
    if (!role) return reply.code(404).send({ error: 'not found' });
    const isSystem = role.name === 'admin'; const newName = isSystem ? role.name : String(body.name || role.name).trim().toLowerCase();
    if (!isSystem && !/^[a-z0-9_-]+$/.test(newName)) return reply.code(400).send({ error: 'invalid role name' });
    const permissions = isSystem || newName === 'admin' ? [...ALL_PERMISSIONS] : sanitizePermissions(body.permissions);
    try {
      const updated = await db.transaction(async (tx) => {
        const result = await tx.update(roles).set({ name: newName, description: body.description ?? role.description, permissions }).where(eq(roles.id, id)).returning();
        if (newName !== role.name) await userRepository.updateManyRole(tx, role.name, newName);
        return result[0];
      });
      await logAudit(req, 'role.updated', 'role', id, { name: updated.name, permissions: updated.permissions }); return updated;
    } catch (error: any) { if (error.code === '23505' || error.cause?.code === '23505') return reply.code(409).send({ error: 'role already exists' }); throw error; }
  });
  app.delete('/api/roles/:id', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const parsed = idSchema.safeParse(req.params); if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const role = await roleRepository.findById(db, parsed.data.id); if (!role) return reply.code(404).send({ error: 'not found' });
    if (role.name === 'admin') return reply.code(400).send({ error: 'admin role cannot be deleted' });
    if (await roleRepository.countUsers(db, role.name) > 0) return reply.code(400).send({ error: 'role is assigned to users' });
    await roleRepository.delete(db, role.id); await logAudit(req, 'role.deleted', 'role', role.id, { name: role.name }); return { ok: true };
  });
}
