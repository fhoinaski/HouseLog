import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { err, ok } from '../lib/response';
import { buildBrCode, validatePixKey } from '../lib/pix';
import { parseNfeXml } from '../lib/nfe';
import type { Bindings, Variables } from '../lib/types';

const finance = new Hono<{ Bindings: Bindings; Variables: Variables }>();

finance.use('*', authMiddleware);

// ── GET /properties/:propertyId/finance/dre?from=YYYY-MM&to=YYYY-MM ──────────
// DRE simplificado: receita bruta, custos (services/OS concluídas), despesas, saldo.
finance.get('/dre', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const from = c.req.query('from') ?? new Date().toISOString().slice(0, 7);
  const to = c.req.query('to') ?? from;

  const expenses = await c.env.DB
    .prepare(
      `SELECT
         COALESCE(type,'expense') AS type,
         category,
         SUM(amount) AS total
       FROM expenses
       WHERE property_id = ? AND deleted_at IS NULL
         AND reference_month BETWEEN ? AND ?
       GROUP BY COALESCE(type,'expense'), category`
    )
    .bind(propertyId, from, to)
    .all<{ type: string; category: string; total: number }>();

  const osCost = await c.env.DB
    .prepare(
      `SELECT SUM(cost) AS total
       FROM service_orders
       WHERE property_id = ? AND deleted_at IS NULL
         AND status IN ('completed','verified')
         AND substr(COALESCE(completed_at, created_at),1,7) BETWEEN ? AND ?`
    )
    .bind(propertyId, from, to)
    .first<{ total: number | null }>();

  let revenue = 0;
  let expense = 0;
  const byCategory: Record<string, number> = {};
  for (const row of expenses.results ?? []) {
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
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const months = Math.min(24, Math.max(1, Number(c.req.query('months') ?? 6)));

  const rows = await c.env.DB
    .prepare(
      `SELECT reference_month AS month,
              COALESCE(type,'expense') AS type,
              SUM(amount) AS total
       FROM expenses
       WHERE property_id = ? AND deleted_at IS NULL
         AND reference_month >= strftime('%Y-%m', datetime('now', ? ))
       GROUP BY reference_month, COALESCE(type,'expense')
       ORDER BY reference_month ASC`
    )
    .bind(propertyId, `-${months} months`)
    .all<{ month: string; type: string; total: number }>();

  const map = new Map<string, { month: string; revenue: number; expense: number }>();
  for (const r of rows.results ?? []) {
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
  const propertyId = c.req.param('propertyId');
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

  await c.env.DB
    .prepare(
      `INSERT INTO pix_charges
       (id, service_order_id, property_id, created_by, pix_key, pix_key_type,
        amount_cents, merchant_name, merchant_city, txid, br_code, description,
        status, expires_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending', ?)`
    )
    .bind(
      id,
      b.service_order_id ?? null,
      propertyId,
      userId,
      b.pix_key,
      b.pix_key_type,
      b.amount_cents,
      b.merchant_name,
      b.merchant_city,
      txid,
      brCode,
      b.description ?? null,
      expiresAt
    )
    .run();

  return ok(c, { id, txid, br_code: brCode, expires_at: expiresAt, status: 'pending' }, 201);
});

finance.get('/pix', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }
  const rows = await c.env.DB
    .prepare(
      `SELECT id, service_order_id, amount_cents, status, txid, br_code,
              expires_at, paid_at, created_at
       FROM pix_charges
       WHERE property_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    )
    .bind(propertyId)
    .all();
  return ok(c, { data: rows.results ?? [] });
});

// POST /pix/:id/mark-paid — conciliação manual (MVP, sem webhook real)
finance.post('/pix/:id/mark-paid', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await assertPropertyAccess(c.env.DB, propertyId, userId, role))) {
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }
  const id = c.req.param('id');
  const res = await c.env.DB
    .prepare(
      `UPDATE pix_charges
       SET status = 'paid', paid_at = datetime('now')
       WHERE id = ? AND property_id = ? AND status = 'pending'`
    )
    .bind(id, propertyId)
    .run();
  if (!res.meta.changes) return err(c, 'Cobrança não encontrada ou já paga', 'NOT_FOUND', 404);
  return ok(c, { id, status: 'paid' });
});

// ── POST /properties/:propertyId/finance/nfe — importa XML ────────────────────
finance.post('/nfe', async (c) => {
  const propertyId = c.req.param('propertyId');
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

  const existing = await c.env.DB
    .prepare(`SELECT id, expense_id FROM nfe_imports WHERE chave_acesso = ?`)
    .bind(nfe.chaveAcesso)
    .first<{ id: string; expense_id: string | null }>();
  if (existing) {
    return ok(c, { id: existing.id, duplicate: true, expense_id: existing.expense_id });
  }

  let expenseId: string | null = null;
  if (body.create_expense && nfe.valorTotal && nfe.dataEmissao) {
    expenseId = nanoid();
    const refMonth = nfe.dataEmissao.slice(0, 7);
    await c.env.DB
      .prepare(
        `INSERT INTO expenses
         (id, property_id, category, amount, reference_month, notes, created_by)
         VALUES (?,?,?,?,?,?,?)`
      )
      .bind(
        expenseId,
        propertyId,
        'other',
        nfe.valorTotal,
        refMonth,
        `NFe ${nfe.chaveAcesso} - ${nfe.nomeEmitente ?? ''}`,
        userId
      )
      .run();
  }

  const id = nanoid();
  await c.env.DB
    .prepare(
      `INSERT INTO nfe_imports
       (id, property_id, document_id, expense_id, chave_acesso, cnpj_emitente,
        nome_emitente, valor_total, data_emissao, raw_summary)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      id,
      propertyId,
      null,
      expenseId,
      nfe.chaveAcesso,
      nfe.cnpjEmitente,
      nfe.nomeEmitente,
      nfe.valorTotal,
      nfe.dataEmissao,
      JSON.stringify({ items: nfe.items.slice(0, 20) })
    )
    .run();

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
