// Timeline/dossiê consolidado do imóvel.
// Une eventos de múltiplas origens: OS, despesas, documentos, manutenções,
// ratings, pix, nfe. Ordenado por data desc, paginado por cursor.

import { Hono } from 'hono';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { err, ok } from '../lib/response';
import { getDb } from '../db/client';
import { documents, expenses, nfeImports, pixCharges, providerRatings, serviceOrders } from '../db/schema';
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

// GET /properties/:propertyId/timeline?limit=50&before=<iso>
timeline.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }
  const limit = Math.min(200, Math.max(10, Number(c.req.query('limit') ?? 50)));
  const before = c.req.query('before') ?? new Date().toISOString();

  const os = await db
    .select({ id: serviceOrders.id, title: serviceOrders.title, status: serviceOrders.status, priority: serviceOrders.priority, created_at: serviceOrders.createdAt })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt), lt(serviceOrders.createdAt, before)))
    .orderBy(desc(serviceOrders.createdAt))
    .limit(limit);

  const exp = await db
    .select({ id: expenses.id, category: expenses.category, amount: expenses.amount, created_at: expenses.createdAt, type: sql<string>`COALESCE(${expenses.type}, 'expense')` })
    .from(expenses)
    .where(and(eq(expenses.propertyId, propertyId), isNull(expenses.deletedAt), lt(expenses.createdAt, before)))
    .orderBy(desc(expenses.createdAt))
    .limit(limit);

  const docs = await db
    .select({ id: documents.id, title: documents.title, created_at: documents.createdAt, kind: sql<string>`COALESCE(${documents.kind}, 'doc')` })
    .from(documents)
    .where(and(eq(documents.propertyId, propertyId), isNull(documents.deletedAt), lt(documents.createdAt, before)))
    .orderBy(desc(documents.createdAt))
    .limit(limit);

  const ratings = await db
    .select({ id: providerRatings.id, stars: providerRatings.stars, provider_id: providerRatings.providerId, created_at: providerRatings.createdAt })
    .from(providerRatings)
    .where(and(eq(providerRatings.propertyId, propertyId), lt(providerRatings.createdAt, before)))
    .orderBy(desc(providerRatings.createdAt))
    .limit(limit);

  const pix = await db
    .select({ id: pixCharges.id, amount_cents: pixCharges.amountCents, status: pixCharges.status, created_at: pixCharges.createdAt })
    .from(pixCharges)
    .where(and(eq(pixCharges.propertyId, propertyId), lt(pixCharges.createdAt, before)))
    .orderBy(desc(pixCharges.createdAt))
    .limit(limit);

  const nfes = await db
    .select({ id: nfeImports.id, nome_emitente: nfeImports.nomeEmitente, valor_total: nfeImports.valorTotal, created_at: nfeImports.createdAt })
    .from(nfeImports)
    .where(and(eq(nfeImports.propertyId, propertyId), lt(nfeImports.createdAt, before)))
    .orderBy(desc(nfeImports.createdAt))
    .limit(limit);

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
