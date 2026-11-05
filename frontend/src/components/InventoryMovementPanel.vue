<template>
  <section class="space-y-3" aria-labelledby="movement-products-heading">
    <div>
      <h2 id="movement-products-heading" class="font-semibold">Registrar movimiento</h2>
      <p class="mt-1 text-xs text-gray-500">Registra una entrada o salida de existencias.</p>
    </div>
    <form id="search-products" class="flex flex-col gap-2 sm:flex-row sm:items-end" @submit.prevent="search">
      <div class="min-w-0 flex-1">
        <label for="movement-product-search" class="mb-1 block text-xs font-medium text-gray-600">Buscar producto por SKU o nombre</label>
        <input id="movement-product-search" v-model="query" aria-label="Buscar producto" type="search" maxlength="120" class="w-full rounded border px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Escribe SKU o nombre" />
      </div>
      <button type="submit" :disabled="loading" class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">Buscar</button>
    </form>
    <p v-if="loading" class="text-sm text-gray-600" role="status" aria-live="polite">Cargando productos…</p>
    <div v-else-if="error" class="flex flex-wrap items-center gap-3" role="alert">
      <p class="text-sm text-red-700">No se pudieron cargar los productos. Comprueba tu conexión e inténtalo de nuevo.</p>
      <button type="button" aria-label="Reintentar carga de productos" class="rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500" @click="loadProducts">Reintentar</button>
    </div>
    <p v-else-if="!products.length" class="text-sm text-gray-600" role="status">{{ query.trim() ? 'No hay productos que coincidan con la búsqueda.' : 'No hay productos disponibles.' }}</p>
    <InventoryMovementForm v-else :products="products" />
    <nav v-if="!loading && !error && total > pageSize" class="flex items-center justify-between gap-3" aria-label="Paginación de productos">
      <button type="button" :disabled="page <= 1" class="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" @click="changePage(page - 1)">Anterior</button>
      <span class="text-sm text-gray-600" aria-live="polite">Página {{ page }} de {{ totalPages }}</span>
      <button type="button" :disabled="page >= totalPages" class="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" @click="changePage(page + 1)">Siguiente</button>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { apiListProducts } from "../api";
import InventoryMovementForm from "./InventoryMovementForm.vue";

const pageSize = 20;
const query = ref("");
const products = ref<{ sku: string; name: string }[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref(false);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)));
let requestId = 0;
let active = true;

async function loadProducts() {
  const id = ++requestId;
  loading.value = true;
  error.value = false;
  try {
    const data = await apiListProducts(query.value.trim(), page.value, pageSize);
    if (!active || id !== requestId) return;
    products.value = data.items.map((product: any) => ({ sku: product.sku, name: product.name }));
    total.value = data.total;
    if (page.value > totalPages.value) page.value = totalPages.value;
  } catch {
    if (!active || id !== requestId) return;
    products.value = [];
    total.value = 0;
    error.value = true;
  } finally {
    if (active && id === requestId) loading.value = false;
  }
}

function search() {
  page.value = 1;
  loadProducts();
}

function changePage(value: number) {
  page.value = value;
  loadProducts();
}

onMounted(loadProducts);
onUnmounted(() => { active = false; requestId++; });
</script>
