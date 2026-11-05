import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { settings } from '../db/schema.js';
import { settingsRepository } from '../db/repositories/index.js';
import { db } from '../db/client.js';
import { adminOnly, authenticate, requirePermission } from '../lib/auth.js';
import { generateApiKey, hashApiKey } from '../lib/apiKey.js';
import { invalidateSettingsCache, setSettingCache } from '../lib/settings.js';
import { logAudit } from '../lib/audit.js';

const settingInput = z.object({ key: z.string().trim().min(1).max(100), value: z.union([z.string(), z.number(), z.boolean()]) });
const enabledInput = z.object({ enabled: z.boolean() });

async function saveSetting(key: string, value: string) {
  await settingsRepository.set(db, key, value);
  setSettingCache(key, value);
}

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/settings', { preHandler: [authenticate, requirePermission('settings')] }, async () => Object.fromEntries((await settingsRepository.getAll(db)).map(({ key, value }) => [key, value])));

  app.put('/api/settings', { preHandler: [authenticate, requirePermission('settings')] }, async (req, reply) => {
    const parsed = settingInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    const { key, value } = parsed.data;
    await saveSetting(key, String(value));
    await logAudit(req, 'setting.updated', 'setting', undefined, { key });
    return { ok: true };
  });

  app.get('/api/settings/api-key', { preHandler: [authenticate, adminOnly] }, async () => {
    const values = Object.fromEntries((await settingsRepository.getAll(db)).map(({ key, value }) => [key, value]));
    return { enabled: values.api_enabled === 'true', prefix: values.api_key_prefix || null, hasKey: Boolean(values.api_key_hash) };
  });

  app.post('/api/settings/api-key', { preHandler: [authenticate, adminOnly] }, async (req) => {
    const apiKey = generateApiKey();
    await db.transaction(async tx => {
      await settingsRepository.set(tx, 'api_key_hash', hashApiKey(apiKey));
      await settingsRepository.set(tx, 'api_key_prefix', apiKey.slice(0, 12));
      await settingsRepository.set(tx, 'api_enabled', 'true');
    });
    invalidateSettingsCache();
    await logAudit(req, 'api_key.generated', 'setting', undefined, { prefix: apiKey.slice(0, 12) });
    return { apiKey, prefix: apiKey.slice(0, 12) };
  });

  app.delete('/api/settings/api-key', { preHandler: [authenticate, adminOnly] }, async (req) => {
    await db.delete(settings).where(inArray(settings.key, ['api_key_hash', 'api_key_prefix']));
    invalidateSettingsCache();
    await logAudit(req, 'api_key.revoked', 'setting');
    return { ok: true };
  });

  app.put('/api/settings/api-enabled', { preHandler: [authenticate, adminOnly] }, async (req, reply) => {
    const parsed = enabledInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'invalid input' });
    await saveSetting('api_enabled', String(parsed.data.enabled));
    await logAudit(req, 'api.enabled', 'setting', undefined, { enabled: parsed.data.enabled });
    return { ok: true, enabled: parsed.data.enabled };
  });
}
