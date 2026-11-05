import { z } from "zod";

export const loginSchema = z.object({ password: z.string().min(1, "Ingresa la contraseña") });
export const productCaptureSchema = z.object({
  sku: z.string().trim().min(1, "Ingresa el SKU"),
  name: z.string().trim().min(1, "Ingresa el nombre"),
  category: z.string().optional(),
});
export const employeeSchema = z.object({
  name: z.string().trim().min(1, "Ingresa el nombre"),
  position: z.string().optional(),
  email: z.union([z.string().email("Ingresa un email válido"), z.literal("")]).optional(),
});
export const papeleriaSchema = z.object({
  name: z.string().trim().min(1, "Ingresa el nombre"),
  quantity: z.coerce.number().int().min(0, "La cantidad no puede ser negativa"),
});
export const settingsSchema = z.object({
  quantity: z.coerce.number().int().positive("La cantidad debe ser un entero mayor que cero"),
  category: z.string().max(100, "La categoría no puede exceder 100 caracteres"),
});
