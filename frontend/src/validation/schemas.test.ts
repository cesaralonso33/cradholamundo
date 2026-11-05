import { describe, expect, it } from "vitest";
import { employeeSchema, loginSchema, papeleriaSchema, productCaptureSchema, settingsSchema } from "./schemas";

describe("frontend form schemas", () => {
  it("requires a login password", () => expect(loginSchema.safeParse({ password: "" }).success).toBe(false));
  it("requires a SKU and product name", () => expect(productCaptureSchema.safeParse({ sku: " ", name: "" }).success).toBe(false));
  it("accepts the employee payload produced by the form", () => {
    const formPayload = { name: "Ana López", position: "Analista", email: "ana@example.com" };
    expect(employeeSchema.safeParse(formPayload).success).toBe(true);
  });
  it("requires an employee name", () => expect(employeeSchema.safeParse({ name: "", position: "", email: "" }).success).toBe(false));
  it("accepts zero initial stock but rejects negative stationery quantities", () => {
    expect(papeleriaSchema.safeParse({ name: "Papel", quantity: 0 }).success).toBe(true);
    expect(papeleriaSchema.safeParse({ name: "Papel", quantity: -1 }).success).toBe(false);
  });
  it("rejects a zero default inventory quantity in settings", () => expect(settingsSchema.safeParse({ quantity: 0, category: "" }).success).toBe(false));
});
