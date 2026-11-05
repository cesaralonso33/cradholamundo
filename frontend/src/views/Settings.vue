<template>
  <div class="min-h-screen p-4 sm:p-6">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Configuración</h1>
      <router-link to="/" class="text-blue-600 text-sm">← Inventario</router-link>
    </header>
    <section class="bg-white p-4 rounded shadow max-w-md space-y-4">
      <div>
        <h2 class="font-semibold mb-2">Cantidad por defecto por captura</h2>
        <p class="text-xs text-gray-500 mb-3">Valor que se asignará a cada item capturado.</p>
        <div class="flex gap-2 items-end">
          <div class="flex-1">
            <label class="block text-xs font-medium text-gray-600">Cantidad</label>
            <input v-model.number="qty" type="number" min="1" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>
      </div>
      <div>
        <h2 class="font-semibold mb-2">Categoría por defecto</h2>
        <p class="text-xs text-gray-500 mb-3">Categoría que se asignará si no se especifica.</p>
        <div class="flex-1">
          <label class="block text-xs font-medium text-gray-600">Categoría</label>
          <input v-model="category" type="text" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div>
        <h2 class="font-semibold mb-2">Regla de no duplicados</h2>
        <p class="text-xs text-gray-500 mb-3">
          Un artículo no podrá ser capturado 2 veces ni podrá estar en dos ubicaciones distintas.
        </p>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" v-model="preventDuplicates" class="rounded" />
          Activar regla
        </label>
      </div>
      <div class="flex justify-end">
        <button @click="save" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Guardar</button>
      </div>
      <p v-if="msg" :role="saveError ? 'alert' : 'status'" class="text-sm mt-2" :class="saveError ? 'text-red-600' : 'text-green-600'">{{ msg }}</p>
    </section>

    <section class="bg-white p-4 rounded shadow max-w-md mt-4 space-y-3">
      <div>
        <h2 class="font-semibold mb-1">Verificación en dos pasos (2FA)</h2>
        <p class="text-xs text-gray-500">
          Añade un segundo factor de autenticación a tu cuenta.
        </p>
      </div>
      <template v-if="twoFactorEnabled">
        <p class="text-sm text-green-600">2FA activado para tu cuenta.</p>
        <div class="space-y-2">
          <div>
            <label class="block text-xs font-medium text-gray-600">Contraseña</label>
            <input v-model="twoFactorPassword" type="password" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Código 2FA</label>
            <input v-model="twoFactorCode" type="text" inputmode="numeric" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div class="flex justify-end">
            <button @click="disableTwoFactor" :disabled="twoFactorLoading"
              class="border border-red-300 text-red-600 px-4 py-1.5 rounded text-sm hover:bg-red-50 disabled:opacity-50">
              {{ twoFactorLoading ? "Desactivando..." : "Desactivar 2FA" }}
            </button>
          </div>
        </div>
      </template>
      <template v-else>
        <template v-if="!twoFactorSetup">
          <button @click="startTwoFactorSetup" :disabled="twoFactorLoading"
            class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {{ twoFactorLoading ? "Preparando..." : "Activar 2FA" }}
          </button>
        </template>
        <template v-else>
          <div class="text-center">
            <img :src="twoFactorSetup.qr" alt="QR 2FA" class="mx-auto border rounded" />
            <p class="text-xs text-gray-500 mt-2">Clave manual: <code class="bg-gray-100 px-1 py-0.5 rounded">{{ twoFactorSetup.secret }}</code></p>
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Código de verificación</label>
            <input v-model="twoFactorCode" type="text" inputmode="numeric" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div class="flex justify-end gap-2">
            <button @click="twoFactorSetup = null; twoFactorCode = ''" class="border px-4 py-1.5 rounded text-sm hover:bg-gray-50">Cancelar</button>
            <button @click="verifyTwoFactor" :disabled="twoFactorLoading"
              class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
              {{ twoFactorLoading ? "Verificando..." : "Verificar y activar" }}
            </button>
          </div>
        </template>
      </template>
      <p v-if="twoFactorMsg" class="text-sm" :class="twoFactorErr ? 'text-red-600' : 'text-green-600'">{{ twoFactorMsg }}</p>
    </section>

    <section v-if="isAdmin" class="bg-white p-4 rounded shadow max-w-md mt-4 space-y-3">
      <div>
        <h2 class="font-semibold mb-1">Respaldos de la base de datos</h2>
        <p class="text-xs text-gray-500">
          El respaldo seguro incluye datos operativos para restaurar o migrar el proyecto.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button @click="downloadBackup()" :disabled="backupLoading"
          class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {{ backupLoading ? "Generando..." : "Descargar respaldo seguro" }}
        </button>
        <label class="border px-4 py-1.5 rounded text-sm cursor-pointer hover:bg-gray-50">
          Restaurar respaldo
          <input id="restore-backup" type="file" accept=".json,application/json" class="sr-only" @change="restoreBackup" />
        </label>
      </div>
      <p v-if="backupMsg" :role="backupErr ? 'alert' : 'status'" aria-live="polite" class="text-sm" :class="backupErr ? 'text-red-600' : 'text-green-600'">{{ backupMsg }}</p>
      <p class="text-xs text-gray-400">
        La restauración reemplaza todos los datos actuales. Los archivos de constancias no se incluyen en el JSON.
      </p>
      <div class="border-t pt-3 space-y-2">
        <p class="text-sm font-medium">Respaldo completo sensible</p>
        <p id="sensitive-backup-warning" class="text-xs text-amber-800">
          Incluye información sensible de cuentas, como contraseñas y secretos TOTP. Guárdalo cifrado y con acceso restringido.
        </p>
        <label class="flex items-start gap-2 text-sm">
          <input v-model="sensitiveBackupConfirmed" type="checkbox" class="mt-0.5 rounded" aria-describedby="sensitive-backup-warning" />
          <span>Confirmo que entiendo que este archivo contiene contraseñas y datos TOTP.</span>
        </label>
        <button @click="downloadSensitiveBackup" :disabled="backupLoading || !sensitiveBackupConfirmed"
          class="border border-amber-700 text-amber-900 px-4 py-1.5 rounded text-sm hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed">
          {{ sensitiveBackupLoading ? "Generando respaldo sensible..." : "Descargar respaldo completo sensible" }}
        </button>
      </div>
    </section>

    <section v-if="isAdmin" class="bg-white p-4 rounded shadow max-w-md mt-4 space-y-3">
      <div>
        <h2 class="font-semibold mb-1">API</h2>
        <p class="text-xs text-gray-500">
          Configura el acceso de integraciones externas mediante clave de API.
        </p>
      </div>
      <div class="text-sm">
        <span class="text-gray-500">URL base:</span>
        <code class="ml-1 bg-gray-100 px-1.5 py-0.5 rounded">{{ apiBase }}</code>
      </div>
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" :checked="apiConfig.enabled" @change="toggleApiEnabled(($event.target as HTMLInputElement).checked)" />
        API habilitada
      </label>
      <div class="text-sm text-gray-600">
        <template v-if="apiConfig.hasKey">
          Clave actual: <code class="bg-gray-100 px-1.5 py-0.5 rounded">{{ apiConfig.prefix }}…</code>
        </template>
        <template v-else>Sin clave de API generada.</template>
      </div>
      <div class="flex flex-wrap gap-2">
        <button @click="generateApiKey" :disabled="apiLoading"
          class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {{ apiConfig.hasKey ? "Regenerar clave" : "Generar clave" }}
        </button>
        <button v-if="apiConfig.hasKey" @click="revokeApiKey" :disabled="apiLoading"
          class="border border-red-300 text-red-600 px-4 py-1.5 rounded text-sm hover:bg-red-50 disabled:opacity-50">
          Revocar
        </button>
        <router-link to="/api-docs" class="border px-4 py-1.5 rounded text-sm hover:bg-gray-50">Ver manual de API</router-link>
      </div>
      <div v-if="newApiKey" class="bg-amber-50 border border-amber-200 rounded p-3 text-sm space-y-2">
        <p class="font-medium text-amber-800">Guarda esta clave, no se volverá a mostrar:</p>
        <div class="flex gap-2 items-center">
          <code class="flex-1 bg-white border rounded px-2 py-1 text-xs break-all">{{ newApiKey }}</code>
          <button @click="copyApiKey" class="text-xs text-blue-600 hover:underline">Copiar</button>
        </div>
      </div>
      <p v-if="apiMsg" class="text-sm" :class="apiErr ? 'text-red-600' : 'text-green-600'">{{ apiMsg }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { getDefaultQty, setDefaultQty, getDefaultCategory, setDefaultCategory } from "../settings";
import { settingsSchema } from "../validation/schemas";
import {
  apiDownloadBackup,
  apiGenerateApiKey,
  apiGetApiKeyConfig,
  apiGetSettings,
  apiRestoreBackup,
  apiRevokeApiKey,
  apiSetApiEnabled,
  apiSetSetting,
  disable2faRequest,
  setup2faRequest,
  verify2faRequest,
} from "../api";
import { useAuth } from "../auth";

const auth = useAuth();
const isAdmin = auth.isAdmin;
const apiBase = import.meta.env.VITE_API_BASE || window.location.origin;

const qty = ref(1);
const category = ref("");
const preventDuplicates = ref(false);
const msg = ref("");
const saveError = ref(false);

const backupLoading = ref(false);
const backupMsg = ref("");
const backupErr = ref(false);
const sensitiveBackupConfirmed = ref(false);
const sensitiveBackupLoading = ref(false);

const apiConfig = ref({ enabled: false, prefix: null as string | null, hasKey: false });
const apiLoading = ref(false);
const apiMsg = ref("");
const apiErr = ref(false);
const newApiKey = ref("");

const twoFactorEnabled = computed(() => auth.user.value?.two_factor_enabled ?? false);
const twoFactorSetup = ref<{ secret: string; qr: string } | null>(null);
const twoFactorCode = ref("");
const twoFactorPassword = ref("");
const twoFactorMsg = ref("");
const twoFactorErr = ref(false);
const twoFactorLoading = ref(false);

async function loadApiConfig() {
  try {
    apiConfig.value = await apiGetApiKeyConfig();
  } catch {}
}

onMounted(async () => {
  qty.value = getDefaultQty();
  category.value = getDefaultCategory();
  try {
    const s = await apiGetSettings();
    preventDuplicates.value = s.prevent_duplicates === "true";
  } catch {}
  if (isAdmin.value) await loadApiConfig();
});

async function toggleApiEnabled(enabled: boolean) {
  apiMsg.value = "";
  apiErr.value = false;
  try {
    await apiSetApiEnabled(enabled);
    apiConfig.value.enabled = enabled;
    apiMsg.value = enabled ? "API habilitada." : "API deshabilitada.";
  } catch (e: any) {
    apiErr.value = true;
    apiMsg.value = e.message || "Error al actualizar la API.";
  }
}

async function generateApiKey() {
  if (apiConfig.value.hasKey && !confirm("¿Regenerar la clave? La anterior dejará de funcionar.")) return;
  apiLoading.value = true;
  apiMsg.value = "";
  apiErr.value = false;
  try {
    const data = await apiGenerateApiKey();
    newApiKey.value = data.apiKey;
    apiMsg.value = "Clave generada.";
    await loadApiConfig();
  } catch (e: any) {
    apiErr.value = true;
    apiMsg.value = e.message || "Error al generar la clave.";
  } finally {
    apiLoading.value = false;
  }
}

async function revokeApiKey() {
  if (!confirm("¿Revocar la clave de API? Las integraciones dejarán de funcionar.")) return;
  apiLoading.value = true;
  apiMsg.value = "";
  apiErr.value = false;
  try {
    await apiRevokeApiKey();
    newApiKey.value = "";
    apiMsg.value = "Clave revocada.";
    await loadApiConfig();
  } catch (e: any) {
    apiErr.value = true;
    apiMsg.value = e.message || "Error al revocar la clave.";
  } finally {
    apiLoading.value = false;
  }
}

async function copyApiKey() {
  try {
    await navigator.clipboard.writeText(newApiKey.value);
    apiMsg.value = "Clave copiada.";
  } catch {
    apiMsg.value = "No se pudo copiar; selecciónala manualmente.";
  }
}

async function save() {
  saveError.value = false;
  const parsed = settingsSchema.safeParse({ quantity: qty.value, category: category.value });
  if (!parsed.success) {
    saveError.value = true;
    msg.value = parsed.error.issues[0]?.message || "Revisa la configuración.";
    return;
  }
  setDefaultQty(parsed.data.quantity);
  setDefaultCategory(parsed.data.category);
  try {
    await apiSetSetting("prevent_duplicates", preventDuplicates.value ? "true" : "false");
    msg.value = "Guardado.";
  } catch (e: any) {
    saveError.value = true;
    msg.value = e.message || "Error al guardar.";
  }
  setTimeout(() => (msg.value = ""), 2000);
}

async function startTwoFactorSetup() {
  twoFactorLoading.value = true;
  twoFactorMsg.value = "";
  twoFactorErr.value = false;
  try {
    twoFactorSetup.value = await setup2faRequest();
  } catch (e: any) {
    twoFactorErr.value = true;
    twoFactorMsg.value = e.message || "Error al preparar 2FA.";
  } finally {
    twoFactorLoading.value = false;
  }
}

async function verifyTwoFactor() {
  twoFactorLoading.value = true;
  twoFactorMsg.value = "";
  twoFactorErr.value = false;
  try {
    await verify2faRequest(twoFactorCode.value);
    if (auth.user.value) {
      auth.setUser({ ...auth.user.value, two_factor_enabled: true });
    }
    twoFactorMsg.value = "2FA activado correctamente.";
    twoFactorSetup.value = null;
    twoFactorCode.value = "";
  } catch (e: any) {
    twoFactorErr.value = true;
    twoFactorMsg.value = e.message || "Código inválido.";
  } finally {
    twoFactorLoading.value = false;
  }
}

async function disableTwoFactor() {
  twoFactorMsg.value = "";
  twoFactorErr.value = false;
  try {
    await disable2faRequest(twoFactorPassword.value, twoFactorCode.value);
    if (auth.user.value) {
      auth.setUser({ ...auth.user.value, two_factor_enabled: false });
    }
    twoFactorMsg.value = "2FA desactivado.";
    twoFactorPassword.value = "";
    twoFactorCode.value = "";
  } catch (e: any) {
    twoFactorErr.value = true;
    twoFactorMsg.value = e.message || "Error al desactivar 2FA.";
  }
}

async function downloadBackup(includeSensitive = false) {
  if (includeSensitive && (!isAdmin.value || !sensitiveBackupConfirmed.value)) return;
  backupLoading.value = true;
  if (includeSensitive) sensitiveBackupLoading.value = true;
  backupMsg.value = "";
  backupErr.value = false;
  try {
    const blob = await apiDownloadBackup(includeSensitive);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `inventario-backup${includeSensitive ? "-completo-sensible" : ""}-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
    backupMsg.value = includeSensitive ? "Respaldo completo sensible descargado. Guárdalo de forma segura." : "Respaldo seguro descargado.";
  } catch (e: any) {
    backupErr.value = true;
    backupMsg.value = e.message || "Error al generar el respaldo.";
  } finally {
    backupLoading.value = false;
    sensitiveBackupLoading.value = false;
  }
}

async function downloadSensitiveBackup() {
  await downloadBackup(true);
}

async function restoreBackup(event: any) {
  const file = event.target.files?.[0];
  if (!file) return;
  backupMsg.value = "";
  backupErr.value = false;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed?.data) throw new Error("El archivo no es un respaldo válido.");
    if (!confirm("¿Restaurar este respaldo? Se reemplazarán todos los datos actuales.")) {
      event.target.value = "";
      return;
    }
    await apiRestoreBackup(parsed);
    backupMsg.value = "Respaldo restaurado correctamente.";
  } catch (e: any) {
    backupErr.value = true;
    backupMsg.value = e.message || "Error al restaurar el respaldo.";
  } finally {
    event.target.value = "";
  }
}
</script>
