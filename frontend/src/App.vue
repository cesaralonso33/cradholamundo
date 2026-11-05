<template>
  <div>
    <header v-if="auth.isAuthenticated.value && route.path !== '/login'" class="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 shadow-sm">
      <h1 class="text-xl font-bold">Inventario Rápido</h1>
      <nav aria-label="Navegación principal" class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <router-link v-if="auth.hasPermission('users')" to="/users" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Usuarios</router-link>
        <router-link v-if="auth.hasPermission('settings')" to="/settings" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Configuración</router-link>
        <router-link v-if="auth.hasPermission('history')" to="/history" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Historial</router-link>
        <router-link v-if="auth.isAdmin.value" to="/employees" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Empleados</router-link>
        <router-link v-if="auth.isAdmin.value" to="/roles" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Roles</router-link>
        <router-link v-if="auth.isAdmin.value" to="/audit" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Auditoría</router-link>
        <router-link v-if="auth.hasPermission('papeleria')" to="/papeleria" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Papelería</router-link>
        <router-link v-if="auth.hasPermission('api')" to="/api-docs" class="text-blue-600 text-xs sm:text-sm hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">API</router-link>
        <SyncStatusBadge />
        <button @click="logout" class="text-sm text-gray-600 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Salir ({{ auth.user.value?.username }})</button>
      </nav>
    </header>
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "./auth";
import SyncStatusBadge from "./components/SyncStatusBadge.vue";

const auth = useAuth();
const route = useRoute();
const router = useRouter();

function logout() {
  auth.logout();
  router.push("/login");
}
</script>
