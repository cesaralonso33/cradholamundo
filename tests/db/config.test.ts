import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Drizzle command configuration', () => {
  it.each(['check', 'migrate'])('fails clearly when DATABASE_URL is unavailable for %s instead of using an implicit database', (command) => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.DOTENV_CONFIG_PATH;
    const cwd = mkdtempSync(join(tmpdir(), 'drizzle-config-test-'));
    const dotenvFile = join(tmpdir(), `dotenv-empty-${process.pid}-${command}.env`);
    writeFileSync(dotenvFile, '');
    env.DOTENV_CONFIG_PATH = dotenvFile;
    expect(existsSync(join(cwd, '.env'))).toBe(false);
    let output = '';
    let status = 0;
    try {
      output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', [
        '--prefix', resolve('.'), 'run', `db:${command}`,
      ], {
        cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32',
      });
    } catch (error) {
      const result = error as { status: number | null; stdout?: string; stderr?: string };
      status = result.status ?? 1;
      output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(dotenvFile, { force: true });
    }
    expect(output).toMatch(new RegExp(`> inventario@[^\\s]+ db:${command}`));
    expect(status).not.toBe(0);
    expect(output).toMatch(/DATABASE_URL is required/i);
  });
});
