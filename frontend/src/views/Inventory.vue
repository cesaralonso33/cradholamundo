<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Inventario Rápido</h1>
      <div class="flex items-center gap-3">
        <router-link v-if="auth.hasPermission('users')" to="/users" class="text-blue-600 text-xs sm:text-sm hover:underline">Usuarios</router-link>
        <router-link v-if="auth.hasPermission('settings')" to="/settings" class="text-blue-600 text-xs sm:text-sm hover:underline">Configuración</router-link>
        <router-link v-if="auth.hasPermission('history')" to="/history" class="text-blue-600 text-xs sm:text-sm hover:underline">Historial</router-link>
        <router-link v-if="auth.isAdmin.value" to="/employees" class="text-blue-600 text-xs sm:text-sm hover:underline">Empleados</router-link>
        <router-link v-if="auth.isAdmin.value" to="/roles" class="text-blue-600 text-xs sm:text-sm hover:underline">Roles</router-link>
        <router-link v-if="auth.isAdmin.value" to="/audit" class="text-blue-600 text-xs sm:text-sm hover:underline">Auditoría</router-link>
        <router-link v-if="auth.hasPermission('papeleria')" to="/papeleria" class="text-blue-600 text-xs sm:text-sm hover:underline">Papelería</router-link>
        <router-link v-if="auth.hasPermission('api')" to="/api-docs" class="text-blue-600 text-xs sm:text-sm hover:underline">API</router-link>
        <SyncStatusBadge />
        <button @click="logout" class="text-sm text-gray-600 hover:underline">Salir ({{ auth.user.value?.username }})</button>
      </div>
    </header>

    <section class="bg-white p-4 rounded shadow mb-4">
      <QuickInventoryForm @captured="onCapture" />
    </section>

    <section class="bg-white p-4 rounded shadow mb-4">
      <InventoryMovementForm :products="products" />
    </section>

    <section class="bg-white rounded shadow overflow-hidden">
      <h2 class="font-semibold px-4 pt-4 pb-2">Capturas recientes</h2>
      <RecentCapturesTable :rows="rows" :server-mode="auth.isAdmin.value" @changed="onChanged" />
      <PaginationBar
        :page="page"
        :page-size="pageSize"
        :total="totalRows"
        @update:page="page = $event"
        @update:pageSize="pageSize = $event"
      />
    </section>
  </div>
</template>

<script setup lang="ts">
import { shallowRef, ref, watch, onMounted, onUnmounted } from "vue";
import { db } from "../db";
import { liveQuery } from "dexie";
import { useAuth } from "../auth";
import { useRouter } from "vue-router";
import { apiListProducts } from "../api";
import { syncPendingCaptures } from "../sync";
import QuickInventoryForm from "../components/QuickInventoryForm.vue";
import RecentCapturesTable from "../components/RecentCapturesTable.vue";
import SyncStatusBadge from "../components/SyncStatusBadge.vue";
import PaginationBar from "../components/PaginationBar.vue";
import InventoryMovementForm from "../components/InventoryMovementForm.vue";

const auth = useAuth();
const router = useRouter();
const rows = shallowRef<any[]>([]);
const totalRows = ref(0);
const page = ref(1);
const pageSize = ref(10);
const products = ref<{ sku: string; name: string }[]>([]);
let sub: any;

function logout() {
  auth.logout();
  router.push("/login");
}

function subscribe() {
  if (auth.isAdmin.value) return;
  sub?.unsubscribe?.();
  sub = liveQuery(async () => {
    const total = await db.captures.count();
    const items = await db.captures
      .orderBy("createdAt")
      .reverse()
      .offset((page.value - 1) * pageSize.value)
      .limit(pageSize.value)
      .toArray();
    return { items, total };
  }).subscribe({
    next: ({ items, total }: { items: any[]; total: number }) => {
      rows.value = items;
      totalRows.value = total;
      const totalPages = Math.max(1, Math.ceil(total / pageSize.value));
      if (page.value > totalPages) page.value = totalPages;
    },
  });
}

async function loadServer() {
  const data = await apiListProducts("", page.value, pageSize.value);
  rows.value = data.items.map((p: any) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    category: p.category,
    location: p.location,
    quantity: p.quantity,
    synced: 1,
    createdAt: new Date(p.created_at).getTime(),
  }));
  totalRows.value = data.total;
  const totalPages = Math.max(1, Math.ceil(data.total / pageSize.value));
  if (page.value > totalPages) page.value = totalPages;
}

async function loadMovementProducts() {
  try {
    const data = await apiListProducts("", 1, 100);
    products.value = data.items.map((product: any) => ({ sku: product.sku, name: product.name }));
  } catch {
    products.value = [];
  }
}

function onChanged() {
  if (auth.isAdmin.value) loadServer();
}

function onCapture() {
  if (auth.isAdmin.value) setTimeout(() => loadServer(), 800);
}

function refresh() {
  if (auth.isAdmin.value) loadServer();
  else subscribe();
}

async function runSync() {
  await syncPendingCaptures();
  if (auth.isAdmin.value) loadServer();
}

watch([page, pageSize], refresh);
onMounted(() => {
  loadMovementProducts();
  if (auth.isAdmin.value) loadServer();
  else subscribe();
  runSync();
  window.addEventListener("online", runSync);
});
onUnmounted(() => {
  sub?.unsubscribe?.();
  window.removeEventListener("online", runSync);
});
</script>
