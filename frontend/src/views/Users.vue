<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Usuarios</h1>
      <router-link to="/" class="text-blue-600 text-sm">← Inventario</router-link>
    </header>

    <section class="bg-white p-4 rounded shadow mb-4">
      <h2 class="font-semibold mb-2">{{ editingUser ? "Editar usuario" : "Alta de usuario" }}</h2>
      <form @submit.prevent="saveUser" class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
        <div>
          <label class="block text-xs font-medium text-gray-600">Usuario</label>
          <input v-model="form.username" required class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">
            Contraseña <span v-if="editingUser" class="text-gray-400">(opcional)</span>
          </label>
          <input v-model="form.password" type="password" :required="!editingUser"
            :placeholder="editingUser ? 'Dejar en blanco para conservar' : ''"
            class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Email</label>
          <input v-model="form.email" type="email" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Rol</label>
          <select v-model="form.role" class="w-full border rounded px-2 py-1.5 text-sm">
            <option v-for="r in roles" :key="r.name" :value="r.name">{{ r.name }}</option>
          </select>
        </div>
        <div class="md:col-span-4 flex justify-end gap-2">
          <button v-if="editingUser" type="button" @click="cancelEdit"
            class="border px-4 py-1.5 rounded text-sm hover:bg-gray-50">Cancelar</button>
          <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
            {{ editingUser ? "Guardar cambios" : "Crear" }}
          </button>
        </div>
      </form>
      <p v-if="msg" class="text-sm mt-2" :class="err ? 'text-red-600' : 'text-green-600'">{{ msg }}</p>
    </section>

    <section class="bg-white p-4 rounded shadow">
      <h2 class="font-semibold mb-2">Listado</h2>
      <table class="min-w-full text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left px-3 py-2">Usuario</th>
            <th class="text-left px-3 py-2">Email</th>
            <th class="text-left px-3 py-2">Rol</th>
            <th class="text-left px-3 py-2">Creado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="border-t">
            <td class="px-3 py-1.5">{{ u.username }}</td>
            <td class="px-3 py-1.5">{{ u.email || "-" }}</td>
            <td class="px-3 py-1.5">{{ u.role }}</td>
            <td class="px-3 py-1.5">{{ new Date(u.created_at).toLocaleString() }}</td>
            <td class="px-3 py-1.5 text-right space-x-2">
              <button @click="editUser(u)" class="text-blue-600 text-xs hover:underline">Editar</button>
              <button @click="remove(u.id)" class="text-red-600 text-xs hover:underline">Eliminar</button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted } from "vue";
import { apiListUsers, apiListRoleOptions, apiDeleteUser, apiUpdateUser, registerRequest } from "../api";

const users = shallowRef<any[]>([]);
const roles = shallowRef<{ name: string; description?: string | null }[]>([]);
const form = ref({ username: "", password: "", email: "", role: "user" });
const editingUser = ref<any>(null);
const msg = ref("");
const err = ref(false);

async function load() {
  const data = await apiListUsers();
  users.value = data.items;
}

async function saveUser() {
  msg.value = "";
  err.value = false;
  try {
    if (editingUser.value) {
      await apiUpdateUser(editingUser.value.id, form.value);
      msg.value = "Usuario actualizado.";
    } else {
      await registerRequest(form.value);
      msg.value = "Usuario creado.";
    }
    cancelEdit();
    await load();
  } catch (e: any) {
    err.value = true;
    msg.value = e.message || "Error";
  }
}

function editUser(user: any) {
  editingUser.value = user;
  form.value = {
    username: user.username,
    password: "",
    email: user.email || "",
    role: user.role,
  };
  msg.value = "";
}

function cancelEdit() {
  editingUser.value = null;
  const defaultRole = roles.value.some((r) => r.name === "user") ? "user" : roles.value[0]?.name || "user";
  form.value = { username: "", password: "", email: "", role: defaultRole };
}

async function remove(id: string) {
  if (!confirm("¿Eliminar usuario?")) return;
  try {
    await apiDeleteUser(id);
    await load();
  } catch (e: any) {
    alert(e.message);
  }
}

async function loadRoles() {
  try {
    const data = await apiListRoleOptions();
    roles.value = data.items;
    if (!roles.value.some((r) => r.name === form.value.role)) {
      form.value.role = roles.value[0]?.name || "user";
    }
  } catch {}
}

onMounted(async () => {
  await Promise.all([load(), loadRoles()]);
});
</script>
