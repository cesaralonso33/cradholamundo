import { createHash, randomBytes } from "node:crypto";
import { db } from '../db/client.js';
import { settingsRepository } from '../db/repositories/index.js';

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  return `inv_${randomBytes(24).toString("hex")}`;
}

export async function validateApiKey(key: string): Promise<boolean> {
  const [enabled, storedHash] = await Promise.all([
    settingsRepository.get(db, 'api_enabled'),
    settingsRepository.get(db, 'api_key_hash'),
  ]);
  if (enabled?.value !== 'true' || !storedHash?.value) return false;
  return storedHash.value === hashApiKey(key);
}
