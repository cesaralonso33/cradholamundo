import type { FastifyRequest } from "fastify";
import { db } from '../db/client.js';
import { auditRepository } from '../db/repositories/index.js';

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

    await auditRepository.create(db, {
        user_id: req.user?.id || null,
        username: req.user?.username || detailUsername || req.body?.username || null,
        action,
        entity_type: entityType || null,
        entity_id: entityId || null,
        details: typeof details === "string" ? details : details ? JSON.stringify(details) : null,
        ip: req.ip || null,
    });
  } catch {
    // Never fail the request because of audit logging.
  }
}
