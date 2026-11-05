export type HttpError = { statusCode: number; body: { error: string } };

export function toHttpError(error: unknown): HttpError {
  let current = error as { code?: string; cause?: unknown } | null;
  const visited = new Set<unknown>();
  while (current && !current.code && current.cause && !visited.has(current.cause)) {
    visited.add(current);
    current = current.cause as { code?: string; cause?: unknown };
  }
  const code = current?.code;
  if (code === 'NOT_FOUND') return { statusCode: 404, body: { error: 'not found' } };
  if (code === 'INSUFFICIENT_STOCK' || code === 'INVALID_STATE') return { statusCode: 400, body: { error: 'invalid operation' } };
  if (code === 'CONFLICT') return { statusCode: 409, body: { error: 'resource state conflict' } };
  if (code === '23505') return { statusCode: 409, body: { error: 'resource already exists' } };
  if (code === '23503') return { statusCode: 400, body: { error: 'related resource constraint failed' } };
  if (error instanceof Error && error.name === 'ZodError') return { statusCode: 400, body: { error: 'invalid input' } };
  return { statusCode: 500, body: { error: 'internal server error' } };
}
