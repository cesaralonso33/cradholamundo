import { backupRepository } from '../db/repositories/index.js';
import type { Database } from '../db/client.js';

export const exportBackup = (database: Database) => backupRepository.exportAll(database);
