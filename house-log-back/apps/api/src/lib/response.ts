import { Context } from 'hono';
import type { Bindings, Variables } from './types';

type HonoCtx = Context<{ Bindings: Bindings; Variables: Variables }>;

type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | string;

function requestId(c: HonoCtx): string {
  return c.get('requestId') ?? c.req.header('CF-Ray') ?? crypto.randomUUID();
}

export function ok<T>(c: HonoCtx, data: T, status: 200 | 201 = 200) {
  return c.json(data, status);
}

export function created<T>(c: HonoCtx, data: T) {
  return ok(c, data, 201);
}

export function noContent(c: HonoCtx) {
  return c.body(null, 204);
}

export function errorResponse(
  c: HonoCtx,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  code: ErrorCode,
  message: string,
  details?: unknown
) {
  return c.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
      request_id: requestId(c),
    },
    status
  );
}

export function badRequest(c: HonoCtx, message = 'Requisicao invalida.', details?: unknown) {
  return errorResponse(c, 400, 'BAD_REQUEST', message, details);
}

export function unauthorized(c: HonoCtx, message = 'Autenticacao obrigatoria.') {
  return errorResponse(c, 401, 'UNAUTHORIZED', message);
}

export function forbidden(c: HonoCtx, message = 'Acesso negado.') {
  return errorResponse(c, 403, 'FORBIDDEN', message);
}

export function notFound(c: HonoCtx, message = 'Recurso nao encontrado.') {
  return errorResponse(c, 404, 'NOT_FOUND', message);
}

export function conflict(c: HonoCtx, message = 'Conflito ao processar recurso.', details?: unknown) {
  return errorResponse(c, 409, 'CONFLICT', message, details);
}

export function internalError(c: HonoCtx, message = 'Erro interno.') {
  return errorResponse(c, 500, 'INTERNAL_ERROR', message);
}

export function err(
  c: HonoCtx,
  error: string,
  code: string,
  status: 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 500 | 503 = 400,
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
