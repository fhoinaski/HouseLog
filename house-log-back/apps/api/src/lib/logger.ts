// Structured JSON logger + Sentry passthrough.
// Workers logs (Tail/Logpush) consomem melhor JSON em uma linha do que console.log livre.

import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from './types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields: LogFields = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  // Workers só distingue stderr para warn/error — usar console.error nesses casos
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
  info:  (message: string, fields?: LogFields) => emit('info',  message, fields),
  warn:  (message: string, fields?: LogFields) => emit('warn',  message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

// Middleware que gera requestId, mede duração, loga 1 linha por request.
// Também loga o userId quando populado pelo authMiddleware.
export const requestLogger = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
  async (c, next) => {
    const reqId = c.req.header('CF-Ray') ?? crypto.randomUUID();
    c.set('requestId', reqId);
    c.res.headers.set('X-Request-Id', reqId);

    const started = Date.now();
    await next();
    const duration_ms = Date.now() - started;

    emit('info', 'http_request', {
      request_id: reqId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms,
      user_id: c.get('userId') ?? null,
      ip: c.req.header('CF-Connecting-IP') ?? null,
      ua: c.req.header('User-Agent') ?? null,
    });
  }
);

// Envia erro para Sentry (ingest HTTP API) quando SENTRY_DSN estiver presente.
// Não-bloqueante: usa ctx.waitUntil via c.executionCtx quando disponível.
export async function reportError(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  err: unknown,
  extra: LogFields = {}
): Promise<void> {
  const dsn = c.env.SENTRY_DSN;
  const err_obj = err instanceof Error ? err : new Error(String(err));
  log.error('unhandled_error', {
    request_id: c.get('requestId'),
    user_id: c.get('userId') ?? null,
    error: err_obj.message,
    stack: err_obj.stack,
    ...extra,
  });
  if (!dsn) return;

  try {
    const dsnMatch = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(\d+)$/);
    if (!dsnMatch) return;
    const [, publicKey, host, projectId] = dsnMatch as [string, string, string, string];
    const body = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      level: 'error',
      environment: c.env.ENVIRONMENT ?? 'production',
      exception: {
        values: [{ type: err_obj.name, value: err_obj.message, stacktrace: { frames: [] } }],
      },
      request: { method: c.req.method, url: c.req.url },
      tags: { request_id: c.get('requestId') },
      extra,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7,sentry_client=houselog-worker/1.0,sentry_key=${publicKey}`,
    };
    const url = `https://${host}/api/${projectId}/store/`;
    const send = fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }).catch(() => {});
    // Não bloquear response em produção
    const ctx = (c as unknown as { executionCtx?: { waitUntil: (p: Promise<unknown>) => void } }).executionCtx;
    if (ctx?.waitUntil) ctx.waitUntil(send);
    else await send;
  } catch {
    // silencioso — observabilidade não pode derrubar API
  }
}
