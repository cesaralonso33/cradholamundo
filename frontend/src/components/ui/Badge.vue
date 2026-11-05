<script setup lang="ts">
import { computed } from "vue";
import { cn } from "../../lib/utils";

const props = withDefaults(defineProps<{ variant?: "default" | "success" | "warning" | "danger" }>(), { variant: "default" });
const classes = computed(() => cn(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  props.variant === "default" && "bg-slate-100 text-slate-700",
  props.variant === "success" && "bg-emerald-50 text-emerald-700",
  props.variant === "warning" && "bg-amber-50 text-amber-700",
  props.variant === "danger" && "bg-red-50 text-red-700",
));
</script>
<template><span :class="classes"><slot /></span></template>
