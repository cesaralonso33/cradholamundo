import "dotenv/config";
import { buildApp } from "./app.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT) || 3000;
const app = await buildApp();

const loginAttemptCleanup = setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.loginAttempt.deleteMany({ where: { last_attempt: { lt: cutoff } } });
  } catch {
    // Ignore cleanup errors.
  }
}, 60 * 60 * 1000);
loginAttemptCleanup.unref();

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down...`);
  clearInterval(loginAttemptCleanup);
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Server listening on port ${port}`);
} catch (error) {
  app.log.error(error);
  await prisma.$disconnect();
  process.exit(1);
}
