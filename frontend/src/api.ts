import type {
  Constancia,
  Employee,
  ListResponse,
  OrdersResponse,
  PapeleriaItem,
  PapeleriaOrder,
  Product,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";
const TIMEOUT_MS = 15000;

interface RequestOptions {
  method?: string;
  body?: any;
  formData?: FormData;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
    readonly retryAfter?: string | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};

  let body: any;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers,
      body,
      credentials: "include",
      signal: controller.signal,
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      let details: unknown;
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
        details = data?.details ?? data?.issues;
      } catch {}
      if (res.status === 401 && typeof window !== "undefined") {
        window.dispatchEvent(new Event("inventory:unauthorized"));
      }
      throw new ApiError(message, res.status, details, res.headers.get("Retry-After") ?? undefined);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export interface HealthResult {
  ok: boolean;
  backend?: string;
  database?: string;
  error?: string;
  hint?: string;
  httpStatus?: number;
}

export async function apiHealth(): Promise<HealthResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${API_BASE}/api/health`, { credentials: "include", signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return { ...data, httpStatus: res.status, ok: res.ok && data.ok === true };
  } finally {
    clearTimeout(timeout);
  }
}

// ---- Auth ----
export function loginRequest(password: string) {
  return request<{ token?: string; user: any; requires2fa?: boolean; tempToken?: string }>("/api/auth/login", {
    method: "POST",
    body: { password },
  });
}

export function complete2faRequest(tempToken: string, code: string) {
  return request<{ token?: string; user: any }>("/api/auth/2fa/complete", { method: "POST", body: { tempToken, code } });
}

export function setup2faRequest() {
  return request<{ secret: string; otpauth: string; qr: string }>("/api/auth/2fa/setup", { method: "POST" });
}

export function verify2faRequest(code: string) {
  return request("/api/auth/2fa/verify", { method: "POST", body: { code } });
}

export function disable2faRequest(password: string, code: string) {
  return request("/api/auth/2fa/disable", { method: "POST", body: { password, code } });
}

export function logoutRequest() {
  return request("/api/auth/logout", { method: "POST" });
}

export function meRequest() {
  return request<any>("/api/auth/me");
}

export function registerRequest(payload: any) {
  return request<{ token: string; user: any }>("/api/auth/register", { method: "POST", body: payload });
}

// ---- Products ----
export function apiCreateProduct(payload: any) {
  return request("/api/products", { method: "POST", body: payload });
}

export function apiMovement(payload: any) {
  return request("/api/inventory/movement", { method: "POST", body: payload });
}

export function apiListProducts(search = "", page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  return request<ListResponse<Product> & { total: number; page: number; pageSize: number }>(
    `/api/products?${params.toString()}`
  );
}

export function apiGetProduct(sku: string) {
  return request<Product>(`/api/products/${encodeURIComponent(sku)}`);
}

export function apiProductHistory(sku: string, page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return request<{ items: any[]; total: number; page: number; pageSize: number }>(
    `/api/products/${encodeURIComponent(sku)}/history?${params.toString()}`
  );
}

export function apiUpdateProduct(sku: string, payload: any) {
  return request(`/api/products/${encodeURIComponent(sku)}`, { method: "PUT", body: payload });
}

export function apiArchiveProduct(sku: string) {
  return request(`/api/products/${encodeURIComponent(sku)}/archive`, { method: "POST" });
}

export function apiDeleteProduct(sku: string) {
  return request(`/api/products/${encodeURIComponent(sku)}`, { method: "DELETE" });
}

// ---- Users ----
export function apiListUsers() {
  return request("/api/users");
}

export function apiUpdateUser(id: string, payload: any) {
  return request(`/api/users/${id}`, { method: "PUT", body: payload });
}

export function apiDeleteUser(id: string) {
  return request(`/api/users/${id}`, { method: "DELETE" });
}

// ---- Roles & permissions ----
export function apiListPermissions() {
  return request<{ items: { key: string; label: string }[] }>("/api/permissions");
}

export function apiListRoles() {
  return request<{ items: any[] }>("/api/roles");
}

export function apiListRoleOptions() {
  return request<{ items: { name: string; description?: string | null }[] }>("/api/roles/options");
}

export function apiCreateRole(payload: any) {
  return request("/api/roles", { method: "POST", body: payload });
}

export function apiUpdateRole(id: string, payload: any) {
  return request(`/api/roles/${id}`, { method: "PUT", body: payload });
}

export function apiDeleteRole(id: string) {
  return request(`/api/roles/${id}`, { method: "DELETE" });
}

// ---- API key ----
export function apiGetApiKeyConfig() {
  return request<{ enabled: boolean; prefix: string | null; hasKey: boolean }>("/api/settings/api-key");
}

export function apiGenerateApiKey() {
  return request<{ apiKey: string; prefix: string }>("/api/settings/api-key", { method: "POST" });
}

export function apiRevokeApiKey() {
  return request("/api/settings/api-key", { method: "DELETE" });
}

export function apiSetApiEnabled(enabled: boolean) {
  return request("/api/settings/api-enabled", { method: "PUT", body: { enabled } });
}

// ---- Audit logs ----
export function apiListAuditLogs(page = 1, pageSize = 50, filters: { action?: string; username?: string; entityType?: string } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (filters.action) params.set("action", filters.action);
  if (filters.username) params.set("username", filters.username);
  if (filters.entityType) params.set("entityType", filters.entityType);
  return request(`/api/audit-logs?${params.toString()}`);
}

// ---- Backups ----
export async function apiDownloadBackup(includeSensitive = false): Promise<Blob> {
  const headers: Record<string, string> = {};
  const params = includeSensitive ? "?includeSensitive=true" : "";
  const res = await fetch(`${API_BASE}/api/backup${params}`, { headers, credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export function apiRestoreBackup(data: any) {
  return request("/api/backup/restore", { method: "POST", body: { data } });
}

// ---- Settings ----
export function apiGetSettings() {
  return request<Record<string, string>>("/api/settings");
}

export function apiSetSetting(key: string, value: string) {
  return request("/api/settings", { method: "PUT", body: { key, value } });
}

// ---- Employees ----
export function apiListEmployees() {
  return request<ListResponse<Employee>>("/api/employees");
}

export function apiCreateEmployee(payload: Pick<Employee, "name" | "position" | "email">) {
  return request("/api/employees", { method: "POST", body: payload });
}

export function apiDeleteEmployee(id: string) {
  return request(`/api/employees/${id}`, { method: "DELETE" });
}

export function apiGetEmployee(id: string) {
  return request<Employee & { constancias: Constancia[] }>(`/api/employees/${id}`);
}

export function apiImportEmployees(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/api/employees/import", { method: "POST", formData });
}

export function apiListConstancias(employeeId: string) {
  return request<ListResponse<Constancia>>(`/api/employees/${employeeId}/constancias`);
}

export function apiUploadConstancia(employeeId: string, title: string, description: string, file: File | null) {
  const formData = new FormData();
  formData.append("title", title);
  if (description) formData.append("description", description);
  if (file) formData.append("file", file);
  return request(`/api/employees/${employeeId}/constancias`, { method: "POST", formData });
}

export function apiDeleteConstancia(id: string) {
  return request(`/api/constancias/${id}`, { method: "DELETE" });
}

// ---- Papeleria ----
export function apiListPapeleria() {
  return request<ListResponse<PapeleriaItem>>("/api/papeleria");
}

export function apiCreatePapeleria(payload: any) {
  return request("/api/papeleria", { method: "POST", body: payload });
}

export function apiUpdatePapeleria(id: string, payload: any) {
  return request(`/api/papeleria/${id}`, { method: "PUT", body: payload });
}

export function apiDeletePapeleria(id: string) {
  return request(`/api/papeleria/${id}`, { method: "DELETE" });
}

export function apiImportPapeleria(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request("/api/papeleria/import", { method: "POST", formData });
}

export function apiListPapeleriaOrders() {
  return request<OrdersResponse>("/api/papeleria/orders");
}

export function apiCreatePapeleriaOrder(items: any[]) {
  return request<PapeleriaOrder>("/api/papeleria/orders", { method: "POST", body: { items } });
}

export function apiGetPapeleriaOrder(id: string) {
  return request<PapeleriaOrder>(`/api/papeleria/orders/${id}`);
}

export function apiUpdatePapeleriaOrder(id: string, items: any[]) {
  return request<PapeleriaOrder>(`/api/papeleria/orders/${id}`, { method: "PUT", body: { items } });
}

export function apiClosePapeleriaOrder(id: string) {
  return request<PapeleriaOrder>(`/api/papeleria/orders/${id}/close`, { method: "POST" });
}
