import { afterEach, describe, expect, it } from "vitest";
import { useAuth } from "./auth";

describe("session permissions", () => {
  afterEach(() => useAuth().setUser(null));

  it("allows admin and only explicitly granted capabilities", () => {
    const auth = useAuth();
    auth.setUser({ id: "1", username: "person", role: "user", permissions: ["products"] });
    expect(auth.hasPermission("products")).toBe(true);
    expect(auth.hasPermission("settings")).toBe(false);
    auth.setUser({ id: "2", username: "admin", role: "admin", permissions: [] });
    expect(auth.hasPermission("settings")).toBe(true);
  });
});
