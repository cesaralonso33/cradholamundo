import { ref, computed } from "vue";
import { complete2faRequest, loginRequest, logoutRequest, meRequest, registerRequest } from "./api";

const USER_KEY = "inv_user";

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  role: string;
  permissions: string[];
  two_factor_enabled?: boolean;
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [] };
  } catch {
    return null;
  }
}

const user = ref<AuthUser | null>(loadUser());

export function useAuth() {
  const isAuthenticated = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === "admin");
  const permissions = computed(() => user.value?.permissions || []);

  function hasPermission(permission: string) {
    if (isAdmin.value) return true;
    return permissions.value.includes(permission);
  }

  function setUser(u: AuthUser | null) {
    user.value = u ? { ...u, permissions: Array.isArray(u.permissions) ? u.permissions : [] } : null;
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(user.value));
    else localStorage.removeItem(USER_KEY);
    localStorage.removeItem("inv_token");
  }

  async function init() {
    try {
      const u = await meRequest();
      setUser(u);
    } catch {
      setUser(null);
    }
  }

  async function login(password: string): Promise<{ requires2fa: true; tempToken: string; user: any } | { requires2fa: false; user: any }> {
    const data = await loginRequest(password);
    if (data.requires2fa) {
      return { requires2fa: true, tempToken: data.tempToken as string, user: data.user };
    }
    setUser(data.user);
    return { requires2fa: false, user: data.user };
  }

  async function complete2fa(tempToken: string, code: string) {
    const data = await complete2faRequest(tempToken, code);
    setUser(data.user);
    return data.user;
  }

  async function register(username: string, password: string, email?: string, role?: string) {
    const data = await registerRequest({ username, password, email, role });
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await logoutRequest();
    } catch {}
    setUser(null);
  }

  return { user, isAuthenticated, isAdmin, permissions, hasPermission, login, complete2fa, register, logout, init, setUser };
}

export function getToken() {
  return null;
}
