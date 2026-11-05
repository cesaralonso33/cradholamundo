<template>
  <form class="space-y-3" @submit.prevent="submit">
    <div>
      <h2 class="font-semibold">Registrar movimiento</h2>
      <p class="text-xs text-gray-500 mt-1">Registra una entrada o salida de existencias.</p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="min-w-0">
        <label for="movement-product" class="block text-xs font-medium text-gray-600 mb-1">Producto</label>
        <select id="movement-product" v-model="sku" aria-label="Producto" required class="w-full border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="" disabled>Selecciona un producto</option>
          <option v-for="product in products" :key="product.sku" :value="product.sku">{{ product.sku }} — {{ product.name }}</option>
        </select>
      </div>
      <div>
        <label for="movement-type" class="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
        <select id="movement-type" v-model="type" aria-label="Tipo de movimiento" class="w-full border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="IN">Entrada (IN)</option>
          <option value="OUT">Salida (OUT)</option>
        </select>
      </div>
      <div>
        <label for="movement-quantity" class="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
        <input id="movement-quantity" v-model="quantity" aria-label="Cantidad" type="number" inputmode="numeric" min="1" step="1" required class="w-full border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div>
        <label for="movement-note" class="block text-xs font-medium text-gray-600 mb-1">Nota (opcional)</label>
        <input id="movement-note" v-model="note" aria-label="Nota opcional" type="text" maxlength="500" class="w-full border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <button type="submit" :disabled="loading || !online" class="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed">
        {{ loading ? "Registrando…" : "Registrar movimiento" }}
      </button>
      <p v-if="!online" class="text-sm text-amber-700" role="status">Sin conexión: los movimientos requieren conexión y no se han guardado.</p>
      <p v-else-if="message" :class="error ? 'text-sm text-red-600' : 'text-sm text-green-700'" :role="error ? 'alert' : 'status'">{{ message }}</p>
    </div>
  </form>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { apiMovement, ApiError } from "../api";
import { inventoryMovementSchema } from "../validation/schemas";

defineProps<{ products: { sku: string; name: string }[] }>();
const sku = ref("");
const type = ref<"IN" | "OUT">("IN");
const quantity = ref<number | string>(1);
const note = ref("");
const loading = ref(false);
const message = ref("");
const error = ref(false);
const online = ref(typeof navigator === "undefined" || navigator.onLine);

function updateOnline() { online.value = navigator.onLine; }
onMounted(() => {
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
});
onUnmounted(() => {
  window.removeEventListener("online", updateOnline);
  window.removeEventListener("offline", updateOnline);
});

async function submit() {
  message.value = "";
  error.value = false;
  const parsed = inventoryMovementSchema.safeParse({ sku: sku.value, type: type.value, quantity: quantity.value, note: note.value });
  if (!parsed.success) {
    error.value = true;
    message.value = parsed.error.issues[0]?.message || "Revisa los datos del movimiento.";
    return;
  }
  if (!online.value) {
    error.value = true;
    message.value = "Sin conexión: el movimiento no se ha guardado.";
    return;
  }
  loading.value = true;
  try {
    const payload = { ...parsed.data, ...(parsed.data.note ? {} : { note: undefined }) };
    await apiMovement(payload);
    message.value = "Movimiento registrado correctamente.";
    quantity.value = 1;
    note.value = "";
  } catch (e) {
    error.value = true;
    message.value = e instanceof ApiError && e.status === 409
      ? "Conflicto de inventario: actualiza las existencias e inténtalo de nuevo."
      : e instanceof Error ? e.message : "No se pudo registrar el movimiento.";
  } finally {
    loading.value = false;
  }
}
</script>
