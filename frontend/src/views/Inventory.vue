<template>
  <div class="min-h-screen p-4 sm:p-6">
    <div class="mx-auto max-w-7xl">
    <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <QuickInventoryForm @captured="onCapture" />
    </section>

    <section class="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <InventoryMovementPanel />
    </section>

    <section class="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 class="border-b border-slate-100 px-4 py-4 text-base font-bold text-slate-800 sm:px-5">Capturas recientes</h2>
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
  </div>
</template>

<script setup lang="ts">
import { shallowRef, ref, watch, onMounted, onUnmounted } from "vue";
import { db } from "../db";
import { liveQuery } from "dexie";
import { useAuth } from "../auth";
import { apiListProducts } from "../api";
import { syncPendingCaptures } from "../sync";
import QuickInventoryForm from "../components/QuickInventoryForm.vue";
import RecentCapturesTable from "../components/RecentCapturesTable.vue";
import PaginationBar from "../components/PaginationBar.vue";
import InventoryMovementPanel from "../components/InventoryMovementPanel.vue";

const auth = useAuth();
const rows = shallowRef<any[]>([]);
const totalRows = ref(0);
const page = ref(1);
const pageSize = ref(10);
let sub: any;

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
