import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const compose = readFileSync(resolve('docker-compose.yml'), 'utf8');
const envExample = readFileSync(resolve('.env.docker.example'), 'utf8');

describe('Docker database URL configuration', () => {
  it('requires an explicit DATABASE_URL and does not compose it from a password', () => {
    expect(compose).toMatch(/DATABASE_URL:\s*\$\{DATABASE_URL:\?[^}]+\}/);
    expect(compose).not.toMatch(/DATABASE_URL:.*POSTGRES_PASSWORD/);
    expect(envExample).toMatch(/^DATABASE_URL=postgresql:\/\/[^\s@]+@db:5432\/inventario\?schema=public$/m);
  });
});
