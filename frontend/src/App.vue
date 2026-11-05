<template>
  <div>
    <template v-if="auth.isAuthenticated.value && route.path !== '/login'">
      <aside class="app-shell__sidebar app-shell__sidebar--light" :class="{ 'is-open': menuOpen }">
        <div class="app-shell__brand">
          <span class="app-shell__eyebrow">Operaciones</span>
          <h1>Inventario Rápido</h1>
        </div>
        <nav aria-label="Navegación principal" class="app-shell__nav">
          <div class="app-shell__group">
            <p class="app-shell__group-title">Operación</p>
            <router-link v-if="auth.hasPermission('history')" to="/history">Historial</router-link>
            <router-link v-if="auth.hasPermission('papeleria')" to="/papeleria">Papelería</router-link>
          </div>
          <div v-if="auth.isAdmin.value || auth.hasPermission('users') || auth.hasPermission('settings')" class="app-shell__group">
            <p class="app-shell__group-title">Administración</p>
            <router-link v-if="auth.hasPermission('users')" to="/users">Usuarios</router-link>
            <router-link v-if="auth.hasPermission('settings')" to="/settings">Configuración</router-link>
            <router-link v-if="auth.isAdmin.value" to="/employees">Empleados</router-link>
            <router-link v-if="auth.isAdmin.value" to="/roles">Roles</router-link>
            <router-link v-if="auth.isAdmin.value" to="/audit">Auditoría</router-link>
          </div>
          <div v-if="auth.hasPermission('api')" class="app-shell__group">
            <p class="app-shell__group-title">Recursos</p>
            <router-link to="/api-docs">API</router-link>
          </div>
          <SyncStatusBadge />
          <Button variant="ghost" size="sm" class="app-shell__logout" @click="logout">Salir ({{ auth.user.value?.username }})</Button>
        </nav>
      </aside>
      <Button variant="outline" size="icon" class="app-shell__menu-toggle" aria-label="Abrir menú" @click="menuOpen = !menuOpen">
        <span aria-hidden="true">☰</span>
      </Button>
      <div v-if="menuOpen" class="app-shell__scrim" aria-hidden="true" @click="menuOpen = false"></div>
    </template>
    <main :class="{ 'app-shell__content': auth.isAuthenticated.value && route.path !== '/login' }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "./auth";
import SyncStatusBadge from "./components/SyncStatusBadge.vue";
import Button from "./components/ui/Button.vue";

const auth = useAuth();
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);

watch(() => route.path, () => { menuOpen.value = false; });

function logout() {
  auth.logout();
  router.push("/login");
}
</script>
