import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Drizzle command configuration', () => {
  it.each(['check', 'migrate'])('fails clearly when DATABASE_URL is unavailable for %s instead of using an implicit database', (command) => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    let output = '';
    let status = 0;
    try {
      output = execFileSync(process.execPath, [resolve('node_modules/drizzle-kit/bin.cjs'), command], {
        cwd: process.cwd(), env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (error) {
      const result = error as { status: number | null; stdout?: string; stderr?: string };
      status = result.status ?? 1;
      output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    }
    expect(status).not.toBe(0);
    expect(output).toMatch(/DATABASE_URL is required/i);
  });
});
