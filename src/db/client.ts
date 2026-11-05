import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set before initializing the database client');

const globalForDb = globalThis as typeof globalThis & { inventoryDb?: NodePgDatabase<typeof schema>; inventoryPool?: Pool };
export const pool = globalForDb.inventoryPool ?? new Pool({ connectionString });
export const db = globalForDb.inventoryDb ?? drizzle(pool, { schema });
if (process.env.NODE_ENV !== 'production') {
  globalForDb.inventoryPool = pool;
  globalForDb.inventoryDb = db;
}
export type Database = typeof db;
