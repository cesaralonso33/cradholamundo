import type { FastifyRequest } from "fastify";
import { prisma } from "./prisma.js";

export async function logAudit(
  req: any,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown> | string
) {
  try {
    const detailUsername =
      typeof details === "object" && details !== null && typeof (details as any).username === "string"
        ? (details as any).username
        : undefined;

    await prisma.auditLog.create({
      data: {
        user_id: req.user?.id || null,
        username: req.user?.username || detailUsername || req.body?.username || null,
        action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        details: typeof details === "string" ? details : details ? JSON.stringify(details) : null,
        ip: req.ip || null,
      },
    });
  } catch {
    // Never fail the request because of audit logging.
  }
}
