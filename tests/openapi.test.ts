import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openapi } from '../src/openapi.js';

describe('OpenAPI contract', () => {
  it('documents every Fastify route declared in the application', () => {
    const sources = ['src/app.ts', ...['auth','users','roles','products','employees','papeleria','settings','backup','audit'].map(name => `src/routes/${name}.ts`)];
    const declared = sources.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)].map(match => `${match[1].toLowerCase()} ${match[2].replace(/:([^/]+)/g, '{$1}')}`));
    const documented = Object.entries(openapi.paths).flatMap(([path, methods]) => Object.keys(methods).map(method => `${method} ${path}`));
    expect(documented).toEqual(expect.arrayContaining(declared));
    expect(declared).toEqual(expect.arrayContaining(documented));
  });

  it('serves and stores a valid JSON-compatible YAML OpenAPI document', () => {
    const yaml = readFileSync('docs/openapi.yaml', 'utf8');
    const parsed = JSON.parse(yaml);
    expect(parsed.openapi).toBe('3.1.0');
    expect(parsed).toEqual(openapi);
  });

  it('describes request fields, authentication and permission boundaries', () => {
    const createProduct = openapi.paths['/api/products'].post as any;
    expect(createProduct.description).toContain('products permission');
    expect(createProduct.security).toEqual([{ bearerAuth: [] }, { apiKey: [] }, { cookieAuth: [] }]);
    expect(createProduct.requestBody.content['application/json'].schema.required).toEqual(['sku', 'name']);
    expect(createProduct.requestBody.content['application/json'].schema.properties.quantity.type).toBe('integer');
    expect(openapi.paths['/api/backup'].get.description).toContain('Admin');
  });
});
