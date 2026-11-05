import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseInput } from '../../src/lib/validation.js';
import { toHttpError } from '../../src/lib/errors.js';

describe('central validation and error mapping', () => {
  it('returns parsed Zod input and rejects invalid data', () => {
    const schema = z.object({ count: z.number().int().positive() });
    expect(parseInput(schema, { count: 2 })).toEqual({ count: 2 });
    expect(() => parseInput(schema, { count: -2 })).toThrow();
  });

  it('does not expose internal error messages or stacks', () => {
    const response = toHttpError(Object.assign(new Error('secret database password'), { stack: 'secret stack' }));
    expect(response).toEqual({ statusCode: 500, body: { error: 'internal server error' } });
    expect(JSON.stringify(response)).not.toContain('secret');
  });
});
