import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { loginAttempts } from '../db/schema.js';

const MAX_FAILURES = Math.max(1, Number(process.env.LOGIN_MAX_FAILURES) || 4);
const BLOCK_MINUTES = Math.max(1, Number(process.env.LOGIN_BLOCK_MINUTES) || 15);

export function loginIdentifiers(ip: string | undefined, username?: string): string[] {
  const identifiers = [`ip:${ip || "unknown"}`];
  if (username) identifiers.push(`user:${username.toLowerCase()}`);
  return identifiers;
}

export async function getActiveBlock(identifiers: string[]) {
  const now = new Date();
  const attempts = await db.select().from(loginAttempts).where(inArray(loginAttempts.identifier, identifiers));
  const blocked = attempts.find((attempt) => attempt.blocked_until && attempt.blocked_until > now);
  if (!blocked) return null;

  for (const attempt of attempts) {
    if (attempt.blocked_until && attempt.blocked_until <= now) {
      await db.update(loginAttempts).set({ failures: 0, blocked_until: null }).where(eq(loginAttempts.identifier, attempt.identifier));
    }
  }

  return { until: blocked.blocked_until as Date, retryAfterSeconds: Math.ceil((blocked.blocked_until!.getTime() - now.getTime()) / 1000) };
}

export async function registerLoginFailure(identifiers: string[]) {
  let shouldBlock = false;
  for (const identifier of identifiers) {
    const attempt = (await db.insert(loginAttempts).values({ identifier, failures: 1, last_attempt: new Date() }).onConflictDoUpdate({ target: loginAttempts.identifier, set: { failures: sql`${loginAttempts.failures} + 1`, last_attempt: new Date() } }).returning())[0];
    if (attempt.failures >= MAX_FAILURES) {
      await db.update(loginAttempts).set({ blocked_until: new Date(Date.now() + BLOCK_MINUTES * 60_000) }).where(eq(loginAttempts.identifier, identifier));
      shouldBlock = true;
    }
  }
  return shouldBlock;
}

export async function clearLoginFailures(identifiers: string[]) {
  await db.delete(loginAttempts).where(inArray(loginAttempts.identifier, identifiers));
}

export { MAX_FAILURES, BLOCK_MINUTES };
