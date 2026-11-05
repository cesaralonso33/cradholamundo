import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authenticate, adminOnly } from "../lib/auth.js";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/api/audit-logs", { preHandler: [authenticate, adminOnly] }, async (req) => {
    const query = req.query as any;
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
    const action = query.action ? String(query.action).trim() : undefined;
    const username = query.username ? String(query.username).trim() : undefined;
    const entityType = query.entityType ? String(query.entityType).trim() : undefined;

    const where: any = {};
    if (action) where.action = action;
    if (username) where.username = { contains: username, mode: "insensitive" };
    if (entityType) where.entity_type = entityType;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });
}
