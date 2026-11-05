import Dexie, { type Table } from "dexie";

export interface LocalCapture {
  id?: number;
  sku: string;
  name: string;
  category?: string;
  location?: string;
  quantity: number;
  min_stock?: number;
  type: "PRODUCT" | "MOVEMENT";
  movementType?: "IN" | "OUT";
  note?: string;
  synced: 0 | 1;
  createdAt: number;
}

class InventoryDB extends Dexie {
  captures!: Table<LocalCapture, number>;
  constructor() {
    super("inventoryDB");
    this.version(1).stores({
      captures: "++id, sku, synced, createdAt",
    });
  }
}

export const db = new InventoryDB();
