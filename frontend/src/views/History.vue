<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Historial de ubicaciones</h1>
      <router-link to="/" class="text-blue-600 text-sm">← Inventario</router-link>
    </header>
    <section class="bg-white p-4 rounded shadow mb-4">
      <form @submit.prevent="search" class="flex gap-2 items-end">
        <div class="flex-1">
          <label class="block text-xs font-medium text-gray-600">SKU</label>
          <input v-model="sku" type="text" required class="w-full border rounded px-2 py-1.5 text-sm" placeholder="Escanear o escribir SKU" />
        </div>
        <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Buscar</button>
      </form>
    </section>
    <section class="bg-white rounded shadow overflow-hidden">
      <h2 class="font-semibold px-4 pt-4 pb-2">Cambios de ubicación</h2>
      <div class="overflow-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="text-left px-3 py-2">Fecha</th>
              <th class="text-left px-3 py-2">Desde</th>
              <th class="text-left px-3 py-2">Hacia</th>
              <th class="text-left px-3 py-2">Por</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in history" :key="h.id" class="border-t">
              <td class="px-3 py-1.5">{{ formatDateTime(h.created_at) }}</td>
              <td class="px-3 py-1.5">{{ h.from_location || "-" }}</td>
              <td class="px-3 py-1.5">{{ h.to_location }}</td>
              <td class="px-3 py-1.5">{{ h.changed_by }}</td>
            </tr>
            <tr v-if="!history.length && searched">
              <td colspan="4" class="px-3 py-4 text-center text-gray-400">Sin historial</td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="page"
        :page-size="pageSize"
        :total="total"
        @update:page="onPageChange"
        @update:pageSize="onPageSizeChange"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef } from "vue";
import { apiProductHistory } from "../api";
import { formatDateTime } from "../utils/format";
import PaginationBar from "../components/PaginationBar.vue";

const sku = ref("");
const history = shallowRef<any[]>([]);
const searched = ref(false);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

async function load() {
  searched.value = true;
  try {
    const data = await apiProductHistory(sku.value.trim(), page.value, pageSize.value);
    history.value = data.items;
    total.value = data.total;
  } catch {
    history.value = [];
    total.value = 0;
  }
}

function search() {
  page.value = 1;
  load();
}

function onPageChange(value: number) {
  page.value = value;
  load();
}

function onPageSizeChange(value: number) {
  pageSize.value = value;
  page.value = 1;
  load();
}
</script>
