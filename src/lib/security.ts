import path from "node:path";

export const ALLOWED_UPLOAD_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx", ".xls", ".xlsx", ".txt"]);

export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return "La contraseña debe incluir letras y números.";
  }
  return null;
}

export function isAllowedUpload(filename: string | undefined): boolean {
  if (!filename) return false;
  return ALLOWED_UPLOAD_EXTENSIONS.has(path.extname(filename).toLowerCase());
}
