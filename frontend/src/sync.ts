import { db } from "./db";
import { apiCreateProduct } from "./api";

let running = false;

export async function syncPendingCaptures(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const pending = await db.captures.where("synced").equals(0).toArray();
    for (const capture of pending) {
      try {
        await apiCreateProduct({
          sku: capture.sku,
          name: capture.name,
          category: capture.category || null,
          quantity: capture.quantity,
          min_stock: capture.min_stock ?? 0,
        });
        if (capture.id != null) {
          await db.captures.update(capture.id, { synced: 1 });
        }
      } catch (error: any) {
        if (String(error?.message || "").includes("409")) {
          if (capture.id != null) await db.captures.delete(capture.id);
          continue;
        }
        // Sin conexión o backend caído: se reintentará después.
        break;
      }
    }
  } finally {
    running = false;
  }
}
