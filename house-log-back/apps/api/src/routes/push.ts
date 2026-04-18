import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authMiddleware } from '../middleware/auth';
import { ok, err } from '../lib/response';
import { hasVapid, pushToUser } from '../lib/webpush';
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
  const body = await c.req.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { endpoint, keys } = parsed.data;

  // Upsert por endpoint (um device = um endpoint)
  const existing = await c.env.DB
    .prepare(`SELECT id FROM push_subscriptions WHERE endpoint = ?`)
    .bind(endpoint)
    .first<{ id: string }>();

  if (existing) {
    await c.env.DB
      .prepare(
        `UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ? WHERE id = ?`
      )
      .bind(userId, keys.p256dh, keys.auth, c.req.header('User-Agent') ?? null, existing.id)
      .run();
    return ok(c, { id: existing.id, updated: true });
  }

  const id = nanoid();
  await c.env.DB
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, userId, endpoint, keys.p256dh, keys.auth, c.req.header('User-Agent') ?? null)
    .run();
  return ok(c, { id, created: true }, 201);
});

push.post('/unsubscribe', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : null;
  if (!endpoint) return err(c, 'endpoint obrigatório', 'INVALID_BODY', 400);

  await c.env.DB
    .prepare(`DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?`)
    .bind(userId, endpoint)
    .run();
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
