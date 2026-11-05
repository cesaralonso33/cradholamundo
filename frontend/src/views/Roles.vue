<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Roles y permisos</h1>
      <router-link to="/" class="text-blue-600 text-sm">← Inventario</router-link>
    </header>

    <section class="bg-white p-4 rounded shadow mb-4">
      <h2 class="font-semibold mb-2">{{ editing ? "Editar rol" : "Nuevo rol" }}</h2>
      <form @submit.prevent="save" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium text-gray-600">Nombre</label>
            <input v-model="form.name" required :disabled="editing?.name === 'admin'"
              class="w-full border rounded px-2 py-1.5 text-sm disabled:bg-gray-100" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Descripción</label>
            <input v-model="form.description" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Permisos</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <label v-for="p in permissions" :key="p.key" class="flex items-center gap-2 text-sm border rounded px-2 py-1.5">
              <input type="checkbox" :value="p.key" v-model="form.permissions"
                :disabled="editing?.name === 'admin'" />
              {{ p.label }}
            </label>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <button v-if="editing" type="button" @click="cancel" class="border px-4 py-1.5 rounded text-sm hover:bg-gray-50">Cancelar</button>
          <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
            {{ editing ? "Guardar cambios" : "Crear rol" }}
          </button>
        </div>
      </form>
      <p v-if="msg" class="text-sm mt-2" :class="err ? 'text-red-600' : 'text-green-600'">{{ msg }}</p>
    </section>

    <section class="bg-white p-4 rounded shadow overflow-auto">
      <h2 class="font-semibold mb-2">Roles</h2>
      <table class="min-w-full text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left px-3 py-2">Nombre</th>
            <th class="text-left px-3 py-2">Descripción</th>
            <th class="text-left px-3 py-2">Permisos</th>
            <th class="text-left px-3 py-2">Usuarios</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in roles" :key="r.id" class="border-t">
            <td class="px-3 py-1.5 font-mono">{{ r.name }}</td>
            <td class="px-3 py-1.5">{{ r.description || "-" }}</td>
            <td class="px-3 py-1.5">{{ r.permissions?.length || 0 }}</td>
            <td class="px-3 py-1.5">{{ r.user_count || 0 }}</td>
            <td class="px-3 py-1.5 text-right space-x-2">
              <button @click="edit(r)" class="text-blue-600 text-xs hover:underline">Editar</button>
              <button v-if="r.name !== 'admin'" @click="remove(r)" class="text-red-600 text-xs hover:underline">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted } from "vue";
import { apiListPermissions, apiListRoles, apiCreateRole, apiUpdateRole, apiDeleteRole } from "../api";

const permissions = shallowRef<{ key: string; label: string }[]>([]);
const roles = shallowRef<any[]>([]);
const editing = ref<any>(null);
const form = ref({ name: "", description: "", permissions: [] as string[] });
const msg = ref("");
const err = ref(false);

async function load() {
  const [perms, roleData] = await Promise.all([apiListPermissions(), apiListRoles()]);
  permissions.value = perms.items;
  roles.value = roleData.items;
}

async function save() {
  msg.value = "";
  err.value = false;
  try {
    if (editing.value) {
      await apiUpdateRole(editing.value.id, form.value);
      msg.value = "Rol actualizado.";
    } else {
      await apiCreateRole(form.value);
      msg.value = "Rol creado.";
    }
    cancel();
    await load();
  } catch (e: any) {
    err.value = true;
    msg.value = e.message || "Error";
  }
}

function edit(role: any) {
  editing.value = role;
  form.value = {
    name: role.name,
    description: role.description || "",
    permissions: [...(role.permissions || [])],
  };
  msg.value = "";
}

function cancel() {
  editing.value = null;
  form.value = { name: "", description: "", permissions: [] };
}

async function remove(role: any) {
  if (!confirm(`¿Eliminar el rol "${role.name}"?`)) return;
  try {
    await apiDeleteRole(role.id);
    await load();
  } catch (e: any) {
    alert(e.message);
  }
}

onMounted(load);
</script>
