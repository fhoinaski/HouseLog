import { Context } from 'hono';
import type { Bindings, Variables } from './types';

type HonoCtx = Context<{ Bindings: Bindings; Variables: Variables }>;

export function ok<T>(c: HonoCtx, data: T, status: 200 | 201 = 200) {
  return c.json(data, status);
}

export function err(
  c: HonoCtx,
  error: string,
  code: string,
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503 = 400,
  details?: unknown
) {
  return c.json({ error, code, ...(details ? { details } : {}) }, status);
}

export function paginate<T>(
  data: T[],
  limit: number,
  cursorField: keyof T & string
) {
  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;
  const last = items.at(-1);
  const nextCursor = hasMore && last ? String(last[cursorField]) : null;
  return { data: items, next_cursor: nextCursor, has_more: hasMore };
}
