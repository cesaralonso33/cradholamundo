import { randomBytes } from 'node:crypto';
import {
  boolean, index, integer, pgTable, text, timestamp, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { z } from 'zod';

// Prisma's cuid() is an application-generated identifier; never a SQL default.
export const createCuid = () => `c${randomBytes(12).toString('hex')}`;
const id = () => text('id').primaryKey().$defaultFn(createCuid);
const dateTime = (name: string) => timestamp(name, { withTimezone: false, mode: 'date', precision: 3 });
const now = () => dateTime('created_at').notNull().defaultNow();
const updated = () => dateTime('updated_at').notNull().$defaultFn(() => new Date()).$onUpdate(() => new Date());

export const products = pgTable('Product', {
  id: id(), sku: text('sku').notNull(), name: text('name').notNull(), category: text('category'), location: text('location'),
  quantity: integer('quantity').notNull().default(0), min_stock: integer('min_stock').notNull().default(0), created_at: now(), updated_at: updated(),
}, (t) => [uniqueIndex('products_sku_key').on(t.sku), index('products_sku_idx').on(t.sku), index('products_location_updated_at_idx').on(t.location, t.updated_at)]);

export const inventoryMovements = pgTable('InventoryMovement', {
  id: id(), product_id: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }), type: text('type').notNull(), quantity: integer('quantity').notNull(), note: text('note'), created_at: now(),
}, (t) => [index('inventory_movements_product_id_idx').on(t.product_id), index('inventory_movements_created_at_idx').on(t.created_at)]);

export const locationHistories = pgTable('LocationHistory', {
  id: id(), product_id: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }), from_location: text('from_location'), to_location: text('to_location').notNull(), changed_by: text('changed_by').notNull(), created_at: now(),
}, (t) => [index('location_histories_product_id_created_at_idx').on(t.product_id, t.created_at)]);

export const users = pgTable('User', {
  id: id(), username: text('username').notNull(), email: text('email'), password: text('password').notNull(), role: text('role').notNull().default('user'), totp_secret: text('totp_secret'), two_factor_enabled: boolean('two_factor_enabled').notNull().default(false), created_at: now(), updated_at: updated(),
}, (t) => [uniqueIndex('users_username_key').on(t.username), uniqueIndex('users_email_key').on(t.email), index('users_username_idx').on(t.username)]);

export const auditLogs = pgTable('AuditLog', {
  id: id(), user_id: text('user_id').references(() => users.id, { onDelete: 'set null' }), username: text('username'), action: text('action').notNull(), entity_type: text('entity_type'), entity_id: text('entity_id'), details: text('details'), ip: text('ip'), created_at: now(),
}, (t) => [index('audit_logs_created_at_idx').on(t.created_at), index('audit_logs_user_id_idx').on(t.user_id)]);

export const settings = pgTable('Setting', { key: text('key').primaryKey(), value: text('value').notNull() });

export const roles = pgTable('Role', {
  id: id(), name: text('name').notNull(), description: text('description'), permissions: text('permissions').array().notNull(), created_at: now(), updated_at: updated(),
}, (t) => [uniqueIndex('roles_name_key').on(t.name), index('roles_name_idx').on(t.name)]);

export const loginAttempts = pgTable('LoginAttempt', {
  identifier: text('identifier').primaryKey(), failures: integer('failures').notNull().default(0), blocked_until: dateTime('blocked_until'), last_attempt: dateTime('last_attempt').notNull().defaultNow(), updated_at: updated(),
}, (t) => [index('login_attempts_blocked_until_idx').on(t.blocked_until)]);

export const employees = pgTable('Employee', {
  id: id(), name: text('name').notNull(), position: text('position'), email: text('email'), created_at: now(), updated_at: updated(),
}, (t) => [index('employees_name_idx').on(t.name), index('employees_created_at_idx').on(t.created_at)]);

export const constancias = pgTable('Constancia', {
  id: id(), employee_id: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }), title: text('title').notNull(), description: text('description'), file_path: text('file_path'), file_name: text('file_name'), created_at: now(),
}, (t) => [index('constancias_employee_id_created_at_idx').on(t.employee_id, t.created_at)]);

export const papeleriaItems = pgTable('PapeleriaItem', {
  id: id(), name: text('name').notNull(), unit: text('unit'), quantity: integer('quantity').notNull().default(0), created_at: now(), updated_at: updated(),
}, (t) => [uniqueIndex('papeleria_items_name_key').on(t.name), index('papeleria_items_name_idx').on(t.name)]);

export const papeleriaOrders = pgTable('PapeleriaOrder', {
  id: id(), folio: text('folio').notNull(), user_id: text('user_id').notNull().references(() => users.id), status: text('status').notNull().default('OPEN'), created_at: now(), updated_at: updated(), closed_at: dateTime('closed_at'), closed_by: text('closed_by'),
}, (t) => [uniqueIndex('papeleria_orders_folio_key').on(t.folio), index('papeleria_orders_user_id_created_at_idx').on(t.user_id, t.created_at), index('papeleria_orders_status_idx').on(t.status), index('papeleria_orders_created_at_idx').on(t.created_at)]);

export const papeleriaOrderItems = pgTable('PapeleriaOrderItem', {
  id: id(), order_id: text('order_id').notNull().references(() => papeleriaOrders.id, { onDelete: 'cascade' }), papeleria_item_id: text('papeleria_item_id').notNull().references(() => papeleriaItems.id), quantity: integer('quantity').notNull(), note: text('note'),
}, (t) => [index('papeleria_order_items_order_id_idx').on(t.order_id)]);

export const createProductSchema = z.object({
  id: z.string().default(createCuid), sku: z.string(), name: z.string(), category: z.string().nullable().optional(), location: z.string().nullable().optional(),
  quantity: z.number().int().default(0), min_stock: z.number().int().default(0), created_at: z.date().default(() => new Date()), updated_at: z.date().default(() => new Date()),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert;
export type LocationHistory = typeof locationHistories.$inferSelect;
export type User = typeof users.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Constancia = typeof constancias.$inferSelect;
export type PapeleriaItem = typeof papeleriaItems.$inferSelect;
export type PapeleriaOrder = typeof papeleriaOrders.$inferSelect;
export type PapeleriaOrderItem = typeof papeleriaOrderItems.$inferSelect;
