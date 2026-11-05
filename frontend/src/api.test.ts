import { afterEach, describe, expect, it, vi } from "vitest";
import { apiCreateProduct, apiDownloadBackup } from "./api";

describe("HTTP client errors", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([401, 403, 409, 429, 500])("preserves status %i and API details", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Conflict", details: [{ field: "sku" }] }), {
      status,
      headers: status === 429 ? { "Retry-After": "15" } : undefined,
    })));
    let thrown: any;
    try { await apiCreateProduct({ sku: "X" }); } catch (error) { thrown = error; }
    expect(thrown.status).toBe(status);
    expect(thrown.message).toBe("Conflict");
    expect(thrown.details).toEqual([{ field: "sku" }]);
    expect(thrown.retryAfter).toBe(status === 429 ? "15" : undefined);
  });

  it("uses the same-origin API in the production browser", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await apiCreateProduct({ sku: "X" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/products");
  });
});

describe("backup downloads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests sensitive backup data only when explicitly requested", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response("{}", { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    await apiDownloadBackup();
    await apiDownloadBackup(true);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/backup");
    expect(fetchMock.mock.calls[0][0]).not.toContain("includeSensitive");
    expect(fetchMock.mock.calls[1][0]).toContain("includeSensitive=true");
  });
});
