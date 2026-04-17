import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import type { Bindings, Variables, Expense } from '../lib/types';

const expenses = new Hono<{ Bindings: Bindings; Variables: Variables }>();

expenses.use('*', authMiddleware);

const createSchema = z.object({
  type: z.enum(['expense', 'revenue']).default('expense'),
  category: z.enum(['water', 'electricity', 'gas', 'condo', 'iptu', 'insurance', 'cleaning', 'garden', 'security', 'other', 'rent', 'service']),
  amount: z.number().positive(),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
});

// ── GET /properties/:propertyId/expenses ─────────────────────────────────────

expenses.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const month = c.req.query('month');
  const category = c.req.query('category');
  const type = c.req.query('type');

  const conditions = ['property_id = ?', 'deleted_at IS NULL'];
  const bindings: unknown[] = [propertyId];

  if (month)    { conditions.push('reference_month = ?'); bindings.push(month); }
  if (category) { conditions.push('category = ?');        bindings.push(category); }
  if (type)     { conditions.push('type = ?');            bindings.push(type); }
  if (cursor)   { conditions.push('created_at < ?');      bindings.push(cursor); }

  bindings.push(limit + 1);

  const { results } = await c.env.DB
    .prepare(
      `SELECT * FROM expenses WHERE ${conditions.join(' AND ')}
       ORDER BY reference_month DESC, created_at DESC LIMIT ?`
    )
    .bind(...bindings)
    .all<Expense>();

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── GET /properties/:propertyId/expenses/summary ─────────────────────────────

expenses.get('/summary', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const from = c.req.query('from') ?? new Date(Date.now() - 6 * 30 * 86400000).toISOString().slice(0, 7);
  const to = c.req.query('to') ?? new Date().toISOString().slice(0, 7);

  const [byCategory, byMonth, byMonthRevenue] = await c.env.DB.batch([
    c.env.DB
      .prepare(
        `SELECT category, SUM(amount) as total, COUNT(*) as count
         FROM expenses
         WHERE property_id = ? AND deleted_at IS NULL AND type = 'expense'
           AND reference_month BETWEEN ? AND ?
         GROUP BY category ORDER BY total DESC`
      )
      .bind(propertyId, from, to),
    c.env.DB
      .prepare(
        `SELECT reference_month, SUM(amount) as total, COUNT(*) as count
         FROM expenses
         WHERE property_id = ? AND deleted_at IS NULL AND type = 'expense'
           AND reference_month BETWEEN ? AND ?
         GROUP BY reference_month ORDER BY reference_month ASC`
      )
      .bind(propertyId, from, to),
    c.env.DB
      .prepare(
        `SELECT reference_month, SUM(amount) as total
         FROM expenses
         WHERE property_id = ? AND deleted_at IS NULL AND type = 'revenue'
           AND reference_month BETWEEN ? AND ?
         GROUP BY reference_month ORDER BY reference_month ASC`
      )
      .bind(propertyId, from, to),
  ]);

  const totalRow = await c.env.DB
    .prepare(
      `SELECT SUM(amount) as total FROM expenses
       WHERE property_id = ? AND deleted_at IS NULL AND type = 'expense'
         AND reference_month BETWEEN ? AND ?`
    )
    .bind(propertyId, from, to)
    .first<{ total: number }>();

  const revenueRow = await c.env.DB
    .prepare(
      `SELECT SUM(amount) as total FROM expenses
       WHERE property_id = ? AND deleted_at IS NULL AND type = 'revenue'
         AND reference_month BETWEEN ? AND ?`
    )
    .bind(propertyId, from, to)
    .first<{ total: number }>();

  return ok(c, {
    total: totalRow?.total ?? 0,
    total_revenue: revenueRow?.total ?? 0,
    by_category: byCategory.results,
    by_month: byMonth.results,
    by_month_revenue: byMonthRevenue.results,
    period: { from, to },
  });
});

// ── POST /properties/:propertyId/expenses ────────────────────────────────────

expenses.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { type, category, amount, reference_month, notes, is_recurring } = parsed.data;

  // Build list of months to insert
  const months: string[] = [reference_month];
  const recurrenceGroup = is_recurring ? nanoid() : null;

  if (is_recurring) {
    const [year, month] = reference_month.split('-').map(Number);
    for (let i = 1; i <= 11; i++) {
      const d = new Date(year, month - 1 + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  const ids: string[] = [];
  for (const m of months) {
    const id = nanoid();
    ids.push(id);
    await c.env.DB
      .prepare(
        `INSERT INTO expenses (id, property_id, type, category, amount, reference_month, notes, is_recurring, recurrence_group, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(id, propertyId, type, category, amount, m, notes ?? null, is_recurring ? 1 : 0, recurrenceGroup, userId)
      .run();
  }

  const expense = await c.env.DB
    .prepare('SELECT * FROM expenses WHERE id = ?')
    .bind(ids[0])
    .first<Expense>();

  await writeAuditLog(c.env.DB, {
    entityType: 'expense', entityId: ids[0], action: 'create',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), newData: expense,
  });

  return ok(c, { expense, generated: ids.length }, 201);
});

// ── PUT /properties/:propertyId/expenses/:id ─────────────────────────────────

expenses.put('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM expenses WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<Expense>();

  if (!old) return err(c, 'Despesa não encontrada', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const pairs: [string, unknown][] = [];
  if (d.type !== undefined)            pairs.push(['type', d.type]);
  if (d.category !== undefined)        pairs.push(['category', d.category]);
  if (d.amount !== undefined)          pairs.push(['amount', d.amount]);
  if (d.reference_month !== undefined) pairs.push(['reference_month', d.reference_month]);
  if (d.notes !== undefined)           pairs.push(['notes', d.notes]);

  if (pairs.length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await c.env.DB
    .prepare(`UPDATE expenses SET ${pairs.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...pairs.map(([, v]) => v), id)
    .run();

  const updated = await c.env.DB
    .prepare('SELECT * FROM expenses WHERE id = ?')
    .bind(id)
    .first<Expense>();

  await writeAuditLog(c.env.DB, {
    entityType: 'expense', entityId: id, action: 'update',
    actorId: userId, oldData: old, newData: updated,
  });

  return ok(c, { expense: updated });
});

// ── DELETE /properties/:propertyId/expenses/:id ──────────────────────────────

expenses.delete('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM expenses WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<Expense>();

  if (!old) return err(c, 'Despesa não encontrada', 'NOT_FOUND', 404);

  const deleteAll = c.req.query('all_recurring') === '1';

  if (deleteAll && (old as Expense & { recurrence_group?: string }).recurrence_group) {
    await c.env.DB
      .prepare(`UPDATE expenses SET deleted_at = datetime('now') WHERE recurrence_group = ? AND property_id = ?`)
      .bind((old as Expense & { recurrence_group?: string }).recurrence_group, propertyId)
      .run();
  } else {
    await c.env.DB
      .prepare(`UPDATE expenses SET deleted_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run();
  }

  await writeAuditLog(c.env.DB, {
    entityType: 'expense', entityId: id, action: 'delete',
    actorId: userId, oldData: old,
  });

  return ok(c, { success: true });
});

export default expenses;
