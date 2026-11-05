<template>
  <div class="min-h-screen p-4 sm:p-6">
    <PageHeader title="Empleados y constancias" description="Administra personas y conserva sus documentos importantes." eyebrow="Administración" />

    <section class="border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-semibold">Alta de empleado</h2>
          <label for="employees-import" class="text-sm text-blue-600 hover:underline cursor-pointer">
            Importar Excel
            <input id="employees-import" type="file" accept=".xlsx,.xls" class="sr-only" @change="onImport" />
        </label>
      </div>
      <form @submit.prevent="create" class="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <div>
          <label class="block text-xs font-medium text-gray-600">Nombre</label>
          <input v-model="form.name" required class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Puesto</label>
          <input v-model="form.position" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Email</label>
          <input v-model="form.email" type="email" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div class="md:col-span-3 flex justify-end">
          <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Crear</button>
        </div>
      </form>
      <p v-if="msg" class="text-sm mt-2" :class="err ? 'text-red-600' : 'text-green-600'">{{ msg }}</p>
    </section>

    <p v-if="importMsg" class="text-sm text-gray-600 mb-2">{{ importMsg }}</p>
    <p v-if="loadError" role="alert" class="text-sm text-red-700 mb-2">{{ loadError }}</p>
    <p v-else-if="loading" role="status" class="text-sm text-gray-600 mb-2">Cargando empleados...</p>
    <section class="overflow-auto border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 class="font-semibold mb-2">Empleados</h2>
      <table class="min-w-full text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left px-3 py-2">Nombre</th>
            <th class="text-left px-3 py-2">Puesto</th>
            <th class="text-left px-3 py-2">Email</th>
            <th class="text-left px-3 py-2">Constancias</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in employees" :key="e.id" class="border-t">
            <td class="px-3 py-1.5">{{ e.name }}</td>
            <td class="px-3 py-1.5">{{ e.position || "-" }}</td>
            <td class="px-3 py-1.5">{{ e.email || "-" }}</td>
            <td class="px-3 py-1.5">{{ e._count?.constancias ?? 0 }}</td>
            <td class="px-3 py-1.5 text-right space-x-2">
              <button @click="select(e)" class="text-blue-600 text-xs hover:underline">Constancias</button>
              <button v-if="isAdmin" @click="remove(e.id)" class="text-red-600 text-xs hover:underline">Eliminar</button>
            </td>
          </tr>
          <tr v-if="!employees.length">
            <td colspan="5" class="px-3 py-4 text-center text-gray-400">Sin empleados</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="selected" class="bg-white p-4 rounded shadow">
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-semibold">Constancias de {{ selected.name }}</h2>
        <button @click="selected = null" class="text-xs text-gray-500 hover:underline">Cerrar</button>
      </div>

      <form @submit.prevent="upload" class="grid grid-cols-1 md:grid-cols-3 gap-2 items-end mb-4">
        <div>
          <label class="block text-xs font-medium text-gray-600">Título</label>
          <input v-model="cForm.title" required class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Descripción</label>
          <input v-model="cForm.description" class="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600">Archivo</label>
          <input type="file" @change="onFile" class="w-full text-sm" />
        </div>
        <div class="md:col-span-3 flex justify-end">
          <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Subir constancia</button>
        </div>
      </form>
      <p v-if="cMsg" class="text-sm mb-2" :class="cErr ? 'text-red-600' : 'text-green-600'">{{ cMsg }}</p>

      <table class="min-w-full text-sm">
        <thead class="bg-gray-100">
          <tr>
            <th class="text-left px-3 py-2">Fecha</th>
            <th class="text-left px-3 py-2">Título</th>
            <th class="text-left px-3 py-2">Descripción</th>
            <th class="text-left px-3 py-2">Archivo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in constancias" :key="c.id" class="border-t">
            <td class="px-3 py-1.5">{{ new Date(c.created_at).toLocaleString() }}</td>
            <td class="px-3 py-1.5">{{ c.title }}</td>
            <td class="px-3 py-1.5">{{ c.description || "-" }}</td>
            <td class="px-3 py-1.5">
              <a v-if="c.file_path" :href="fileUrl(c.file_path)" target="_blank" class="text-blue-600 hover:underline text-xs">
                {{ c.file_name || "Descargar" }}
              </a>
              <span v-else class="text-gray-400 text-xs">-</span>
            </td>
            <td class="px-3 py-1.5 text-right">
              <button v-if="isAdmin" @click="removeConst(c.id)" class="text-red-600 text-xs hover:underline">Eliminar</button>
            </td>
          </tr>
          <tr v-if="!constancias.length">
            <td colspan="5" class="px-3 py-4 text-center text-gray-400">Sin constancias</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted } from "vue";
import { useAuth } from "../auth";
import PageHeader from "../components/ui/PageHeader.vue";
import {
  apiListEmployees,
  apiCreateEmployee,
  apiDeleteEmployee,
  apiListConstancias,
  apiUploadConstancia,
  apiDeleteConstancia,
  apiImportEmployees,
} from "../api";
import { employeeSchema } from "../validation/schemas";

const auth = useAuth();
const isAdmin = auth.isAdmin;

const employees = shallowRef<any[]>([]);
const selected = ref<any>(null);
const constancias = shallowRef<any[]>([]);
const form = ref({ name: "", position: "", email: "" });
const msg = ref("");
const err = ref(false);
const importMsg = ref("");
const loading = ref(false);
const loadError = ref("");

const cForm = ref({ title: "", description: "" });
const cFile = ref<File | null>(null);
const cMsg = ref("");
const cErr = ref(false);

function fileUrl(p: string) {
  return `${import.meta.env.VITE_API_BASE ?? "http://localhost:3000"}/uploads/${p}`;
}

async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    const data = await apiListEmployees();
    employees.value = data.items;
  } catch (e: any) {
    loadError.value = e.message || "No se pudieron cargar los empleados.";
  } finally {
    loading.value = false;
  }
}

async function create() {
  msg.value = "";
  err.value = false;
  const parsed = employeeSchema.safeParse(form.value);
  if (!parsed.success) {
    err.value = true;
    msg.value = parsed.error.issues[0]?.message || "Revisa los datos ingresados.";
    return;
  }
  form.value.name = parsed.data.name;
  try {
    await apiCreateEmployee(form.value);
    msg.value = "Empleado creado.";
    form.value = { name: "", position: "", email: "" };
    await load();
  } catch (e: any) {
    err.value = true;
    msg.value = e.message || "Error";
  }
}

async function onImport(e: any) {
  const file = e.target.files?.[0];
  if (!file) return;
  importMsg.value = "Importando...";
  try {
    const res = await apiImportEmployees(file);
    importMsg.value = `Importados: ${res.created} de ${res.total}` + (res.errors?.length ? ` (${res.errors.length} errores)` : "");
    await load();
  } catch (err: any) {
    importMsg.value = err.message || "Error al importar";
  }
  e.target.value = "";
}

async function remove(id: string) {
  if (!confirm("¿Eliminar empleado?")) return;
  try {
    await apiDeleteEmployee(id);
    if (selected.value?.id === id) selected.value = null;
    await load();
  } catch (e: any) {
    alert(e.message);
  }
}

async function select(e: any) {
  selected.value = e;
  const data = await apiListConstancias(e.id);
  constancias.value = data.items;
}

function onFile(e: any) {
  cFile.value = e.target.files?.[0] || null;
}

async function upload() {
  cMsg.value = "";
  cErr.value = false;
  try {
    await apiUploadConstancia(selected.value.id, cForm.value.title, cForm.value.description, cFile.value);
    cMsg.value = "Constancia subida.";
    cForm.value = { title: "", description: "" };
    cFile.value = null;
    const data = await apiListConstancias(selected.value.id);
    constancias.value = data.items;
    await load();
  } catch (e: any) {
    cErr.value = true;
    cMsg.value = e.message || "Error";
  }
}

async function removeConst(id: string) {
  if (!confirm("¿Eliminar constancia?")) return;
  try {
    await apiDeleteConstancia(id);
    const data = await apiListConstancias(selected.value.id);
    constancias.value = data.items;
    await load();
  } catch (e: any) {
    alert(e.message);
  }
}

onMounted(load);
</script>
