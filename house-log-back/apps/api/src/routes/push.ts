import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { ok, err } from '../lib/response';
import { hasVapid, pushToUser } from '../lib/webpush';
import { getDb } from '../db/client';
import { pushSubscriptions } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const push = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// Retorna a chave pública VAPID para o frontend registrar a subscription.
push.get('/public-key', (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) return err(c, 'Push não configurado', 'PUSH_DISABLED', 503);
  return ok(c, { publicKey: key });
});

push.post('/subscribe', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { endpoint, keys } = parsed.data;

  // Upsert por endpoint (um device = um endpoint)
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: c.req.header('User-Agent') ?? null,
      })
      .where(eq(pushSubscriptions.id, existing.id));
    return ok(c, { id: existing.id, updated: true });
  }

  const id = nanoid();
  await db.insert(pushSubscriptions).values({
    id,
    userId,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: c.req.header('User-Agent') ?? null,
  });
  return ok(c, { id, created: true }, 201);
});

push.post('/unsubscribe', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;
  if (!endpoint) return err(c, 'endpoint obrigatório', 'INVALID_BODY', 400);

  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  return ok(c, { ok: true });
});

// Envia uma push de teste para o próprio usuário autenticado.
push.post('/test', authMiddleware, async (c) => {
  if (!hasVapid(c.env)) return err(c, 'Push não configurado', 'PUSH_DISABLED', 503);
  const userId = c.get('userId');
  const sent = await pushToUser(c.env.DB, c.env, userId, {
    title: 'HouseLog',
    body: 'Notificações ativadas com sucesso.',
    url: '/dashboard',
    tag: 'hl-test',
  });
  return ok(c, { sent });
});

export default push;
