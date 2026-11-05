<template>
  <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t bg-gray-50 text-sm">
    <div class="text-gray-500">
      Mostrando {{ start }}–{{ end }} de {{ total }}
    </div>
    <div class="flex items-center gap-2">
      <select :value="pageSize" @change="changeSize(($event.target as HTMLSelectElement).value)"
        class="border rounded px-2 py-1 text-xs bg-white">
        <option :value="10">10 / página</option>
        <option :value="20">20 / página</option>
        <option :value="50">50 / página</option>
      </select>
      <button @click="go(page - 1)" :disabled="page <= 1"
        class="px-2 py-1 border rounded text-xs disabled:opacity-40 hover:bg-white">Anterior</button>
      <span class="text-xs text-gray-600">Página {{ page }} de {{ totalPages }}</span>
      <button @click="go(page + 1)" :disabled="page >= totalPages"
        class="px-2 py-1 border rounded text-xs disabled:opacity-40 hover:bg-white">Siguiente</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ page: number; pageSize: number; total: number }>();
const emit = defineEmits<{ (e: "update:page", value: number): void; (e: "update:pageSize", value: number): void }>();

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const start = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1));
const end = computed(() => Math.min(props.total, props.page * props.pageSize));

function go(value: number) {
  if (value < 1 || value > totalPages.value) return;
  emit("update:page", value);
}

function changeSize(value: string) {
  emit("update:pageSize", Number(value));
  emit("update:page", 1);
}
</script>
