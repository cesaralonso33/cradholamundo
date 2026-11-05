import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import InventoryMovementForm from "./InventoryMovementForm.vue";
import { inventoryMovementSchema } from "../validation/schemas";

const { apiMovement } = vi.hoisted(() => ({ apiMovement: vi.fn() }));
vi.mock("../api", () => ({ apiMovement }));

describe("inventory movement form", () => {
  beforeEach(() => apiMovement.mockReset());

  it("validates selected SKU, movement type, positive integer quantity, and optional note", () => {
    expect(inventoryMovementSchema.safeParse({ sku: "SKU-1", type: "OUT", quantity: 2, note: "" }).success).toBe(true);
    for (const quantity of [0, -1, 1.5, ""]) {
      expect(inventoryMovementSchema.safeParse({ sku: "SKU-1", type: "IN", quantity, note: "" }).success).toBe(false);
    }
    expect(inventoryMovementSchema.safeParse({ sku: "", type: "SIDEWAYS", quantity: 1 }).success).toBe(false);
  });

  it("submits the selected product movement and reports success", async () => {
    apiMovement.mockResolvedValue({ ok: true });
    const wrapper = mount(InventoryMovementForm, {
      props: { products: [{ sku: "SKU-1", name: "Tornillo" }] },
    });
    await wrapper.get("select[aria-label='Producto']").setValue("SKU-1");
    await wrapper.get("select[aria-label='Tipo de movimiento']").setValue("OUT");
    await wrapper.get("input[aria-label='Cantidad']").setValue("3");
    await wrapper.get("input[aria-label='Nota opcional']").setValue("Pedido #4");
    await wrapper.get("form").trigger("submit");
    await nextTick();
    expect(apiMovement).toHaveBeenCalledWith({ sku: "SKU-1", type: "OUT", quantity: 3, note: "Pedido #4" });
    expect(wrapper.get("[role='status']").text()).toContain("registrado");
  });
});
