import { db } from '../db/client.js';
import { settingsRepository } from '../db/repositories/index.js';

const cache = new Map<string, string>();
let loaded = false;

async function ensureLoaded() {
  if (!loaded) {
    const rows = await settingsRepository.getAll(db);
    rows.forEach((r) => cache.set(r.key, r.value));
    loaded = true;
  }
}

export async function getSetting(key: string): Promise<string | undefined> {
  await ensureLoaded();
  return cache.get(key);
}

export async function getSettings(): Promise<Record<string, string>> {
  await ensureLoaded();
  return Object.fromEntries(cache);
}

export function setSettingCache(key: string, value: string) {
  cache.set(key, value);
  loaded = true;
}

export function invalidateSettingsCache() {
  cache.clear();
  loaded = false;
}
