import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('initial Drizzle migration', () => {
  const sql = readFileSync(new URL('../../drizzle/0000_initial.sql', import.meta.url), 'utf8');

  it('creates the full schema without destructive statements', () => {
    expect((sql.match(/CREATE TABLE/g) ?? []).length).toBe(13);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN|SCHEMA|INDEX)\b/i);
  });

  it('creates foreign keys with the intended referential actions', () => {
    expect(sql).toMatch(/ON DELETE CASCADE/i);
    expect(sql).toMatch(/ON DELETE SET NULL/i);
  });
});
