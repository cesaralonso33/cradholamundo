import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import jwt from "jsonwebtoken";

const api = process.env.E2E_API_URL;

describe.skipIf(!api)("live API security boundary (isolated deployment required)", () => {
  it("publishes the OpenAPI contract and standard hardening headers", async () => {
    const res = await fetch(`${api}/api/openapi.json`);
    expect(res.status).toBe(200);
    const contract = await res.json() as { paths: Record<string, unknown> };
    expect(contract.paths["/api/auth/login"]).toBeTruthy();
    expect(contract.paths["/api/backup/restore"]).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBeTruthy();
  });

  it("rejects unauthenticated privileged operations and malformed login input", async () => {
    const privateRes = await fetch(`${api}/api/settings`);
    expect([401, 403]).toContain(privateRes.status);
    const malformed = await fetch(`${api}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: { abuse: true } }),
    });
    expect(malformed.status).toBe(400);
  });

  it("sets an HttpOnly session cookie and rejects an expired JWT", async () => {
    const secret = process.env.JWT_SECRET;
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!secret || !password) return;
    const login = await fetch(`${api}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password }),
    });
    expect(login.status).toBe(200);
    expect(login.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    const expired = jwt.sign({ sub: "missing", username: "expired", role: "admin" }, secret, { expiresIn: -1 });
    const rejected = await fetch(`${api}/api/auth/me`, { headers: { cookie: `token=${expired}` } });
    expect(rejected.status).toBe(401);
  });

  it("returns Retry-After after repeated failed logins", async () => {
    const uniqueUser = `rate-${Date.now()}`;
    let last: Response | undefined;
    for (let i = 0; i < 5; i++) {
      last = await fetch(`${api}/api/auth/login`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: uniqueUser, password: "wrong-e2e-password" }),
      });
    }
    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("does not allow arbitrary cross-origin credentialed access", async () => {
    const res = await fetch(`${api}/api/auth/me`, { headers: { origin: "https://untrusted.invalid" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("contains no committed environment secret file", async () => {
    await expect(readFile(".env", "utf8")).rejects.toBeTruthy();
  });
});
