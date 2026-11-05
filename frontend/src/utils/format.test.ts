import { describe, expect, it } from "vitest";
import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("formats a valid date", () => {
    const result = formatDateTime("2026-01-01T00:00:00.000Z");
    expect(result).not.toBe("-");
  });

  it("returns dash for invalid input", () => {
    expect(formatDateTime("not-a-date")).toBe("-");
  });
});
