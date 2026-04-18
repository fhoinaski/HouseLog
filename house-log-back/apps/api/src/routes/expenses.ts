import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { getDb } from '../db/client';
import { expenses as expensesTable } from '../db/schema';
import type { Bindings, Variables, Expense } from '../lib/types';

const expenses = new Hono<{ Bindings: Bindings; Variables: Variables }>();

expenses.use('*', authMiddleware);

const createSchema = z.object({
  type: z.enum(['expense', 'revenue']).default('expense'),
  category: z.enum(['water', 'electricity', 'gas', 'condo', 'iptu', 'insurance', 'cleaning', 'garden', 'security', 'other']),
  amount: z.number().positive(),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/, 'Formato YYYY-MM'),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
});

// ── GET /properties/:propertyId/expenses ─────────────────────────────────────

expenses.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const month = c.req.query('month');
  const category = c.req.query('category');
  const type = c.req.query('type');

  const filters = [eq(expensesTable.propertyId, propertyId), isNull(expensesTable.deletedAt)];
  if (month) filters.push(eq(expensesTable.referenceMonth, month));
  if (category) filters.push(eq(expensesTable.category, category as typeof expensesTable.$inferSelect.category));
  if (type) filters.push(eq(expensesTable.type, type as typeof expensesTable.$inferSelect.type));
  if (cursor) filters.push(lt(expensesTable.createdAt, cursor));

  const results = await db
    .select({
      id: expensesTable.id,
      property_id: expensesTable.propertyId,
      category: expensesTable.category,
      amount: expensesTable.amount,
      type: expensesTable.type,
      reference_month: expensesTable.referenceMonth,
      is_recurring: expensesTable.isRecurring,
      recurrence_group: expensesTable.recurrenceGroup,
      receipt_url: expensesTable.receiptUrl,
      notes: expensesTable.notes,
      created_by: expensesTable.createdBy,
      created_at: expensesTable.createdAt,
      deleted_at: expensesTable.deletedAt,
    })
    .from(expensesTable)
    .where(and(...filters))
    .orderBy(desc(expensesTable.referenceMonth), desc(expensesTable.createdAt))
    .limit(limit + 1) as Expense[];

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── GET /properties/:propertyId/expenses/summary ─────────────────────────────

expenses.get('/summary', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const from = c.req.query('from') ?? new Date(Date.now() - 6 * 30 * 86400000).toISOString().slice(0, 7);
  const to = c.req.query('to') ?? new Date().toISOString().slice(0, 7);

  const baseFilters = [
    eq(expensesTable.propertyId, propertyId),
    isNull(expensesTable.deletedAt),
    sql`${expensesTable.referenceMonth} BETWEEN ${from} AND ${to}`,
  ];

  const byCategory = await db
    .select({
      category: expensesTable.category,
      total: sql<number>`SUM(${expensesTable.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(expensesTable)
    .where(and(...baseFilters, eq(expensesTable.type, 'expense')))
    .groupBy(expensesTable.category)
    .orderBy(sql`SUM(${expensesTable.amount}) DESC`);

  const byMonth = await db
    .select({
      reference_month: expensesTable.referenceMonth,
      total: sql<number>`SUM(${expensesTable.amount})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(expensesTable)
    .where(and(...baseFilters, eq(expensesTable.type, 'expense')))
    .groupBy(expensesTable.referenceMonth)
    .orderBy(expensesTable.referenceMonth);

  const byMonthRevenue = await db
    .select({
      reference_month: expensesTable.referenceMonth,
      total: sql<number>`SUM(${expensesTable.amount})`,
    })
    .from(expensesTable)
    .where(and(...baseFilters, eq(expensesTable.type, 'revenue')))
    .groupBy(expensesTable.referenceMonth)
    .orderBy(expensesTable.referenceMonth);

  const [totalRow] = await db
    .select({ total: sql<number>`SUM(${expensesTable.amount})` })
    .from(expensesTable)
    .where(and(...baseFilters, eq(expensesTable.type, 'expense')));

  const [revenueRow] = await db
    .select({ total: sql<number>`SUM(${expensesTable.amount})` })
    .from(expensesTable)
    .where(and(...baseFilters, eq(expensesTable.type, 'revenue')));

  return ok(c, {
    total: totalRow?.total ?? 0,
    total_revenue: revenueRow?.total ?? 0,
    by_category: byCategory,
    by_month: byMonth,
    by_month_revenue: byMonthRevenue,
    period: { from, to },
  });
});

// ── POST /properties/:propertyId/expenses ────────────────────────────────────

expenses.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
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
    const [yearStr, monthStr] = reference_month.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return err(c, 'Mês de referência inválido', 'VALIDATION_ERROR', 422);
    }
    for (let i = 1; i <= 11; i++) {
      const d = new Date(year, month - 1 + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  const ids: string[] = [];
  for (const m of months) {
    const id = nanoid();
    ids.push(id);
    await db.insert(expensesTable).values({
      id,
      propertyId,
      type,
      category,
      amount,
      referenceMonth: m,
      notes: notes ?? null,
      isRecurring: is_recurring ? 1 : 0,
      recurrenceGroup,
      createdBy: userId,
    });
  }

  const firstId = ids[0];
  if (!firstId) {
    return err(c, 'Falha ao criar despesa', 'INTERNAL_ERROR', 500);
  }

  const [expense] = await db
    .select({
      id: expensesTable.id,
      property_id: expensesTable.propertyId,
      category: expensesTable.category,
      amount: expensesTable.amount,
      type: expensesTable.type,
      reference_month: expensesTable.referenceMonth,
      is_recurring: expensesTable.isRecurring,
      recurrence_group: expensesTable.recurrenceGroup,
      receipt_url: expensesTable.receiptUrl,
      notes: expensesTable.notes,
      created_by: expensesTable.createdBy,
      created_at: expensesTable.createdAt,
      deleted_at: expensesTable.deletedAt,
    })
    .from(expensesTable)
    .where(eq(expensesTable.id, firstId))
    .limit(1) as Expense[];

  if (!expense) {
    return err(c, 'Falha ao criar despesa', 'INTERNAL_ERROR', 500);
  }

  await writeAuditLog(c.env.DB, {
    entityType: 'expense', entityId: firstId, action: 'create',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), newData: expense,
  });

  return ok(c, { expense, generated: ids.length }, 201);
});

// ── PUT /properties/:propertyId/expenses/:id ─────────────────────────────────

expenses.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: expensesTable.id,
      property_id: expensesTable.propertyId,
      category: expensesTable.category,
      amount: expensesTable.amount,
      type: expensesTable.type,
      reference_month: expensesTable.referenceMonth,
      is_recurring: expensesTable.isRecurring,
      recurrence_group: expensesTable.recurrenceGroup,
      receipt_url: expensesTable.receiptUrl,
      notes: expensesTable.notes,
      created_by: expensesTable.createdBy,
      created_at: expensesTable.createdAt,
      deleted_at: expensesTable.deletedAt,
    })
    .from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.propertyId, propertyId), isNull(expensesTable.deletedAt)))
    .limit(1) as Expense[];

  if (!old) return err(c, 'Despesa não encontrada', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const patch: Partial<typeof expensesTable.$inferInsert> = {};
  if (d.type !== undefined) patch.type = d.type;
  if (d.category !== undefined) patch.category = d.category;
  if (d.amount !== undefined) patch.amount = d.amount;
  if (d.reference_month !== undefined) patch.referenceMonth = d.reference_month;
  if (d.notes !== undefined) patch.notes = d.notes;

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db.update(expensesTable).set(patch).where(eq(expensesTable.id, id));

  const [updated] = await db
    .select({
      id: expensesTable.id,
      property_id: expensesTable.propertyId,
      category: expensesTable.category,
      amount: expensesTable.amount,
      type: expensesTable.type,
      reference_month: expensesTable.referenceMonth,
      is_recurring: expensesTable.isRecurring,
      recurrence_group: expensesTable.recurrenceGroup,
      receipt_url: expensesTable.receiptUrl,
      notes: expensesTable.notes,
      created_by: expensesTable.createdBy,
      created_at: expensesTable.createdAt,
      deleted_at: expensesTable.deletedAt,
    })
    .from(expensesTable)
    .where(eq(expensesTable.id, id))
    .limit(1) as Expense[];

  await writeAuditLog(c.env.DB, {
    entityType: 'expense', entityId: id, action: 'update',
    actorId: userId, oldData: old, newData: updated,
  });

  return ok(c, { expense: updated });
});

// ── DELETE /properties/:propertyId/expenses/:id ──────────────────────────────

expenses.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: expensesTable.id,
      property_id: expensesTable.propertyId,
      category: expensesTable.category,
      amount: expensesTable.amount,
      type: expensesTable.type,
      reference_month: expensesTable.referenceMonth,
      is_recurring: expensesTable.isRecurring,
      recurrence_group: expensesTable.recurrenceGroup,
      receipt_url: expensesTable.receiptUrl,
      notes: expensesTable.notes,
      created_by: expensesTable.createdBy,
      created_at: expensesTable.createdAt,
      deleted_at: expensesTable.deletedAt,
    })
    .from(expensesTable)
    .where(and(eq(expensesTable.id, id), eq(expensesTable.propertyId, propertyId), isNull(expensesTable.deletedAt)))
    .limit(1) as Array<Expense & { recurrence_group?: string | null }>;

  if (!old) return err(c, 'Despesa não encontrada', 'NOT_FOUND', 404);

  const deleteAll = c.req.query('all_recurring') === '1';

  if (deleteAll && old.recurrence_group) {
    await db
      .update(expensesTable)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(expensesTable.recurrenceGroup, old.recurrence_group), eq(expensesTable.propertyId, propertyId)));
  } else {
    await db
      .update(expensesTable)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(expensesTable.id, id));
  }

  await writeAuditLog(c.env.DB, {
    entityType: 'expense', entityId: id, action: 'delete',
    actorId: userId, oldData: old,
  });

  return ok(c, { success: true });
});

export default expenses;
