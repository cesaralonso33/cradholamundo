import { describe, expect, it, vi } from "vitest";
import { getStored, removeStored, setStored } from "./storage";

describe("safe browser storage", () => {
  it("does not throw when browser storage is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", { configurable: true, get: () => { throw new DOMException("blocked"); } });
    expect(() => getStored("user")).not.toThrow();
    expect(getStored("user")).toBeNull();
    expect(() => setStored("user", "{}")).not.toThrow();
    expect(() => removeStored("user")).not.toThrow();
    if (original) Object.defineProperty(window, "localStorage", original);
    else Reflect.deleteProperty(window, "localStorage");
    vi.restoreAllMocks();
  });
});
