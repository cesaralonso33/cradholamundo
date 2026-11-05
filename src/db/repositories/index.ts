import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { auditLogs, constancias, employees, inventoryMovements, locationHistories, papeleriaItems, papeleriaOrderItems, papeleriaOrders, products, roles, settings, users, type NewInventoryMovement, type NewProduct } from '../schema.js';
import type { Database } from '../client.js';

type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];
const paged = async <T>(query: Promise<T[]>, totalQuery: Promise<{ count: number }[]>, page: number, pageSize: number) => {
  const [items, rows] = await Promise.all([query, totalQuery]);
  return { items, total: rows[0]?.count ?? 0, page, pageSize };
};
const safePage = (page: number, size: number, max = 100) => ({ page: Math.max(1, Math.floor(page) || 1), pageSize: Math.min(max, Math.max(1, Math.floor(size) || 20)) });

export const productRepository = {
  findBySku: async (executor: Executor, sku: string) => (await executor.select().from(products).where(eq(products.sku, sku)).limit(1))[0] ?? null,
  setQuantity: async (executor: Executor, id: string, quantity: number) => (await executor.update(products).set({ quantity }).where(eq(products.id, id)).returning())[0],
  adjustStock: async (executor: Executor, id: string, direction: 'IN' | 'OUT', quantity: number) => (await executor.update(products).set({ quantity: direction === 'IN' ? sql`${products.quantity} + ${quantity}` : sql`${products.quantity} - ${quantity}` }).where(and(eq(products.id, id), direction === 'OUT' ? sql`${products.quantity} >= ${quantity}` : undefined)).returning())[0] ?? null,
  saveBySku: async (executor: Executor, value: NewProduct) => (await executor.insert(products).values(value).onConflictDoUpdate({ target: products.sku, set: { name: value.name, category: value.category, location: value.location, quantity: value.quantity } }).returning())[0],
  list: async (executor: Executor = db, options: { search?: string; location?: string; page?: number; pageSize?: number } = {}) => {
    const { page, pageSize } = safePage(options.page ?? 1, options.pageSize ?? 20);
    const clauses = [];
    if (options.location) clauses.push(eq(products.location, options.location));
    if (options.search?.trim()) { const term = `%${options.search.trim()}%`; clauses.push(or(ilike(products.sku, term), ilike(products.name, term), ilike(products.category, term), ilike(products.location, term))!); }
    const where = clauses.length ? and(...clauses) : undefined;
    return paged(executor.select().from(products).where(where).orderBy(desc(products.updated_at)).limit(pageSize).offset((page - 1) * pageSize), executor.select({ count: count() }).from(products).where(where), page, pageSize);
  },
};
export const inventoryMovementRepository = {
  create: async (executor: Executor, value: NewInventoryMovement) => (await executor.insert(inventoryMovements).values(value).returning())[0],
  listForProduct: (executor: Executor, productId: string) => executor.select().from(inventoryMovements).where(eq(inventoryMovements.product_id, productId)).orderBy(desc(inventoryMovements.created_at)),
};
export const userRepository = { findById: async (executor: Executor, id: string) => (await executor.select().from(users).where(eq(users.id, id)).limit(1))[0] ?? null, list: (executor: Executor = db) => executor.select({ id: users.id, username: users.username, email: users.email, role: users.role, created_at: users.created_at, updated_at: users.updated_at }).from(users).orderBy(desc(users.created_at)) };
export const roleRepository = { list: (executor: Executor = db) => executor.select().from(roles).orderBy(roles.created_at), findByName: async (executor: Executor, name: string) => (await executor.select().from(roles).where(eq(roles.name, name)).limit(1))[0] ?? null };
export const employeeRepository = { list: (executor: Executor = db) => executor.select().from(employees).orderBy(desc(employees.created_at)), findById: async (executor: Executor, id: string) => (await executor.select().from(employees).where(eq(employees.id, id)).limit(1))[0] ?? null, constancias: (executor: Executor, employeeId: string) => executor.select().from(constancias).where(eq(constancias.employee_id, employeeId)).orderBy(desc(constancias.created_at)) };
export const papeleriaRepository = { listItems: (executor: Executor = db) => executor.select().from(papeleriaItems).orderBy(desc(papeleriaItems.created_at)), listOrders: (executor: Executor = db, userId?: string, limit = 100) => executor.select().from(papeleriaOrders).where(userId ? eq(papeleriaOrders.user_id, userId) : undefined).orderBy(desc(papeleriaOrders.created_at)).limit(Math.min(200, Math.max(1, limit))), orderItems: (executor: Executor, orderId: string) => executor.select().from(papeleriaOrderItems).where(eq(papeleriaOrderItems.order_id, orderId)) };
export const papeleriaOrderRepository = {
  findById: async (executor: Executor, id: string) => (await executor.select().from(papeleriaOrders).where(eq(papeleriaOrders.id, id)).limit(1))[0] ?? null,
  close: async (executor: Executor, id: string, username: string) => (await executor.update(papeleriaOrders).set({ status: 'CLOSED', closed_at: new Date(), closed_by: username }).where(and(eq(papeleriaOrders.id, id), eq(papeleriaOrders.status, 'OPEN'))).returning())[0] ?? null,
};
export const auditRepository = { list: (executor: Executor = db, filters: { action?: string; username?: string; entityType?: string; page?: number; pageSize?: number } = {}) => { const { page, pageSize } = safePage(filters.page ?? 1, filters.pageSize ?? 50); const clauses = [filters.action ? eq(auditLogs.action, filters.action) : undefined, filters.username ? ilike(auditLogs.username, `%${filters.username}%`) : undefined, filters.entityType ? eq(auditLogs.entity_type, filters.entityType) : undefined].filter(Boolean); const where = clauses.length ? and(...clauses) : undefined; return paged(executor.select().from(auditLogs).where(where).orderBy(desc(auditLogs.created_at)).limit(pageSize).offset((page - 1) * pageSize), executor.select({ count: count() }).from(auditLogs).where(where), page, pageSize); }, create: async (executor: Executor, value: typeof auditLogs.$inferInsert) => (await executor.insert(auditLogs).values(value).returning())[0] };
export const settingsRepository = { getAll: (executor: Executor = db) => executor.select().from(settings), get: async (executor: Executor, key: string) => (await executor.select().from(settings).where(eq(settings.key, key)).limit(1))[0] ?? null, set: async (executor: Executor, key: string, value: string) => (await executor.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).returning())[0] };
export const backupRepository = { exportAll: async (executor: Executor = db) => { const [allSettings, allUsers, allProducts, movements, history, allEmployees, allConstancias, allItems, orders, orderItems] = await Promise.all([executor.select().from(settings), executor.select().from(users), executor.select().from(products), executor.select().from(inventoryMovements), executor.select().from(locationHistories), executor.select().from(employees), executor.select().from(constancias), executor.select().from(papeleriaItems), executor.select().from(papeleriaOrders), executor.select().from(papeleriaOrderItems)]); return { settings: allSettings, users: allUsers, products: allProducts, movements, locationHistory: history, employees: allEmployees, constancias: allConstancias, papeleriaItems: allItems, orders, orderItems }; }, transaction: <T>(work: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>) => db.transaction(work) };
