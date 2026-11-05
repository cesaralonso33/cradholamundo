export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  role: "admin" | "user" | string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  location?: string | null;
  quantity: number;
  min_stock: number;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  name: string;
  position?: string | null;
  email?: string | null;
  created_at: string;
  updated_at: string;
  _count?: { constancias: number };
}

export interface Constancia {
  id: string;
  employee_id: string;
  title: string;
  description?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  created_at: string;
}

export interface PapeleriaItem {
  id: string;
  name: string;
  unit?: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface PapeleriaOrderItem {
  id: string;
  order_id: string;
  papeleria_item_id: string;
  quantity: number;
  note?: string | null;
  item?: PapeleriaItem;
}

export interface PapeleriaOrder {
  id: string;
  folio: string;
  user_id: string;
  status: "OPEN" | "CLOSED" | string;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  closed_by?: string | null;
  user?: { id: string; username: string };
  items?: PapeleriaOrderItem[];
  _count?: { items: number };
}

export interface ListResponse<T> {
  items: T[];
}

export interface OrdersResponse {
  items: PapeleriaOrder[];
  total: number;
  pending: number;
}
