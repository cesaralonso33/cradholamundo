import type { ZodType } from 'zod';

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  return schema.parse(input);
}
