import "dotenv/config";
import { buildApp } from "./app.js";
import { pool } from "./db/client.js";
import { loginAttemptRepository } from "./db/repositories/index.js";

const port = Number(process.env.PORT) || 3000;
const app = await buildApp();

const loginAttemptCleanup = setInterval(async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await loginAttemptRepository.deleteBefore(cutoff);
  } catch {
    // Ignore cleanup errors.
  }
}, 60 * 60 * 1000);
loginAttemptCleanup.unref();

async function shutdown(signal: string) {
  app.log.info(`Received ${signal}, shutting down...`);
  clearInterval(loginAttemptCleanup);
  await app.close();
  await pool.end();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Server listening on port ${port}`);
} catch (error) {
  app.log.error(error);
  await pool.end();
  process.exitCode = 1;
}
