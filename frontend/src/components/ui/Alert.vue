<script setup lang="ts">
import { computed } from "vue";
import { cn } from "../../lib/utils";
const props = withDefaults(defineProps<{ variant?: "info" | "success" | "warning" | "danger" }>(), { variant: "info" });
const classes = computed(() => cn(
  "rounded-lg border px-4 py-3 text-sm",
  props.variant === "info" && "border-blue-200 bg-blue-50 text-blue-800",
  props.variant === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
  props.variant === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
  props.variant === "danger" && "border-red-200 bg-red-50 text-red-800",
));
</script>
<template><div :class="classes" role="alert"><slot /></div></template>
