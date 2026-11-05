<template>
  <div class="overflow-auto border rounded">
    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
      <span class="text-xs text-gray-500">Columnas opcionales ocultas por defecto</span>
      <button @click="showExtra = !showExtra" class="text-xs text-blue-600 hover:underline">
        {{ showExtra ? "Ocultar detalles" : "Mostrar cantidad y categoría" }}
      </button>
    </div>
    <table class="min-w-full text-sm">
      <thead class="bg-gray-100 sticky top-0">
        <tr>
          <th class="text-left px-3 py-2">Fecha y hora</th>
          <th class="text-left px-3 py-2">SKU</th>
          <th class="text-left px-3 py-2">Nombre</th>
          <th v-if="showExtra" class="text-left px-3 py-2">Categoría</th>
          <th class="text-left px-3 py-2">Ubicación</th>
          <th v-if="showExtra" class="text-right px-3 py-2">Cantidad</th>
          <th class="text-center px-3 py-2">Sync</th>
          <th class="text-center px-3 py-2">Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="border-t hover:bg-gray-50">
          <td class="px-3 py-1.5 text-gray-500">{{ formatTime(row.createdAt) }}</td>
          <td class="px-3 py-1.5 font-mono">{{ row.sku }}</td>
          <td class="px-3 py-1.5">{{ row.name }}</td>
          <td v-if="showExtra" class="px-3 py-1.5">{{ row.category || "-" }}</td>
          <td class="px-3 py-1.5">{{ row.location || "-" }}</td>
          <td v-if="showExtra" class="px-3 py-1.5 text-right">{{ row.quantity }}</td>
          <td class="px-3 py-1.5 text-center">
            <span v-if="row.synced" class="text-green-600">✓</span>
            <span v-else class="text-amber-500">…</span>
          </td>
          <td class="px-3 py-1.5 text-center space-x-2">
            <button v-if="canEdit(row)" @click="askEdit(row)"
              class="text-xs text-blue-600 hover:underline">Editar</button>
            <button v-if="row.location !== 'Archivo'" @click="askArchive(row.sku)"
              class="text-xs text-amber-700 hover:underline">Archivar</button>
            <span v-else class="text-xs text-gray-400">Archivado</span>
            <button v-if="isAdmin" @click="askDelete(row.sku)"
              class="text-xs text-red-600 hover:underline">Eliminar</button>
          </td>
        </tr>
        <tr v-if="!rows.length">
          <td :colspan="showExtra ? 8 : 6" class="px-3 py-4 text-center text-gray-400">Sin capturas aún</td>
        </tr>
      </tbody>
    </table>

    <!-- Archive confirmation modal -->
    <div v-if="showConfirm" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded shadow p-5 w-full max-w-sm">
        <h3 class="font-semibold mb-2">Confirmar archivo</h3>
        <p class="text-sm text-gray-600 mb-4">
          ¿Deseas mover el item <span class="font-mono">{{ pendingSku }}</span> a la ubicación "Archivo"?
        </p>
        <div class="flex justify-end gap-2">
          <button @click="cancel" class="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancelar</button>
          <button @click="confirmArchive" :disabled="loading"
            class="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50">
            {{ loading ? "Archivando..." : "Archivar" }}
          </button>
        </div>
        <p v-if="error" class="text-red-600 text-sm mt-2">{{ error }}</p>
      </div>
    </div>

    <!-- Edit modal -->
    <div v-if="showEdit" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded shadow p-5 w-full max-w-md">
        <h3 class="font-semibold mb-3">Editar artículo</h3>
        <form @submit.prevent="confirmEdit" class="space-y-2">
          <div>
            <label class="block text-xs font-medium text-gray-600">SKU</label>
            <input :value="editForm.sku" disabled class="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Nombre</label>
            <input v-model="editForm.name" required class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Categoría</label>
            <input v-model="editForm.category" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Cantidad</label>
            <input v-model.number="editForm.quantity" type="number" min="0" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <p v-if="error" class="text-red-600 text-sm">{{ error }}</p>
          <div class="flex justify-end gap-2 pt-1">
            <button type="button" @click="cancelEdit" class="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancelar</button>
            <button type="submit" :disabled="loading"
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
              {{ loading ? "Guardando..." : "Guardar" }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete confirmation modal -->
    <div v-if="showDelete" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded shadow p-5 w-full max-w-sm">
        <h3 class="font-semibold mb-2 text-red-600">Confirmar eliminación</h3>
        <p class="text-sm text-gray-600 mb-4">
          ¿Eliminar el producto <span class="font-mono">{{ pendingSku }}</span>? Esta acción no se puede deshacer.
        </p>
        <div class="flex justify-end gap-2">
          <button @click="cancelDelete" class="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancelar</button>
          <button @click="confirmDelete" :disabled="loading"
            class="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
            {{ loading ? "Eliminando..." : "Eliminar" }}
          </button>
        </div>
        <p v-if="error" class="text-red-600 text-sm mt-2">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { db } from "../db";
import { apiArchiveProduct, apiDeleteProduct, apiUpdateProduct } from "../api";
import { useAuth } from "../auth";
import { formatDateTime } from "../utils/format";

const auth = useAuth();
const isAdmin = auth.isAdmin;

const showExtra = ref(false);

const showConfirm = ref(false);
const showDelete = ref(false);
const showEdit = ref(false);
const pendingSku = ref("");
const editForm = ref({ sku: "", name: "", category: "", quantity: 0 });
const loading = ref(false);
const error = ref("");

const props = defineProps<{ rows: any[]; serverMode?: boolean }>();
const emit = defineEmits<{ (e: "changed"): void }>();

function formatTime(ts: number) {
  return formatDateTime(ts);
}

function canEdit(row: any) {
  if (isAdmin.value) return true;
  return row.location && row.location === auth.user.value?.username;
}

function askEdit(row: any) {
  editForm.value = {
    sku: row.sku,
    name: row.name,
    category: row.category || "",
    quantity: row.quantity ?? 0,
  };
  error.value = "";
  showEdit.value = true;
}

function cancelEdit() {
  showEdit.value = false;
  pendingSku.value = "";
}

async function confirmEdit() {
  loading.value = true;
  error.value = "";
  try {
    await apiUpdateProduct(editForm.value.sku, {
      name: editForm.value.name,
      category: editForm.value.category || null,
      quantity: editForm.value.quantity,
    });
    if (props.serverMode) {
      emit("changed");
    } else {
      await db.captures.where("sku").equals(editForm.value.sku).modify({
        name: editForm.value.name,
        category: editForm.value.category || undefined,
        quantity: Number(editForm.value.quantity) || 0,
      });
    }
    showEdit.value = false;
  } catch (e: any) {
    error.value = e.message || "Error al guardar";
  } finally {
    loading.value = false;
  }
}

function askArchive(sku: string) {
  pendingSku.value = sku;
  error.value = "";
  showConfirm.value = true;
}

function cancel() {
  showConfirm.value = false;
  pendingSku.value = "";
}

async function confirmArchive() {
  loading.value = true;
  error.value = "";
  try {
    await apiArchiveProduct(pendingSku.value);
    if (props.serverMode) {
      emit("changed");
    } else {
      await db.captures.where("sku").equals(pendingSku.value).modify({ location: "Archivo" });
    }
    showConfirm.value = false;
    pendingSku.value = "";
  } catch (e: any) {
    error.value = e.message || "Error al archivar";
  } finally {
    loading.value = false;
  }
}

function askDelete(sku: string) {
  pendingSku.value = sku;
  error.value = "";
  showDelete.value = true;
}

function cancelDelete() {
  showDelete.value = false;
  pendingSku.value = "";
}

async function confirmDelete() {
  loading.value = true;
  error.value = "";
  try {
    await apiDeleteProduct(pendingSku.value);
    if (props.serverMode) {
      emit("changed");
    } else {
      await db.captures.where("sku").equals(pendingSku.value).delete();
    }
    showDelete.value = false;
    pendingSku.value = "";
  } catch (e: any) {
    error.value = e.message || "Error al eliminar";
  } finally {
    loading.value = false;
  }
}
</script>
