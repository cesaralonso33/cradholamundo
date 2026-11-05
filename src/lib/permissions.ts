import { db } from '../db/client.js';
import { roleRepository } from '../db/repositories/index.js';

export const PERMISSIONS = [
  { key: "products", label: "Inventario / Productos" },
  { key: "history", label: "Historial de ubicaciones" },
  { key: "papeleria", label: "Papelería y pedidos" },
  { key: "employees", label: "Empleados y constancias" },
  { key: "users", label: "Usuarios" },
  { key: "settings", label: "Configuración" },
  { key: "backups", label: "Respaldos" },
  { key: "api", label: "API" },
  { key: "roles", label: "Roles y permisos" },
] as const;

export const ALL_PERMISSIONS = PERMISSIONS.map((p) => p.key);

export const DEFAULT_USER_PERMISSIONS = ["products", "history", "papeleria"];

export async function getRolePermissions(roleName: string): Promise<string[]> {
  if (roleName === "admin") return [...ALL_PERMISSIONS];
  const role = await roleRepository.findByName(db, roleName);
  return role?.permissions ?? DEFAULT_USER_PERMISSIONS;
}

export function isValidPermission(value: string): boolean {
  return (ALL_PERMISSIONS as readonly string[]).includes(value);
}
