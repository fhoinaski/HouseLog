// Timeline/dossiê consolidado do imóvel.
// Une eventos de múltiplas origens: OS, despesas, documentos, manutenções,
// ratings, pix, nfe. Ordenado por data desc, paginado por cursor.

import { Hono } from 'hono';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { err, ok } from '../lib/response';
import type { Bindings, Variables } from '../lib/types';

const timeline = new Hono<{ Bindings: Bindings; Variables: Variables }>();
timeline.use('*', authMiddleware);

type Event = {
  kind: string;
  at: string;
  id: string;
  title: string;
  meta?: Record<string, unknown>;
};

async function safeAll<T>(
  db: D1Database,
  sql: string,
  params: unknown[]
): Promise<T[]> {
  try {
    const res = await db.prepare(sql).bind(...params).all<T>();
    return res.results ?? [];
  } catch {
    return [];
  }
}

// GET /properties/:propertyId/timeline?limit=50&before=<iso>
timeline.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }
  const limit = Math.min(200, Math.max(10, Number(c.req.query('limit') ?? 50)));
  const before = c.req.query('before') ?? new Date().toISOString();

  const os = await safeAll<{ id: string; title: string; status: string; created_at: string; priority: string }>(
    c.env.DB,
    `SELECT id, title, status, priority, created_at
     FROM service_orders
     WHERE property_id = ? AND deleted_at IS NULL AND created_at < ?
     ORDER BY created_at DESC LIMIT ?`,
    [propertyId, before, limit]
  );

  const exp = await safeAll<{ id: string; category: string; amount: number; created_at: string; type?: string }>(
    c.env.DB,
    `SELECT id, category, amount, created_at, COALESCE(type,'expense') AS type
     FROM expenses
     WHERE property_id = ? AND deleted_at IS NULL AND created_at < ?
     ORDER BY created_at DESC LIMIT ?`,
    [propertyId, before, limit]
  );

  const docs = await safeAll<{ id: string; title: string; created_at: string; kind: string }>(
    c.env.DB,
    `SELECT id, title, created_at, COALESCE(kind,'doc') AS kind
     FROM documents
     WHERE property_id = ? AND deleted_at IS NULL AND created_at < ?
     ORDER BY created_at DESC LIMIT ?`,
    [propertyId, before, limit]
  );

  const ratings = await safeAll<{ id: string; stars: number; provider_id: string; created_at: string }>(
    c.env.DB,
    `SELECT id, stars, provider_id, created_at
     FROM provider_ratings
     WHERE property_id = ? AND created_at < ?
     ORDER BY created_at DESC LIMIT ?`,
    [propertyId, before, limit]
  );

  const pix = await safeAll<{ id: string; amount_cents: number; status: string; created_at: string }>(
    c.env.DB,
    `SELECT id, amount_cents, status, created_at
     FROM pix_charges
     WHERE property_id = ? AND created_at < ?
     ORDER BY created_at DESC LIMIT ?`,
    [propertyId, before, limit]
  );

  const nfes = await safeAll<{ id: string; nome_emitente: string | null; valor_total: number | null; created_at: string }>(
    c.env.DB,
    `SELECT id, nome_emitente, valor_total, created_at
     FROM nfe_imports
     WHERE property_id = ? AND created_at < ?
     ORDER BY created_at DESC LIMIT ?`,
    [propertyId, before, limit]
  );

  const events: Event[] = [];
  for (const r of os)
    events.push({
      kind: 'service_order',
      id: r.id,
      at: r.created_at,
      title: r.title,
      meta: { status: r.status, priority: r.priority },
    });
  for (const r of exp)
    events.push({
      kind: r.type === 'revenue' ? 'revenue' : 'expense',
      id: r.id,
      at: r.created_at,
      title: `${r.category}`,
      meta: { amount: r.amount },
    });
  for (const r of docs)
    events.push({ kind: 'document', id: r.id, at: r.created_at, title: r.title, meta: { doc_kind: r.kind } });
  for (const r of ratings)
    events.push({
      kind: 'rating',
      id: r.id,
      at: r.created_at,
      title: `Avaliação ${r.stars}★`,
      meta: { provider_id: r.provider_id, stars: r.stars },
    });
  for (const r of pix)
    events.push({
      kind: 'pix',
      id: r.id,
      at: r.created_at,
      title: `Pix ${(r.amount_cents / 100).toFixed(2)} (${r.status})`,
      meta: { amount_cents: r.amount_cents, status: r.status },
    });
  for (const r of nfes)
    events.push({
      kind: 'nfe',
      id: r.id,
      at: r.created_at,
      title: `NFe ${r.nome_emitente ?? ''}`.trim(),
      meta: { valor_total: r.valor_total },
    });

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  const sliced = events.slice(0, limit);
  const nextCursor = sliced.length === limit ? sliced[sliced.length - 1]!.at : null;

  return ok(c, { data: sliced, next_cursor: nextCursor, has_more: nextCursor !== null });
});

export default timeline;
