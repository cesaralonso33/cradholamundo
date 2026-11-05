<template>
  <form @submit.prevent="handleSubmit" class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
    <div class="md:col-span-1">
      <label class="block text-xs font-medium text-gray-600">SKU / Código</label>
      <input ref="skuInput" v-model="form.sku" type="text" required
        class="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Escanear o escribir" @keydown.enter.prevent="focusNext('name')" />
    </div>
    <div class="md:col-span-2">
      <label class="block text-xs font-medium text-gray-600">Nombre</label>
      <input v-model="form.name" type="text" required
        class="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        @keydown.enter.prevent="handleSubmit" />
    </div>
    <div>
      <label class="block text-xs font-medium text-gray-600">Categoría</label>
      <input v-model="form.category" type="text" :disabled="!!getDefaultCategory()"
        class="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
        @keydown.enter.prevent="handleSubmit" />
    </div>
    <div class="md:col-span-4 flex justify-between items-center">
      <span class="text-xs text-gray-500">Cantidad por captura: {{ qty }}</span>
      <button type="submit"
        class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
        Guardar (Enter)
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, watch } from "vue";
import { db } from "../db";
import { apiCreateProduct, apiGetProduct } from "../api";
import { getDefaultQty, getDefaultCategory } from "../settings";
import { useAuth } from "../auth";

const emit = defineEmits<{ (e: "captured", item: any): void }>();

const auth = useAuth();
const skuInput = ref<HTMLInputElement | null>(null);
const form = ref({
  sku: "",
  name: "",
  category: "",
});

const qty = computed(() => getDefaultQty());

let lookupTimer: any = null;
watch(() => form.value.sku, (sku) => {
  clearTimeout(lookupTimer);
  const s = (sku || "").trim();
  if (!s) return;
  lookupTimer = setTimeout(async () => {
    try {
      const p = await apiGetProduct(s);
      if (p) {
        form.value.name = p.name || form.value.name;
        form.value.category = p.category || form.value.category;
      }
    } catch {
      // not found: keep manual
    }
  }, 300);
});

function focusNext(field: string) {
  const inputs = document.querySelectorAll("form input") as NodeListOf<HTMLInputElement>;
  const order = ["sku", "name", "category"];
  const idx = order.indexOf(field);
  if (idx >= 0 && inputs[idx]) inputs[idx].focus();
}

async function handleSubmit() {
  if (!form.value.sku || !form.value.name) return;
  const quantity = getDefaultQty();
  const payload = {
    sku: form.value.sku.trim(),
    name: form.value.name.trim(),
    category: form.value.category.trim() || getDefaultCategory() || null,
    quantity,
    min_stock: 0,
  };

  const localId = await db.captures.add({
    sku: payload.sku,
    name: payload.name,
    category: payload.category || undefined,
    location: auth.user.value?.username,
    quantity: payload.quantity,
    type: "PRODUCT",
    synced: 0,
    createdAt: Date.now(),
  });

  emit("captured", { id: localId, ...payload, createdAt: Date.now() });

  form.value = { sku: "", name: "", category: getDefaultCategory() };
  await nextTick();
  skuInput.value?.focus();

  try {
    await apiCreateProduct(payload);
    await db.captures.update(localId, { synced: 1 });
  } catch (e: any) {
    console.error("sync failed", e);
    if (String(e?.message || "").includes("409")) {
      alert("El artículo ya fue capturado (regla de no duplicados activa).");
      await db.captures.delete(localId);
    }
    // En errores de red el registro se conserva como pendiente para reintentar.
  }
}

onMounted(() => {
  if (getDefaultCategory()) form.value.category = getDefaultCategory();
  skuInput.value?.focus();
});
</script>
