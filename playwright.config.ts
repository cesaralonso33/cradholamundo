import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:55900";
const backendURL = process.env.E2E_API_URL || "http://127.0.0.1:3300";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", ...devices["Desktop Chrome"] },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_EXTERNAL_SERVERS ? undefined : [
    { command: "npm run dev", url: `${backendURL}/health`, reuseExistingServer: !process.env.CI, timeout: 120_000, env: { ...process.env, ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? process.env.E2E_ADMIN_PASSWORD, PORT: new URL(backendURL).port, NODE_ENV: "test" } },
    { command: `npm exec vite -- --host 127.0.0.1 --port ${new URL(baseURL).port || "55900"}`, cwd: "frontend", url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000, env: { ...process.env, API_PROXY_TARGET: backendURL } },
  ],
});
