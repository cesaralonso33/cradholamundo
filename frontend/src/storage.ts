function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getStored(key: string): string | null {
  try { return storage()?.getItem(key) ?? null; } catch { return null; }
}

export function setStored(key: string, value: string): void {
  try { storage()?.setItem(key, value); } catch { /* blocked storage is non-fatal */ }
}

export function removeStored(key: string): void {
  try { storage()?.removeItem(key); } catch { /* blocked storage is non-fatal */ }
}
