import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { adminOnly, authenticate, requirePermission } from "../lib/auth.js";
import { generateApiKey, hashApiKey } from "../lib/apiKey.js";
import { getSettings, invalidateSettingsCache, setSettingCache } from "../lib/settings.js";
import { logAudit } from "../lib/audit.js";

async function saveSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  setSettingCache(key, value);
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get("/api/settings", { preHandler: [authenticate, requirePermission("settings")] }, async () => getSettings());

  app.put("/api/settings", { preHandler: [authenticate, requirePermission("settings")] }, async (req, reply) => {
    const { key, value } = (req.body as any) || {};
    if (!key) return reply.code(400).send({ error: "key required" });
    await saveSetting(key, String(value));
    await logAudit(req, "setting.updated", "setting", undefined, { key });
    return { ok: true };
  });

  // ---- API key configuration (admin) ----
  app.get("/api/settings/api-key", { preHandler: [authenticate, adminOnly] }, async () => {
    const settings = await getSettings();
    return {
      enabled: settings.api_enabled === "true",
      prefix: settings.api_key_prefix || null,
      hasKey: Boolean(settings.api_key_hash),
    };
  });

  app.post("/api/settings/api-key", { preHandler: [authenticate, adminOnly] }, async (req) => {
    const apiKey = generateApiKey();
    await saveSetting("api_key_hash", hashApiKey(apiKey));
    await saveSetting("api_key_prefix", apiKey.slice(0, 12));
    await saveSetting("api_enabled", "true");
    await logAudit(req, "api_key.generated", "setting", undefined, { prefix: apiKey.slice(0, 12) });
    return { apiKey, prefix: apiKey.slice(0, 12) };
  });

  app.delete("/api/settings/api-key", { preHandler: [authenticate, adminOnly] }, async (req) => {
    await prisma.setting.deleteMany({ where: { key: { in: ["api_key_hash", "api_key_prefix"] } } });
    invalidateSettingsCache();
    await logAudit(req, "api_key.revoked", "setting");
    return { ok: true };
  });

  app.put("/api/settings/api-enabled", { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const { enabled } = (req.body as any) || {};
    if (typeof enabled !== "boolean") return reply.code(400).send({ error: "enabled boolean required" });
    await saveSetting("api_enabled", enabled ? "true" : "false");
    await logAudit(req, "api.enabled", "setting", undefined, { enabled });
    return { ok: true, enabled };
  });
}
