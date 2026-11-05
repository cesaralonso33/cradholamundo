import { getStored, setStored } from "./storage";

const QTY_KEY = "inv_default_qty";
const CAT_KEY = "inv_default_category";

export function getDefaultQty(): number {
  const v = getStored(QTY_KEY);
  const n = v ? Number(v) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function setDefaultQty(n: number) {
  setStored(QTY_KEY, String(n > 0 ? n : 1));
}

export function getDefaultCategory(): string {
  return getStored(CAT_KEY) || "";
}

export function setDefaultCategory(v: string) {
  setStored(CAT_KEY, v || "");
}
