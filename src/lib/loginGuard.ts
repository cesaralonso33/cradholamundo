import { prisma } from "./prisma.js";

const MAX_FAILURES = Math.max(1, Number(process.env.LOGIN_MAX_FAILURES) || 4);
const BLOCK_MINUTES = Math.max(1, Number(process.env.LOGIN_BLOCK_MINUTES) || 15);

export function loginIdentifiers(ip: string | undefined, username?: string): string[] {
  const identifiers = [`ip:${ip || "unknown"}`];
  if (username) identifiers.push(`user:${username.toLowerCase()}`);
  return identifiers;
}

export async function getActiveBlock(identifiers: string[]) {
  const now = new Date();
  const attempts = await prisma.loginAttempt.findMany({
    where: { identifier: { in: identifiers } },
  });
  const blocked = attempts.find((attempt) => attempt.blocked_until && attempt.blocked_until > now);
  if (!blocked) return null;

  for (const attempt of attempts) {
    if (attempt.blocked_until && attempt.blocked_until <= now) {
      await prisma.loginAttempt.update({
        where: { identifier: attempt.identifier },
        data: { failures: 0, blocked_until: null },
      });
    }
  }

  return { until: blocked.blocked_until as Date, retryAfterSeconds: Math.ceil((blocked.blocked_until!.getTime() - now.getTime()) / 1000) };
}

export async function registerLoginFailure(identifiers: string[]) {
  let shouldBlock = false;
  for (const identifier of identifiers) {
    const attempt = await prisma.loginAttempt.upsert({
      where: { identifier },
      update: { failures: { increment: 1 }, last_attempt: new Date() },
      create: { identifier, failures: 1, last_attempt: new Date() },
    });
    if (attempt.failures >= MAX_FAILURES) {
      await prisma.loginAttempt.update({
        where: { identifier },
        data: { blocked_until: new Date(Date.now() + BLOCK_MINUTES * 60_000) },
      });
      shouldBlock = true;
    }
  }
  return shouldBlock;
}

export async function clearLoginFailures(identifiers: string[]) {
  await prisma.loginAttempt.deleteMany({ where: { identifier: { in: identifiers } } });
}

export { MAX_FAILURES, BLOCK_MINUTES };
