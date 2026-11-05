import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import InventoryMovementPanel from "./InventoryMovementPanel.vue";

const { apiListProducts, apiMovement } = vi.hoisted(() => ({ apiListProducts: vi.fn(), apiMovement: vi.fn() }));
vi.mock("../api", () => ({ apiListProducts, apiMovement, ApiError: class ApiError extends Error { status = 0 } }));

describe("inventory movement product picker", () => {
  beforeEach(() => { apiListProducts.mockReset(); apiMovement.mockReset(); });

  it("selects a product beyond the first page through search", async () => {
    apiListProducts.mockResolvedValueOnce({ items: [{ sku: "SKU-1", name: "Primero" }], total: 101 });
    apiListProducts.mockResolvedValueOnce({ items: [{ sku: "SKU-101", name: "Producto buscado" }], total: 1 });
    const wrapper = mount(InventoryMovementPanel);
    await flushPromises();
    await wrapper.get("input[aria-label='Buscar producto']").setValue("Producto buscado");
    await wrapper.findAll("form")[0].trigger("submit");
    await flushPromises();
    await wrapper.get("select[aria-label='Producto']").setValue("SKU-101");
    await wrapper.findAll("form")[1].trigger("submit");
    await flushPromises();
    expect(apiListProducts).toHaveBeenLastCalledWith("Producto buscado", 1, 20);
    expect(apiMovement).toHaveBeenCalledWith(expect.objectContaining({ sku: "SKU-101" }));
  });

  it("shows a product loading error and retries the request", async () => {
    apiListProducts.mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce({ items: [{ sku: "SKU-2", name: "Recuperado" }], total: 1 });
    const wrapper = mount(InventoryMovementPanel);
    await flushPromises();
    expect(wrapper.get("[role='alert']").text()).toContain("No se pudieron cargar los productos");
    await wrapper.get("button[aria-label='Reintentar carga de productos']").trigger("click");
    await flushPromises();
    expect(wrapper.find("[role='alert']").exists()).toBe(false);
    expect(wrapper.get("select[aria-label='Producto']").text()).toContain("Recuperado");
    expect(apiListProducts).toHaveBeenCalledTimes(2);
  });
});
