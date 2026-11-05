import { afterEach, describe, expect, it, vi } from "vitest";
import { apiCreateProduct } from "./api";

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
});
