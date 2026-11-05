import { auditRepository } from '../db/repositories/index.js';
import type { Database } from '../db/client.js';

export const listAuditLogs = (database: Database, filters: Parameters<typeof auditRepository.list>[1] = {}) => auditRepository.list(database, filters);
export const recordAuditEvent = (database: Database, event: Parameters<typeof auditRepository.create>[1]) => auditRepository.create(database, event);
