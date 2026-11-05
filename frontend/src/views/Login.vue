<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div class="w-full max-w-md bg-white p-6 rounded shadow">
      <h1 class="text-xl font-bold mb-4">Iniciar sesión</h1>

      <div class="mb-4 rounded border p-3 text-sm" :class="statusClass">
        <div class="flex items-start gap-2">
          <span class="mt-0.5">{{ statusIcon }}</span>
          <div class="flex-1">
            <p class="font-medium">{{ statusTitle }}</p>
            <p v-if="statusDetail" class="text-xs mt-1 opacity-90">{{ statusDetail }}</p>
            <p v-if="statusHint" class="text-xs mt-1 opacity-75">{{ statusHint }}</p>
            <button v-if="status === 'backend-down' || status === 'db-down'" @click="checkHealth"
              class="mt-2 text-xs underline">Reintentar verificación</button>
          </div>
        </div>
      </div>

      <form @submit.prevent="submit" class="space-y-3">
        <div v-if="!pending2fa">
          <label class="block text-xs font-medium text-gray-600">Contraseña</label>
          <input v-model="password" type="password" required autofocus
            :disabled="status === 'checking' || status === 'backend-down' || status === 'db-down'"
            class="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100" />
        </div>
        <div v-else>
          <p class="text-xs text-gray-500 mb-2">Ingresa el código de verificación (2FA).</p>
          <label class="block text-xs font-medium text-gray-600">Código</label>
          <input v-model="code" type="text" inputmode="numeric" required autofocus
            class="w-full border rounded px-2 py-1.5 text-sm text-center tracking-widest" />
        </div>
        <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
        <button type="submit"
          :disabled="status === 'checking' || status === 'backend-down' || status === 'db-down'"
          class="w-full bg-blue-600 text-white py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {{ status === 'checking' ? "Verificando..." : pending2fa ? "Verificar" : "Entrar" }}
        </button>
        <button v-if="pending2fa" type="button" @click="pending2fa = false; tempToken = ''; code = ''"
          class="w-full border py-1.5 rounded text-sm hover:bg-gray-50">Cancelar</button>
      </form>
      <p class="text-xs text-gray-500 mt-3">
        ¿Primera vez? Ingresa la contraseña de administrador.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAuth } from "../auth";
import { useRouter } from "vue-router";
import { apiHealth } from "../api";

const auth = useAuth();
const router = useRouter();

const password = ref("");
const code = ref("");
const error = ref("");
const tempToken = ref("");
const pending2fa = ref(false);

const status = ref<"checking" | "ok" | "backend-down" | "db-down">("checking");
const statusDetail = ref("");
const statusHint = ref("");

const statusClass = computed(() => {
  if (status.value === "ok") return "border-green-200 bg-green-50 text-green-800";
  if (status.value === "db-down") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status.value === "backend-down") return "border-red-200 bg-red-50 text-red-800";
  return "border-gray-200 bg-gray-50 text-gray-700";
});

const statusIcon = computed(() => {
  if (status.value === "ok") return "✓";
  if (status.value === "db-down") return "⚠";
  if (status.value === "backend-down") return "✕";
  return "…";
});

const statusTitle = computed(() => {
  if (status.value === "ok") return "Backend y base de datos conectados";
  if (status.value === "db-down") return "El backend responde, pero la base de datos no";
  if (status.value === "backend-down") return "No se pudo conectar con el backend";
  return "Verificando conexión...";
});

async function checkHealth() {
  status.value = "checking";
  statusDetail.value = "";
  statusHint.value = "";
  try {
    const health = await apiHealth();
    if (health.ok) {
      status.value = "ok";
      return;
    }
    status.value = "db-down";
    statusDetail.value = health.error || "La base de datos no respondió.";
    statusHint.value =
      health.hint ||
      "Revisa DATABASE_URL, que PostgreSQL esté corriendo y que las credenciales sean correctas.";
  } catch (e: any) {
    status.value = "backend-down";
    statusDetail.value = e.message || "No hay respuesta del servidor.";
    statusHint.value =
      "Verifica que el backend esté encendido, la URL/puerto configurados, el firewall o CORS.";
  }
}

async function submit() {
  error.value = "";
  try {
    if (pending2fa.value) {
      await auth.complete2fa(tempToken.value, code.value);
      router.push("/");
      return;
    }
    const result = await auth.login(password.value);
    if (result.requires2fa) {
      pending2fa.value = true;
      tempToken.value = result.tempToken;
    } else {
      router.push("/");
    }
  } catch (e: any) {
    const message = e.message || "Error de login";
    error.value = message;
    if (/failed to fetch|network|load failed|abort/i.test(message)) {
      status.value = "backend-down";
      statusDetail.value = message;
      statusHint.value = "No se pudo contactar al backend. Revisa que esté encendido y accesible.";
    }
  }
}

onMounted(checkHealth);
</script>
