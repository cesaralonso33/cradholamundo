import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { adminOnly, authenticate, requirePermission } from "../lib/auth.js";
import { ALL_PERMISSIONS, PERMISSIONS, isValidPermission } from "../lib/permissions.js";
import { logAudit } from "../lib/audit.js";

function sanitizePermissions(input: any): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((p) => typeof p === "string" && isValidPermission(p)))];
}

export async function roleRoutes(app: FastifyInstance) {
  app.get("/api/permissions", { preHandler: [authenticate, adminOnly] }, async () => {
    return { items: PERMISSIONS };
  });

  app.get("/api/roles/options", { preHandler: [authenticate, requirePermission("users")] }, async () => {
    const roles = await prisma.role.findMany({
      select: { name: true, description: true },
      orderBy: { name: "asc" },
    });
    return { items: roles };
  });

  app.get("/api/roles", { preHandler: [authenticate, adminOnly] }, async () => {
    const [roles, counts] = await Promise.all([
      prisma.role.findMany({ orderBy: { created_at: "asc" } }),
      prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    ]);
    const countMap = new Map(counts.map((c) => [c.role, c._count._all]));
    return {
      items: roles.map((role) => ({
        ...role,
        user_count: countMap.get(role.name) || 0,
        is_system: role.name === "admin",
      })),
    };
  });

  app.post("/api/roles", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const body = (req.body as any) || {};
    const name = String(body.name || "").trim().toLowerCase();
    if (!name) return reply.code(400).send({ error: "name required" });
    if (!/^[a-z0-9_-]+$/.test(name)) {
      return reply.code(400).send({ error: "name only allows letters, numbers, _ and -" });
    }
    const permissions = name === "admin" ? [...ALL_PERMISSIONS] : sanitizePermissions(body.permissions);
    try {
      const role = await prisma.role.create({
        data: { name, description: body.description || null, permissions },
      });
      await logAudit(req, "role.created", "role", role.id, { name, permissions });
      return role;
    } catch (error: any) {
      if (error.code === "P2002") return reply.code(409).send({ error: "role already exists" });
      throw error;
    }
  });

  app.put("/api/roles/:id", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    const body = (req.body as any) || {};
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return reply.code(404).send({ error: "not found" });

    const isSystem = role.name === "admin";
    const newName = isSystem ? role.name : String(body.name || role.name).trim().toLowerCase();
    if (!isSystem && !/^[a-z0-9_-]+$/.test(newName)) {
      return reply.code(400).send({ error: "invalid role name" });
    }
    const permissions = isSystem || newName === "admin" ? [...ALL_PERMISSIONS] : sanitizePermissions(body.permissions);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.role.update({
          where: { id },
          data: { name: newName, description: body.description ?? role.description, permissions },
        });
        if (newName !== role.name) {
          await tx.user.updateMany({ where: { role: role.name }, data: { role: newName } });
        }
        return result;
      });
      await logAudit(req, "role.updated", "role", id, { name: updated.name, permissions: updated.permissions });
      return updated;
    } catch (error: any) {
      if (error.code === "P2002") return reply.code(409).send({ error: "role already exists" });
      throw error;
    }
  });

  app.delete("/api/roles/:id", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { id } = req.params as any;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return reply.code(404).send({ error: "not found" });
    if (role.name === "admin") return reply.code(400).send({ error: "admin role cannot be deleted" });
    const users = await prisma.user.count({ where: { role: role.name } });
    if (users > 0) return reply.code(400).send({ error: "role is assigned to users" });
    await prisma.role.delete({ where: { id } });
    await logAudit(req, "role.deleted", "role", id, { name: role.name });
    return { ok: true };
  });
}
