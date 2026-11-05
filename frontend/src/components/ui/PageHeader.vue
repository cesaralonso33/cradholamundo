<template>
  <header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div class="max-w-2xl">
      <p v-if="eyebrow" class="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-blue-600">{{ eyebrow }}</p>
      <h1 class="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"><slot name="title">{{ title }}</slot></h1>
      <p v-if="description" class="mt-2 text-sm leading-6 text-slate-500">{{ description }}</p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap gap-2"><slot name="actions" /></div>
  </header>
</template>
<script setup lang="ts">
defineProps<{ title?: string; description?: string; eyebrow?: string }>();
</script>
