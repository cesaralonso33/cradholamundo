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

  it('describes request fields and operation-level authentication and permission boundaries', () => {
    const createProduct = openapi.paths['/api/products'].post as any;
    expect(createProduct.description).toContain('products permission');
    expect(createProduct.security).toEqual([{ bearerAuth: [] }, { cookieAuth: [] }, { apiKey: [] }]);
    expect(createProduct.requestBody.content['application/json'].schema.required).toEqual(['sku', 'name']);
    expect(createProduct.requestBody.content['application/json'].schema.properties.quantity.type).toBe('integer');
    expect(openapi.paths['/api/backup'].get.description).toContain('Admin');
  });

  it('keeps auth public, temporary-token, cookie/JWT, API-key and admin boundaries distinct', () => {
    const operation = (path: string, method: string) => (openapi.paths[path] as any)[method];
    for (const path of ['/api/openapi.json', '/api/openapi.yaml', '/health', '/api/health']) {
      expect(operation(path, 'get').security).toBeUndefined();
      expect(Object.keys(operation(path, 'get').responses)).not.toContain('401');
    }
    expect(operation('/api/auth/2fa/complete', 'post').security).toEqual([{ twoFactorToken: [] }]);
    expect(operation('/api/auth/me', 'get').security).toEqual([{ bearerAuth: [] }, { cookieAuth: [] }, { apiKey: [] }]);
    expect(operation('/api/products', 'get').security).toEqual([{ bearerAuth: [] }, { cookieAuth: [] }, { apiKey: [] }]);
    expect(operation('/api/users', 'get').security).toEqual([{ bearerAuth: [] }, { cookieAuth: [] }, { apiKey: [] }]);
    expect(operation('/api/users', 'get').xAccess).toEqual({ permission: 'users' });
    expect(operation('/api/backup', 'get').xAccess).toEqual({ admin: true });
  });

  it('declares relevant response codes per operation rather than a universal error set', () => {
    const operation = (path: string, method: string) => (openapi.paths[path] as any)[method];
    expect(Object.keys(operation('/api/openapi.json', 'get').responses)).toEqual(['200']);
    expect(operation('/api/auth/me', 'get').responses['401']).toBeDefined();
    expect(operation('/api/users', 'get').responses['403']).toBeDefined();
    expect(operation('/api/backup/restore', 'post').responses['413']).toBeDefined();
    expect(operation('/api/auth/login', 'post').responses['413']).toBeUndefined();
  });

  it('provides structured access metadata and success responses for every documented operation', () => {
    for (const [path, methods] of Object.entries(openapi.paths)) {
      for (const [method, raw] of Object.entries(methods)) {
        const operation = raw as any;
        expect(operation.xAccess, `${method.toUpperCase()} ${path} access metadata`).toBeDefined();
        expect(operation.responses['200'], `${method.toUpperCase()} ${path} success response`).toBeDefined();
        if (operation.xAccess.public) {
          expect(operation.security).toBeUndefined();
          expect(operation.responses['401']).toBeUndefined();
          expect(operation.responses['403']).toBeUndefined();
        } else {
          expect(operation.security?.length, `${method.toUpperCase()} ${path} security`).toBeGreaterThan(0);
        }
        if (operation.xAccess.admin || operation.xAccess.permission) {
          expect(operation.responses['403'], `${method.toUpperCase()} ${path} authorization failure`).toBeDefined();
        }
        if (path.includes('{')) {
          expect(operation.parameters?.some((parameter: any) => parameter.in === 'path' && parameter.required), `${method.toUpperCase()} ${path} required path parameter`).toBe(true);
        }
        if (operation.requestBody) expect(operation.requestBody.required).toBe(true);
      }
    }
  });
});


