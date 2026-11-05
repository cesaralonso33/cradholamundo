<template>
  <div>
    <template v-if="auth.isAuthenticated.value && route.path !== '/login'">
      <aside id="app-sidebar" class="app-shell__sidebar app-shell__sidebar--light" :class="{ 'is-open': menuOpen }" :aria-hidden="isMobile && !menuOpen" :inert="isMobile && !menuOpen">
        <div class="app-shell__brand">
          <span class="app-shell__eyebrow">Operaciones</span>
          <h1>Inventario Rápido</h1>
          <p class="app-shell__workspace">Workspace operativo</p>
        </div>
        <nav aria-label="Navegación principal" class="app-shell__nav">
          <div class="app-shell__group">
            <p class="app-shell__group-title">Operación</p>
            <router-link to="/"><LayoutDashboard :size="17" />Inventario</router-link>
            <router-link v-if="auth.hasPermission('history')" to="/history"><History :size="17" />Historial</router-link>
            <router-link v-if="auth.hasPermission('papeleria')" to="/papeleria"><ClipboardList :size="17" />Papelería</router-link>
          </div>
          <div v-if="auth.isAdmin.value || auth.hasPermission('users') || auth.hasPermission('settings')" class="app-shell__group">
            <p class="app-shell__group-title">Administración</p>
            <router-link v-if="auth.hasPermission('users')" to="/users"><Users :size="17" />Usuarios</router-link>
            <router-link v-if="auth.hasPermission('settings')" to="/settings"><Settings :size="17" />Configuración</router-link>
            <router-link v-if="auth.isAdmin.value" to="/employees"><Users :size="17" />Empleados</router-link>
            <router-link v-if="auth.isAdmin.value" to="/roles"><ShieldCheck :size="17" />Roles</router-link>
            <router-link v-if="auth.isAdmin.value" to="/audit"><FileText :size="17" />Auditoría</router-link>
          </div>
          <div v-if="auth.hasPermission('api')" class="app-shell__group">
            <p class="app-shell__group-title">Recursos</p>
            <router-link to="/api-docs"><FileText :size="17" />API</router-link>
          </div>
          <SyncStatusBadge />
          <Button variant="ghost" size="sm" class="app-shell__logout" @click="logout"><LogOut :size="16" />Salir ({{ auth.user.value?.username }})</Button>
        </nav>
      </aside>
      <Button variant="outline" size="icon" class="app-shell__menu-toggle" :aria-label="menuOpen ? 'Cerrar menú' : 'Abrir menú'" :aria-expanded="menuOpen" aria-controls="app-sidebar" @click="menuOpen = !menuOpen" @keydown.esc="menuOpen = false">
        <X v-if="menuOpen" :size="20" aria-hidden="true" />
        <Menu v-else :size="20" aria-hidden="true" />
      </Button>
      <div v-if="menuOpen" class="app-shell__scrim" aria-hidden="true" @click="menuOpen = false"></div>
    </template>
    <main :class="{ 'app-shell__content': auth.isAuthenticated.value && route.path !== '/login' }">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuth } from "./auth";
import SyncStatusBadge from "./components/SyncStatusBadge.vue";
import Button from "./components/ui/Button.vue";
import { ClipboardList, FileText, History, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users, X } from "@lucide/vue";

const auth = useAuth();
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const isMobile = ref(false);
let mediaQuery: MediaQueryList | undefined;

function updateViewport() {
  if (typeof window.matchMedia !== "function") return;
  isMobile.value = window.matchMedia("(max-width: 720px)").matches;
}

watch(() => route.path, () => { menuOpen.value = false; });
onMounted(() => {
  updateViewport();
  if (typeof window.matchMedia === "function") {
    mediaQuery = window.matchMedia("(max-width: 720px)");
    mediaQuery.addEventListener("change", updateViewport);
  }
});
onUnmounted(() => mediaQuery?.removeEventListener("change", updateViewport));

function logout() {
  auth.logout();
  router.push("/login");
}
</script>
