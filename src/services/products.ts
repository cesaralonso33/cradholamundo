import { productRepository } from '../db/repositories/index.js';
import type { Database } from '../db/client.js';

export const findProductBySku = (database: Database, sku: string) => productRepository.findBySku(database, sku);
export const listProducts = (database: Database, filters: Parameters<typeof productRepository.list>[1] = {}) => productRepository.list(database, filters);
export const saveProduct = (database: Database, product: Parameters<typeof productRepository.saveBySku>[1]) => productRepository.saveBySku(database, product);
