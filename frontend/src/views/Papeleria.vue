<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <header class="flex flex-wrap items-center justify-between gap-2 mb-4">
      <h1 class="text-xl font-bold">Papelería</h1>
      <router-link to="/" class="text-blue-600 text-xs sm:text-sm hover:underline">← Inventario</router-link>
    </header>

    <!-- Tabs -->
    <div class="flex gap-2 mb-4">
      <button @click="tab = 'orders'"
        :class="tab === 'orders' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'"
        class="px-4 py-1.5 rounded text-sm border">Pedidos</button>
      <button @click="tab = 'items'"
        :class="tab === 'items' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'"
        class="px-4 py-1.5 rounded text-sm border">Catálogo</button>
    </div>

    <!-- ===== PEDIDOS ===== -->
    <template v-if="tab === 'orders'">
      <section class="bg-white p-4 rounded shadow">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-3">
            <h2 class="font-semibold">{{ isAdmin ? "Bandeja de pedidos" : "Mis pedidos" }}</h2>
            <span v-if="isAdmin" class="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
              {{ pendingCount }} pendientes
            </span>
          </div>
          <button @click="openNewOrder"
            class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Abrir pedido</button>
        </div>
        <p v-if="orderMsg" class="text-sm mb-2" :class="orderErr ? 'text-red-600' : 'text-green-600'">{{ orderMsg }}</p>

        <div class="overflow-auto border rounded">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-100">
              <tr>
                <th class="text-left px-3 py-2">Folio</th>
                <th v-if="isAdmin" class="text-left px-3 py-2">Usuario</th>
                <th class="text-left px-3 py-2">Fecha</th>
                <th class="text-left px-3 py-2">Estado</th>
                <th class="text-left px-3 py-2">Artículos</th>
                <th class="text-left px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in orders" :key="o.id" class="border-t hover:bg-gray-50">
                <td class="px-3 py-1.5 font-mono">{{ o.folio }}</td>
                <td v-if="isAdmin" class="px-3 py-1.5">{{ o.user?.username }}</td>
                <td class="px-3 py-1.5">{{ new Date(o.created_at).toLocaleString() }}</td>
                <td class="px-3 py-1.5">
                  <span :class="o.status === 'CLOSED' ? 'text-green-600' : 'text-amber-600'">
                    {{ o.status === 'CLOSED' ? 'Cerrado' : 'Pendiente' }}
                  </span>
                </td>
                <td class="px-3 py-1.5">{{ o._count?.items || 0 }}</td>
                <td class="px-3 py-1.5 space-x-2">
                  <button @click="viewOrder(o)" class="text-blue-600 text-xs hover:underline">Ver</button>
                  <button v-if="isAdmin && o.status !== 'CLOSED'" @click="closeOrder(o.id)"
                    class="text-green-600 text-xs hover:underline">Cerrar</button>
                </td>
              </tr>
              <tr v-if="!orders.length">
                <td :colspan="isAdmin ? 6 : 5" class="px-3 py-4 text-center text-gray-400">Sin pedidos</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <!-- ===== CATALOGO ===== -->
    <template v-else>
      <section v-if="isAdmin" class="bg-white p-4 rounded shadow mb-4">
        <div class="flex items-center justify-between mb-2">
          <h2 class="font-semibold">{{ editingItem ? "Editar artículo" : "Alta de artículo" }}</h2>
          <label class="text-sm text-blue-600 hover:underline cursor-pointer">
            Importar Excel
            <input type="file" accept=".xlsx,.xls" class="hidden" @change="onImport" />
          </label>
        </div>
        <form @submit.prevent="saveItem" class="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
          <div>
            <label class="block text-xs font-medium text-gray-600">Artículo</label>
            <input v-model="form.name" required class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Unidad</label>
            <input v-model="form.unit" class="w-full border rounded px-2 py-1.5 text-sm" placeholder="PIEZA" />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-600">Existencia</label>
            <input v-model.number="form.quantity" type="number" min="0" class="w-full border rounded px-2 py-1.5 text-sm" />
          </div>
          <div class="flex justify-end gap-2">
            <button v-if="editingItem" type="button" @click="cancelEdit"
              class="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">
              {{ editingItem ? "Guardar" : "Agregar" }}
            </button>
          </div>
        </form>
        <p v-if="msg" class="text-sm mt-2" :class="err ? 'text-red-600' : 'text-green-600'">{{ msg }}</p>
        <p v-if="importMsg" class="text-sm text-gray-600 mt-2">{{ importMsg }}</p>
      </section>

      <section class="bg-white p-4 rounded shadow overflow-auto">
        <h2 class="font-semibold mb-2">Catálogo de artículos</h2>
        <table class="min-w-full text-sm">
          <thead class="bg-gray-100">
            <tr>
              <th class="text-left px-3 py-2">Artículo</th>
              <th class="text-left px-3 py-2">Unidad</th>
              <th class="text-right px-3 py-2">Existencia</th>
              <th v-if="isAdmin"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="it in items" :key="it.id" class="border-t">
              <td class="px-3 py-1.5">{{ it.name }}</td>
              <td class="px-3 py-1.5">{{ it.unit || "-" }}</td>
              <td class="px-3 py-1.5 text-right">
                <input v-if="isAdmin" type="number" min="0" :value="it.quantity" @change="updateQty(it, ($event.target as HTMLInputElement).value)"
                  class="w-20 border rounded px-1 py-0.5 text-sm text-right" />
                <span v-else>{{ it.quantity }}</span>
              </td>
              <td v-if="isAdmin" class="px-3 py-1.5 text-right space-x-2">
                <button @click="editItem(it)" class="text-blue-600 text-xs hover:underline">Editar</button>
                <button @click="remove(it.id)" class="text-red-600 text-xs hover:underline">Eliminar</button>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td :colspan="isAdmin ? 4 : 3" class="px-3 py-4 text-center text-gray-400">Sin artículos</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>

    <!-- ===== NEW ORDER MODAL ===== -->
    <div v-if="showNewOrder" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded shadow p-5 w-full max-w-2xl max-h-[85vh] overflow-auto">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">Nuevo pedido</h3>
          <button @click="closeNewOrder" class="text-xs text-gray-500 hover:underline">Cancelar</button>
        </div>
        <div class="overflow-auto border rounded mb-3 max-h-[50vh]">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-100 sticky top-0">
              <tr>
                <th class="text-left px-3 py-2">Artículo</th>
                <th class="text-left px-3 py-2">Unidad</th>
                <th class="text-right px-3 py-2">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in items" :key="it.id" class="border-t">
                <td class="px-3 py-1.5">{{ it.name }}</td>
                <td class="px-3 py-1.5">{{ it.unit || "-" }}</td>
                <td class="px-3 py-1.5 text-right">
                  <input type="number" min="0" v-model.number="orderQty[it.id]"
                    class="w-20 border rounded px-1 py-0.5 text-sm text-right" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="newOrderMsg" class="text-sm mb-2" :class="newOrderErr ? 'text-red-600' : 'text-green-600'">{{ newOrderMsg }}</p>
        <div class="flex justify-end gap-2">
          <button @click="closeNewOrder" class="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cancelar</button>
          <button @click="submitNewOrder" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">Enviar pedido</button>
        </div>
      </div>
    </div>

    <!-- ===== ORDER DETAIL MODAL ===== -->
    <div v-if="selectedOrder" class="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div class="bg-white rounded shadow p-5 w-full max-w-2xl max-h-[85vh] overflow-auto">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">Pedido {{ selectedOrder.folio }}</h3>
          <button @click="selectedOrder = null" class="text-xs text-gray-500 hover:underline">Cerrar</button>
        </div>
        <div class="flex flex-wrap gap-3 text-sm mb-3">
          <span>Usuario: {{ selectedOrder.user?.username }}</span>
          <span>Estado: {{ selectedOrder.status === 'CLOSED' ? 'Cerrado' : 'Pendiente' }}</span>
          <span>Fecha: {{ new Date(selectedOrder.created_at).toLocaleString() }}</span>
        </div>
        <div class="overflow-auto border rounded mb-3">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-100">
              <tr>
                <th class="text-left px-3 py-2">Artículo</th>
                <th class="text-right px-3 py-2">Cantidad</th>
                <th class="text-left px-3 py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="it in selectedOrder.items" :key="it.id" class="border-t">
                <td class="px-3 py-1.5">{{ it.item?.name }}</td>
                <td class="px-3 py-1.5 text-right">
                  <input v-if="isAdmin && selectedOrder.status !== 'CLOSED'" type="number" min="1" :value="it.quantity"
                    @change="editQty(it, ($event.target as HTMLInputElement).value)"
                    class="w-20 border rounded px-1 py-0.5 text-sm text-right" />
                  <span v-else>{{ it.quantity }}</span>
                </td>
                <td class="px-3 py-1.5">{{ it.note || "-" }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="editMsg" class="text-sm text-green-600 mb-2">{{ editMsg }}</p>
        <div class="flex justify-end gap-2">
          <button @click="selectedOrder = null" class="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">Cerrar</button>
          <button v-if="isAdmin && selectedOrder.status !== 'CLOSED'" @click="closeOrder(selectedOrder.id)"
            class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700">Cerrar pedido y entregar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted } from "vue";
import { useAuth } from "../auth";
import {
  apiListPapeleria,
  apiCreatePapeleria,
  apiUpdatePapeleria,
  apiDeletePapeleria,
  apiImportPapeleria,
  apiListPapeleriaOrders,
  apiCreatePapeleriaOrder,
  apiGetPapeleriaOrder,
  apiUpdatePapeleriaOrder,
  apiClosePapeleriaOrder,
} from "../api";

const auth = useAuth();
const isAdmin = auth.isAdmin;
const tab = ref<"orders" | "items">("orders");

const items = shallowRef<any[]>([]);
const form = ref({ name: "", unit: "", quantity: 0 });
const editingItem = ref<any>(null);
const msg = ref("");
const err = ref(false);
const importMsg = ref("");

const orders = shallowRef<any[]>([]);
const pendingCount = ref(0);
const orderQty = ref<Record<string, number>>({});
const orderMsg = ref("");
const orderErr = ref(false);

const showNewOrder = ref(false);
const newOrderMsg = ref("");
const newOrderErr = ref(false);

const selectedOrder = ref<any>(null);
const editMsg = ref("");

async function load() {
  const data = await apiListPapeleria();
  items.value = data.items;
  items.value.forEach((it) => {
    if (orderQty.value[it.id] === undefined) orderQty.value[it.id] = 0;
  });
  await loadOrders();
}

async function loadOrders() {
  const data = await apiListPapeleriaOrders();
  orders.value = data.items;
  pendingCount.value = data.pending || 0;
}

function openNewOrder() {
  newOrderMsg.value = "";
  newOrderErr.value = false;
  items.value.forEach((it) => { orderQty.value[it.id] = 0; });
  showNewOrder.value = true;
}

function closeNewOrder() {
  showNewOrder.value = false;
}

async function submitNewOrder() {
  newOrderMsg.value = "";
  newOrderErr.value = false;
  const orderItems = items.value
    .map((it) => ({ itemId: it.id, quantity: Number(orderQty.value[it.id]) || 0 }))
    .filter((x) => x.quantity > 0);
  if (!orderItems.length) {
    newOrderErr.value = true;
    newOrderMsg.value = "Indica al menos un artículo.";
    return;
  }
  try {
    const created = await apiCreatePapeleriaOrder(orderItems);
    showNewOrder.value = false;
    orderMsg.value = `Pedido enviado con folio ${created.folio}.`;
    orderErr.value = false;
    await loadOrders();
  } catch (e: any) {
    newOrderErr.value = true;
    newOrderMsg.value = e.message || "Error";
  }
}

async function saveItem() {
  msg.value = "";
  err.value = false;
  try {
    if (editingItem.value) {
      await apiUpdatePapeleria(editingItem.value.id, form.value);
      msg.value = "Artículo actualizado.";
    } else {
      await apiCreatePapeleria(form.value);
      msg.value = "Artículo agregado.";
    }
    cancelEdit();
    await load();
  } catch (e: any) {
    err.value = true;
    msg.value = e.message || "Error";
  }
}

function editItem(item: any) {
  editingItem.value = item;
  form.value = { name: item.name, unit: item.unit || "", quantity: item.quantity };
  msg.value = "";
}

function cancelEdit() {
  editingItem.value = null;
  form.value = { name: "", unit: "", quantity: 0 };
}

async function updateQty(it: any, v: string) {
  try {
    await apiUpdatePapeleria(it.id, { quantity: Number(v) });
    await load();
  } catch (e: any) {
    alert(e.message);
  }
}

async function remove(id: string) {
  if (!confirm("¿Eliminar artículo?")) return;
  try {
    await apiDeletePapeleria(id);
    await load();
  } catch (e: any) {
    alert(e.message);
  }
}

async function onImport(e: any) {
  const file = e.target.files?.[0];
  if (!file) return;
  importMsg.value = "Importando...";
  try {
    const res = await apiImportPapeleria(file);
    importMsg.value = `Importados: ${res.created} de ${res.total}` + (res.errors?.length ? ` (${res.errors.length} errores)` : "");
    await load();
  } catch (err: any) {
    importMsg.value = err.message || "Error al importar";
  }
  e.target.value = "";
}

async function viewOrder(o: any) {
  try {
    selectedOrder.value = await apiGetPapeleriaOrder(o.id);
  } catch (e: any) {
    alert(e.message);
  }
}

async function editQty(it: any, v: string) {
  if (!selectedOrder.value) return;
  const payload = selectedOrder.value.items.map((x: any) => ({
    itemId: x.papeleria_item_id,
    quantity: x.id === it.id ? Number(v) : x.quantity,
  }));
  try {
    selectedOrder.value = await apiUpdatePapeleriaOrder(selectedOrder.value.id, payload);
    editMsg.value = "Cantidad actualizada.";
    setTimeout(() => (editMsg.value = ""), 1500);
    await loadOrders();
  } catch (e: any) {
    alert(e.message);
  }
}

async function closeOrder(id: string) {
  if (!confirm("¿Cerrar el pedido y marcarlo como entregado?")) return;
  try {
    await apiClosePapeleriaOrder(id);
    await loadOrders();
    if (selectedOrder.value?.id === id) selectedOrder.value = await apiGetPapeleriaOrder(id);
    orderMsg.value = "Pedido cerrado y entregado.";
    orderErr.value = false;
  } catch (e: any) {
    alert(e.message);
  }
}

onMounted(load);
</script>
