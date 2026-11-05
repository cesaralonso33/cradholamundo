<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Auditoría</h1>
      <router-link to="/" class="text-blue-600 text-sm">← Inventario</router-link>
    </header>

    <section class="bg-white p-4 rounded shadow mb-4">
      <form @submit.prevent="load" class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div>
          <label class="block text-xs font-medium text-gray-600">Usuario</label>
          <input v-model="filters.username" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Acción</label>
          <input v-model="filters.action" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="login.success" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Entidad</label>
          <input v-model="filters.entityType" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="product" />
        </div>
        <div class="flex justify-end">
          <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Filtrar</button>
        </div>
      </form>
    </section>

    <section class="bg-white rounded shadow overflow-hidden">
      <div class="overflow-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="text-left px-3 py-2">Fecha</th>
              <th class="text-left px-3 py-2">Usuario</th>
              <th class="text-left px-3 py-2">Acción</th>
              <th class="text-left px-3 py-2">Entidad</th>
              <th class="text-left px-3 py-2">ID</th>
              <th class="text-left px-3 py-2">IP</th>
              <th class="text-left px-3 py-2">Detalles</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="log in logs" :key="log.id" class="border-t">
              <td class="px-3 py-1.5 text-xs">{{ formatDateTime(log.created_at) }}</td>
              <td class="px-3 py-1.5">{{ log.username || "-" }}</td>
              <td class="px-3 py-1.5 font-mono text-xs">{{ log.action }}</td>
              <td class="px-3 py-1.5">{{ log.entity_type || "-" }}</td>
              <td class="px-3 py-1.5 font-mono text-xs">{{ log.entity_id || "-" }}</td>
              <td class="px-3 py-1.5 text-xs">{{ log.ip || "-" }}</td>
              <td class="px-3 py-1.5 text-xs max-w-xs truncate" :title="log.details || ''">{{ log.details || "-" }}</td>
            </tr>
            <tr v-if="!logs.length">
              <td colspan="7" class="px-3 py-4 text-center text-gray-400">Sin registros</td>
            </tr>
          </tbody>
        </table>
      </div>
      <PaginationBar
        :page="page"
        :page-size="pageSize"
        :total="total"
        @update:page="onPage"
        @update:pageSize="onPageSize"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted } from "vue";
import { apiListAuditLogs } from "../api";
import { formatDateTime } from "../utils/format";
import PaginationBar from "../components/PaginationBar.vue";

const logs = shallowRef<any[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(50);
const filters = ref({ username: "", action: "", entityType: "" });

async function load() {
  const data = await apiListAuditLogs(page.value, pageSize.value, {
    username: filters.value.username || undefined,
    action: filters.value.action || undefined,
    entityType: filters.value.entityType || undefined,
  });
  logs.value = data.items;
  total.value = data.total;
}

function search() {
  page.value = 1;
  load();
}

function onPage(value: number) {
  page.value = value;
  load();
}

function onPageSize(value: number) {
  pageSize.value = value;
  page.value = 1;
  load();
}

onMounted(load);
</script>
