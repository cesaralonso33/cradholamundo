import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Button from "./Button.vue";
import Badge from "./Badge.vue";
import Alert from "./Alert.vue";
import PageHeader from "./PageHeader.vue";

describe("shadcn UI foundation", () => {
  it("renders button variants and disabled state", () => {
    const wrapper = mount(Button, { props: { variant: "outline", disabled: true }, slots: { default: "Guardar" } });
    expect(wrapper.classes()).toContain("border");
    expect((wrapper.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders semantic feedback and page hierarchy", () => {
    const wrapper = mount(PageHeader, { props: { title: "Inventario", description: "Gestiona existencias" } });
    expect(wrapper.find("h1").text()).toBe("Inventario");
    expect(wrapper.text()).toContain("Gestiona existencias");
    expect(mount(Alert, { props: { variant: "danger" }, slots: { default: "Error" } }).attributes("role")).toBe("alert");
    expect(mount(Badge, { slots: { default: "Activo" } }).text()).toBe("Activo");
  });
});
