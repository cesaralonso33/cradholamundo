<template>
  <div class="flex items-center gap-2 text-sm">
    <span :class="online ? 'text-green-600' : 'text-red-600'">●</span>
    <span>{{ online ? 'En línea' : 'Sin conexión' }}</span>
    <span v-if="pending > 0" class="text-amber-600">({{ pending }} pendientes)</span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { db } from "../db";
import { liveQuery } from "dexie";

const online = ref(navigator.onLine);
const pending = ref(0);

let sub: any;
function updateOnline() { online.value = navigator.onLine; }

onMounted(() => {
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  sub = liveQuery(() => db.captures.where("synced").equals(0).count()).subscribe({
    next: (v: number) => (pending.value = v),
  });
});

onUnmounted(() => {
  window.removeEventListener("online", updateOnline);
  window.removeEventListener("offline", updateOnline);
  sub?.unsubscribe?.();
});
</script>
