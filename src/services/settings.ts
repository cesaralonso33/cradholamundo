import { settingsRepository } from '../db/repositories/index.js';
import type { Database } from '../db/client.js';

export const getSettings = (database: Database) => settingsRepository.getAll(database);
export const getSetting = (database: Database, key: string) => settingsRepository.get(database, key);
export const saveSetting = (database: Database, key: string, value: string) => settingsRepository.set(database, key, value);
