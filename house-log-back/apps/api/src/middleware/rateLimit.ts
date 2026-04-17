import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../lib/types';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

export const rateLimitMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown';

  const key = `rl:${ip}`;
  const kv = c.env.KV;

  const raw = await kv.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= MAX_REQUESTS) {
    return c.json(
      { error: 'Muitas requisições. Tente novamente em um minuto.', code: 'RATE_LIMITED' },
      429
    );
  }

  // Increment — if new key, set TTL
  if (count === 0) {
    await kv.put(key, '1', { expirationTtl: WINDOW_SECONDS });
  } else {
    // KV doesn't allow atomic increment, so we overwrite and accept minor races
    await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS });
  }

  await next();
});
