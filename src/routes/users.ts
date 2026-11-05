import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { authenticate, requirePermission } from "../lib/auth.js";
import { validatePassword } from "../lib/security.js";
import { logAudit } from "../lib/audit.js";

async function validateRole(role: string) {
  if (!role) return "role required";
  const exists = await prisma.role.findUnique({ where: { name: role }, select: { name: true } });
  if (!exists) return "role does not exist";
  return null;
}

export async function userRoutes(app: FastifyInstance) {
  app.get("/api/users", { preHandler: [authenticate, requirePermission("users")] }, async () => {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, email: true, role: true, created_at: true, updated_at: true },
      orderBy: { created_at: "desc" },
    });
    return { items: users };
  });

  app.put("/api/users/:id", { preHandler: [authenticate, requirePermission("users")] }, async (req, reply) => {
    const { id } = req.params as any;
    const { username, email, role, password } = (req.body as any) || {};
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "not found" });

    const newRole = String(role || user.role);
    const roleError = await validateRole(newRole);
    if (roleError) return reply.code(400).send({ error: roleError });
    if (newRole === "admin" && req.user.role !== "admin") {
      return reply.code(403).send({ error: "only admins can assign the admin role" });
    }

    if (user.role === "admin" && newRole !== "admin") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) return reply.code(400).send({ error: "cannot demote the last admin" });
    }

    const data: any = {
      username: username ? String(username).trim() : user.username,
      email: email !== undefined ? email || null : user.email,
      role: newRole,
    };

    if (password) {
      const passwordError = validatePassword(password);
      if (passwordError) return reply.code(400).send({ error: passwordError });
      data.password = await bcrypt.hash(password, 10);
    }

    try {
      const updated = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, username: true, email: true, role: true, created_at: true, updated_at: true },
      });
      await logAudit(req, "user.updated", "user", id, { username: updated.username, role: updated.role });
      return updated;
    } catch (error: any) {
      if (error.code === "P2002") return reply.code(409).send({ error: "username or email already exists" });
      throw error;
    }
  });

  app.delete("/api/users/:id", { preHandler: [authenticate, requirePermission("users")] }, async (req, reply) => {
    const { id } = req.params as any;
    if (req.user.id === id) return reply.code(400).send({ error: "cannot delete yourself" });

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return reply.code(404).send({ error: "not found" });

    if (user.role === "admin") {
      const admins = await prisma.user.count({ where: { role: "admin" } });
      if (admins <= 1) return reply.code(400).send({ error: "cannot delete the last admin" });
    }

    try {
      await prisma.user.delete({ where: { id } });
      await logAudit(req, "user.deleted", "user", id, { username: user.username });
      return { ok: true };
    } catch (error: any) {
      if (error.code === "P2003") {
        return reply.code(400).send({ error: "user has related records (orders); cannot delete" });
      }
      return reply.code(404).send({ error: "not found" });
    }
  });
}
