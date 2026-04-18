import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { err, ok } from '../lib/response';
import { buildBrCode, validatePixKey } from '../lib/pix';
import { parseNfeXml } from '../lib/nfe';
import { getDb } from '../db/client';
import { expenses, nfeImports, pixCharges, serviceOrders } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const finance = new Hono<{ Bindings: Bindings; Variables: Variables }>();

finance.use('*', authMiddleware);

// ── GET /properties/:propertyId/finance/dre?from=YYYY-MM&to=YYYY-MM ──────────
// DRE simplificado: receita bruta, custos (services/OS concluídas), despesas, saldo.
finance.get('/dre', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 7);
  const to = c.req.query('to') ?? from;

  const expenseRows = await db
    .select({
      type: sql<string>`COALESCE(${expenses.type}, 'expense')`,
      category: expenses.category,
      total: sql<number>`SUM(${expenses.amount})`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.propertyId, propertyId),
        isNull(expenses.deletedAt),
        sql`${expenses.referenceMonth} BETWEEN ${from} AND ${to}`
      )
    )
    .groupBy(sql`COALESCE(${expenses.type}, 'expense')`, expenses.category);

  const [osCost] = await db
    .select({ total: sql<number | null>`SUM(${serviceOrders.cost})` })
    .from(serviceOrders)
    .where(
      and(
        eq(serviceOrders.propertyId, propertyId),
        isNull(serviceOrders.deletedAt),
        sql`${serviceOrders.status} IN ('completed','verified')`,
        sql`substr(COALESCE(${serviceOrders.completedAt}, ${serviceOrders.createdAt}),1,7) BETWEEN ${from} AND ${to}`
      )
    )
    .limit(1);

  let revenue = 0;
  let expense = 0;
  const byCategory: Record<string, number> = {};
  for (const row of expenseRows) {
    if (row.type === 'revenue') revenue += row.total;
    else {
      expense += row.total;
      byCategory[row.category] = (byCategory[row.category] ?? 0) + row.total;
    }
  }
  const osTotal = osCost?.total ?? 0;

  return ok(c, {
    period: { from, to },
    revenue,
    expense,
    os_cost: osTotal,
    net: revenue - expense - osTotal,
    by_category: byCategory,
  });
});

// ── GET /properties/:propertyId/finance/cashflow?months=6 ─────────────────────
// Fluxo de caixa mensal (receita vs despesa).
finance.get('/cashflow', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const months = Math.min(24, Math.max(1, Number(c.req.query('months') ?? 6)));

  const rows = await db
    .select({
      month: expenses.referenceMonth,
      type: sql<string>`COALESCE(${expenses.type}, 'expense')`,
      total: sql<number>`SUM(${expenses.amount})`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.propertyId, propertyId),
        isNull(expenses.deletedAt),
        sql`${expenses.referenceMonth} >= strftime('%Y-%m', datetime('now', ${`-${months} months`}))`
      )
    )
    .groupBy(expenses.referenceMonth, sql`COALESCE(${expenses.type}, 'expense')`)
    .orderBy(expenses.referenceMonth);

  const map = new Map<string, { month: string; revenue: number; expense: number }>();
  for (const r of rows) {
    const m = map.get(r.month) ?? { month: r.month, revenue: 0, expense: 0 };
    if (r.type === 'revenue') m.revenue += r.total;
    else m.expense += r.total;
    map.set(r.month, m);
  }
  const series = [...map.values()].map((r) => ({ ...r, net: r.revenue - r.expense }));
  return ok(c, { months, series });
});

// ── POST /properties/:propertyId/finance/pix ─────────────────────────────────
const pixSchema = z.object({
  service_order_id: z.string().optional(),
  pix_key: z.string().min(5),
  pix_key_type: z.enum(['cpf', 'cnpj', 'email', 'phone', 'random']),
  amount_cents: z.number().int().positive(),
  merchant_name: z.string().min(1).max(25),
  merchant_city: z.string().min(1).max(15),
  description: z.string().max(40).optional(),
  expires_in_minutes: z.number().int().min(5).max(1440).default(60),
});

finance.post('/pix', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const parsed = pixSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const b = parsed.data;

  if (!validatePixKey(b.pix_key, b.pix_key_type)) {
    return err(c, 'Chave Pix inválida', 'VALIDATION_ERROR', 422);
  }

  const id = nanoid();
  const txid = nanoid(25).replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  const brCode = buildBrCode({
    pixKey: b.pix_key,
    merchantName: b.merchant_name,
    merchantCity: b.merchant_city,
    amountCents: b.amount_cents,
    txid,
    description: b.description,
  });
  const expiresAt = new Date(Date.now() + b.expires_in_minutes * 60_000).toISOString();

  await db.insert(pixCharges).values({
    id,
    serviceOrderId: b.service_order_id ?? null,
    propertyId,
    createdBy: userId,
    pixKey: b.pix_key,
    pixKeyType: b.pix_key_type,
    amountCents: b.amount_cents,
    merchantName: b.merchant_name,
    merchantCity: b.merchant_city,
    txid,
    brCode,
    description: b.description ?? null,
    status: 'pending',
    expiresAt,
  });

  return ok(c, { id, txid, br_code: brCode, expires_at: expiresAt, status: 'pending' }, 201);
});

finance.get('/pix', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }
  const rows = await db
    .select({
      id: pixCharges.id,
      service_order_id: pixCharges.serviceOrderId,
      amount_cents: pixCharges.amountCents,
      status: pixCharges.status,
      txid: pixCharges.txid,
      br_code: pixCharges.brCode,
      expires_at: pixCharges.expiresAt,
      paid_at: pixCharges.paidAt,
      created_at: pixCharges.createdAt,
    })
    .from(pixCharges)
    .where(eq(pixCharges.propertyId, propertyId))
    .orderBy(sql`${pixCharges.createdAt} DESC`)
    .limit(100);
  return ok(c, { data: rows });
});

// POST /pix/:id/mark-paid — conciliação manual (MVP, sem webhook real)
finance.post('/pix/:id/mark-paid', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }
  const id = c.req.param('id')!;
  const res = await db.run(
    sql`UPDATE pix_charges
        SET status = 'paid', paid_at = datetime('now')
        WHERE id = ${id} AND property_id = ${propertyId} AND status = 'pending'`
  );
  if (!res.meta.changes) return err(c, 'Cobrança não encontrada ou já paga', 'NOT_FOUND', 404);
  return ok(c, { id, status: 'paid' });
});

// ── POST /properties/:propertyId/finance/nfe — importa XML ────────────────────
finance.post('/nfe', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const body = await c.req
    .json<{ xml?: string; create_expense?: boolean }>()
    .catch(() => ({}) as { xml?: string; create_expense?: boolean });
  if (!body.xml || body.xml.length < 100) {
    return err(c, 'XML inválido', 'VALIDATION_ERROR', 422);
  }

  const nfe = parseNfeXml(body.xml);
  if (!nfe.chaveAcesso) return err(c, 'Chave de acesso não encontrada', 'VALIDATION_ERROR', 422);

  const [existing] = await db
    .select({ id: nfeImports.id, expense_id: nfeImports.expenseId })
    .from(nfeImports)
    .where(eq(nfeImports.chaveAcesso, nfe.chaveAcesso))
    .limit(1);
  if (existing) {
    return ok(c, { id: existing.id, duplicate: true, expense_id: existing.expense_id });
  }

  let expenseId: string | null = null;
  if (body.create_expense && nfe.valorTotal && nfe.dataEmissao) {
    expenseId = nanoid();
    const refMonth = nfe.dataEmissao.slice(0, 7);
    await db.insert(expenses).values({
      id: expenseId,
      propertyId,
      category: 'other',
      amount: nfe.valorTotal,
      referenceMonth: refMonth,
      notes: `NFe ${nfe.chaveAcesso} - ${nfe.nomeEmitente ?? ''}`,
      createdBy: userId,
    });
  }

  const id = nanoid();
  await db.insert(nfeImports).values({
    id,
    propertyId,
    documentId: null,
    expenseId,
    chaveAcesso: nfe.chaveAcesso,
    cnpjEmitente: nfe.cnpjEmitente,
    nomeEmitente: nfe.nomeEmitente,
    valorTotal: nfe.valorTotal,
    dataEmissao: nfe.dataEmissao,
    rawSummary: { items: nfe.items.slice(0, 20) },
  });

  return ok(
    c,
    {
      id,
      chave_acesso: nfe.chaveAcesso,
      emitente: nfe.nomeEmitente,
      valor_total: nfe.valorTotal,
      data_emissao: nfe.dataEmissao,
      item_count: nfe.items.length,
      expense_id: expenseId,
    },
    201
  );
});

export default finance;
