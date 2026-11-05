import { buildApp } from "../src/app";
import { prisma } from "../src/lib/prisma";

describe("health endpoint", () => {
  it("returns ok when the database is available", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });
    await app.close();
    await prisma.$disconnect();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, backend: "up", database: "up" });
  });
});
