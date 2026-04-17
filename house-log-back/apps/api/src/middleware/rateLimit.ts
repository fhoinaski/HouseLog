import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../lib/types';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS_GENERAL = 100;   // per IP per minute for all API endpoints
const MAX_REQUESTS_AUTH = 10;       // per IP per minute for auth endpoints

async function applyRateLimit(
  kv: KVNamespace,
  key: string,
  max: number,
  window: number
): Promise<boolean> {
  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= max) return false; // limit exceeded

  if (count === 0) {
    await kv.put(key, '1', { expirationTtl: window });
  } else {
    // KV doesn't allow atomic increment, so we overwrite and accept minor races
    await kv.put(key, String(count + 1), { expirationTtl: window });
  }

  return true; // allowed
}

export const rateLimitMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

  const kv = c.env.KV;
  const isAuthRoute = c.req.path.startsWith('/api/v1/auth');

  const key = isAuthRoute ? `rl:auth:${ip}` : `rl:${ip}`;
  const max = isAuthRoute ? MAX_REQUESTS_AUTH : MAX_REQUESTS_GENERAL;

  const allowed = await applyRateLimit(kv, key, max, WINDOW_SECONDS);

  if (!allowed) {
    return c.json(
      { error: 'Muitas requisições. Tente novamente em um minuto.', code: 'RATE_LIMITED' },
      429
    );
  }

  await next();
});
