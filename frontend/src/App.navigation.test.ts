// @vitest-environment jsdom
import { mount, flushPromises } from "@vue/test-utils";
import { computed, ref } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const { authState } = vi.hoisted(() => ({
  authState: { user: null as null | { username: string; role: string; permissions: string[] } },
}));

vi.mock("./auth", () => ({
  useAuth: () => ({
    user: ref(authState.user),
    isAuthenticated: computed(() => !!authState.user),
    isAdmin: computed(() => authState.user?.role === "admin"),
    hasPermission: (permission: string) => authState.user?.role === "admin" || authState.user?.permissions.includes(permission),
    logout: vi.fn(),
  }),
}));

import App from "./App.vue";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: "/login", component: { template: "<main>Login form</main>" }, meta: { public: true } },
    { path: "/", component: { template: "<main>Inventory content</main>" } },
  ],
});

async function renderAt(path: string, user: typeof authState.user) {
  authState.user = user;
  await router.push(path);
  await router.isReady();
  const wrapper = mount(App, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

afterEach(() => { authState.user = null; });

describe("global navigation", () => {
  it("shows the shared menu, current user, and sign-out on authenticated pages", async () => {
    const wrapper = await renderAt("/", { username: "ana", role: "user", permissions: ["users"] });
    expect(wrapper.find("nav").exists()).toBe(true);
    expect(wrapper.find("aside.app-shell__sidebar").exists()).toBe(true);
    expect(wrapper.find("aside.app-shell__sidebar").classes()).toContain("app-shell__sidebar--light");
    expect(wrapper.text()).toContain("Operación");
    expect(wrapper.find("button[aria-label='Abrir menú']").exists()).toBe(true);
    expect(wrapper.find("nav.app-shell__nav").classes()).toContain("app-shell__nav");
    expect(wrapper.text()).toContain("Salir (ana)");
    expect(wrapper.text()).toContain("Inventory content");
    wrapper.unmount();
  });

  it("does not show the shared menu on the login route", async () => {
    const wrapper = await renderAt("/login", null);
    expect(wrapper.find("nav").exists()).toBe(false);
    expect(wrapper.find("aside.app-shell__sidebar").exists()).toBe(false);
    expect(wrapper.text()).toContain("Login form");
    wrapper.unmount();
  });

  it("shows permission links and admin-only links only when allowed", async () => {
    const regular = await renderAt("/", { username: "ana", role: "user", permissions: ["users", "history"] });
    expect(regular.find('a[href="/users"]').exists()).toBe(true);
    expect(regular.find('a[href="/history"]').exists()).toBe(true);
    expect(regular.find('a[href="/settings"]').exists()).toBe(false);
    expect(regular.find('a[href="/employees"]').exists()).toBe(false);
    regular.unmount();

    const admin = await renderAt("/", { username: "root", role: "admin", permissions: [] });
    expect(admin.find('a[href="/employees"]').exists()).toBe(true);
    expect(admin.find('a[href="/roles"]').exists()).toBe(true);
    expect(admin.find('a[href="/audit"]').exists()).toBe(true);
    expect(admin.find('a[href="/api-docs"]').exists()).toBe(true);
    admin.unmount();
  });

  it("opens the sidebar from the mobile menu button", async () => {
    const wrapper = await renderAt("/", { username: "ana", role: "user", permissions: ["users"] });
    expect(wrapper.find("aside.app-shell__sidebar").classes()).not.toContain("is-open");
    await wrapper.get("button[aria-label='Abrir menú']").trigger("click");
    expect(wrapper.find("aside.app-shell__sidebar").classes()).toContain("is-open");
    wrapper.unmount();
  });
});
