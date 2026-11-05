<script setup lang="ts">
import { computed } from "vue";
import { cn } from "../../lib/utils";

const props = withDefaults(defineProps<{
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
}>(), { variant: "default", size: "default", disabled: false });

const classes = computed(() => cn(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:pointer-events-none disabled:opacity-50",
  props.variant === "default" && "bg-blue-600 text-white hover:bg-blue-700",
  props.variant === "secondary" && "bg-slate-100 text-slate-900 hover:bg-slate-200",
  props.variant === "outline" && "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  props.variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  props.variant === "destructive" && "bg-red-600 text-white hover:bg-red-700",
  props.size === "default" && "h-10 px-4 py-2",
  props.size === "sm" && "h-9 rounded-md px-3",
  props.size === "lg" && "h-11 rounded-md px-8",
  props.size === "icon" && "h-10 w-10",
));
</script>

<template>
  <button :class="classes" :disabled="disabled"><slot /></button>
</template>
