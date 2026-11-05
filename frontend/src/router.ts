import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "./auth";

const routes = [
  { path: "/login", component: () => import("./views/Login.vue"), meta: { public: true } },
  { path: "/", component: () => import("./views/Inventory.vue"), meta: { permission: "products" } },
  { path: "/users", component: () => import("./views/Users.vue"), meta: { permission: "users" } },
  { path: "/settings", component: () => import("./views/Settings.vue"), meta: { permission: "settings" } },
  { path: "/history", component: () => import("./views/History.vue"), meta: { permission: "history" } },
  { path: "/employees", component: () => import("./views/Employees.vue"), meta: { admin: true, permission: "employees" } },
  { path: "/papeleria", component: () => import("./views/Papeleria.vue"), meta: { permission: "papeleria" } },
  { path: "/api-docs", component: () => import("./views/ApiDocs.vue"), meta: { permission: "api" } },
  { path: "/roles", component: () => import("./views/Roles.vue"), meta: { admin: true, permission: "roles" } },
  { path: "/audit", component: () => import("./views/Audit.vue"), meta: { admin: true } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

function firstAllowedPath(auth: ReturnType<typeof useAuth>) {
  const candidates = [
    { path: "/", permission: "products" },
    { path: "/papeleria", permission: "papeleria" },
    { path: "/history", permission: "history" },
    { path: "/users", permission: "users" },
    { path: "/settings", permission: "settings" },
    { path: "/api-docs", permission: "api" },
  ];
  const candidate = candidates.find((c) => auth.hasPermission(c.permission));
  if (candidate) return candidate.path;
  if (auth.isAdmin.value) return "/employees";
  return null;
}

router.beforeEach((to) => {
  const auth = useAuth();
  if (!to.meta.public && !auth.isAuthenticated.value) {
    return "/login";
  }
  if (to.path === "/login" && auth.isAuthenticated.value) {
    return "/";
  }
  if (to.meta.admin && !auth.isAdmin.value) {
    return firstAllowedPath(auth) || "/";
  }
  if (to.meta.permission && !auth.hasPermission(to.meta.permission as string)) {
    const fallback = firstAllowedPath(auth);
    if (fallback && fallback !== to.path) return fallback;
    return "/login";
  }
});

export default router;
