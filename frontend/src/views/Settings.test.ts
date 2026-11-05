import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import Settings from "./Settings.vue";

const { apiDownloadBackup } = vi.hoisted(() => ({ apiDownloadBackup: vi.fn() }));
const admin = ref(false);
vi.mock("../auth", () => ({ useAuth: () => ({ isAdmin: admin, user: ref(null), setUser: vi.fn() }) }));
vi.mock("../api", () => ({
  apiDownloadBackup, apiGetSettings: vi.fn().mockResolvedValue({}), apiGetApiKeyConfig: vi.fn().mockResolvedValue({ enabled: false, prefix: null, hasKey: false }),
  apiSetSetting: vi.fn(), apiRestoreBackup: vi.fn(), apiGenerateApiKey: vi.fn(), apiRevokeApiKey: vi.fn(), apiSetApiEnabled: vi.fn(),
  disable2faRequest: vi.fn(), setup2faRequest: vi.fn(), verify2faRequest: vi.fn(),
}));
vi.mock("../settings", () => ({ getDefaultQty: () => 1, setDefaultQty: vi.fn(), getDefaultCategory: () => "", setDefaultCategory: vi.fn() }));

describe("sensitive backup controls", () => {
  beforeEach(() => {
    admin.value = false;
    apiDownloadBackup.mockReset().mockResolvedValue(new Blob(["{}"]));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:backup");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("keeps both backup controls hidden for non-admin users", async () => {
    const wrapper = mount(Settings, { global: { stubs: ["router-link"] } });
    await flushPromises();
    expect(wrapper.text()).not.toContain("Descargar respaldo completo sensible");
    expect(wrapper.text()).not.toContain("Descargar respaldo seguro");
  });

  it("requires explicit confirmation before requesting sensitive data", async () => {
    admin.value = true;
    const wrapper = mount(Settings, { global: { stubs: ["router-link"] } });
    await flushPromises();
    const button = wrapper.findAll("button").find((item) => item.text().includes("Descargar respaldo completo sensible"))!;
    expect((button.element as HTMLButtonElement).disabled).toBe(true);
    expect(wrapper.text()).toContain("contraseñas y secretos TOTP");
    await wrapper.get("input[aria-describedby='sensitive-backup-warning']").setValue(true);
    expect((button.element as HTMLButtonElement).disabled).toBe(false);
    await button.trigger("click");
    await flushPromises();
    expect(apiDownloadBackup).toHaveBeenCalledWith(true);
  });

  it("preserves the safe backup request after confirmation is given", async () => {
    admin.value = true;
    const wrapper = mount(Settings, { global: { stubs: ["router-link"] } });
    await flushPromises();
    await wrapper.get("input[aria-describedby='sensitive-backup-warning']").setValue(true);
    await wrapper.findAll("button").find((item) => item.text().includes("Descargar respaldo seguro"))!.trigger("click");
    expect(apiDownloadBackup).toHaveBeenCalledWith(false);
  });

  it("marks save failures as alerts rather than status messages", async () => {
    const wrapper = mount(Settings, { global: { stubs: ["router-link"] } });
    await flushPromises();
    await wrapper.find('input[type="number"]').setValue(0);
    await wrapper.findAll("button").find((item) => item.text().includes("Guardar"))!.trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
  });
});
