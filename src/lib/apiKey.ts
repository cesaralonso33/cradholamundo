import { createHash, randomBytes } from "node:crypto";
import { getSetting } from "./settings.js";

export function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  return `inv_${randomBytes(24).toString("hex")}`;
}

export async function validateApiKey(key: string): Promise<boolean> {
  const enabled = await getSetting("api_enabled");
  if (enabled !== "true") return false;
  const storedHash = await getSetting("api_key_hash");
  if (!storedHash) return false;
  return storedHash === hashApiKey(key);
}
