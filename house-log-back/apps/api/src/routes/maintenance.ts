import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';

type MaintenanceSchedule = {
  id: string; property_id: string; system_type: string; title: string;
  description: string | null; responsible: string | null;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  last_done: string | null; next_due: string | null;
  auto_create_os: number; notes: string | null;
  created_at: string; deleted_at: string | null;
};

const maintenance = new Hono<{ Bindings: Bindings; Variables: Variables }>();
maintenance.use('*', authMiddleware);

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7, monthly: 30, quarterly: 90, semiannual: 180, annual: 365,
};

const schema = z.object({
  system_type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'semiannual', 'annual']),
  responsible: z.string().optional(),
  last_done: z.string().optional(),
  auto_create_os: z.boolean().default(false),
  notes: z.string().optional(),
});

function calcNextDue(frequency: string, lastDone?: string): string {
  const base = lastDone ? new Date(lastDone) : new Date();
  const days = FREQUENCY_DAYS[frequency] ?? 365;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

// ── GET /properties/:propertyId/maintenance ───────────────────────────────────

maintenance.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { results } = await c.env.DB
    .prepare(
      `SELECT * FROM maintenance_schedules
       WHERE property_id = ? AND deleted_at IS NULL
       ORDER BY next_due ASC NULLS LAST`
    )
    .bind(propertyId)
    .all<MaintenanceSchedule>();

  // Flag overdue items
  const today = new Date().toISOString().slice(0, 10);
  const enriched = results.map((s) => ({
    ...s,
    is_overdue: s.next_due != null && s.next_due < today,
    days_until_due: s.next_due
      ? Math.ceil((new Date(s.next_due).getTime() - Date.now()) / 86400000)
      : null,
  }));

  return ok(c, { schedules: enriched });
});

// ── POST /properties/:propertyId/maintenance ──────────────────────────────────

maintenance.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { system_type, title, description, frequency, responsible, last_done, auto_create_os, notes } = parsed.data;
  const next_due = calcNextDue(frequency, last_done);
  const id = nanoid();

  await c.env.DB
    .prepare(
      `INSERT INTO maintenance_schedules
       (id, property_id, system_type, title, description, frequency, responsible,
        last_done, next_due, auto_create_os, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id, propertyId, system_type, title, description ?? null, frequency,
      responsible ?? null, last_done ?? null, next_due, auto_create_os ? 1 : 0, notes ?? null
    )
    .run();

  const schedule = await c.env.DB
    .prepare('SELECT * FROM maintenance_schedules WHERE id = ?')
    .bind(id)
    .first<MaintenanceSchedule>();

  await writeAuditLog(c.env.DB, {
    entityType: 'maintenance_schedule', entityId: id, action: 'create',
    actorId: userId, newData: schedule,
  });

  return ok(c, { schedule }, 201);
});

// ── PUT /properties/:propertyId/maintenance/:id ───────────────────────────────

maintenance.put('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM maintenance_schedules WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<MaintenanceSchedule>();

  if (!old) return err(c, 'Agendamento não encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const pairs: [string, unknown][] = [];

  if (d.system_type !== undefined)    pairs.push(['system_type', d.system_type]);
  if (d.title !== undefined)          pairs.push(['title', d.title]);
  if (d.description !== undefined)    pairs.push(['description', d.description ?? null]);
  if (d.frequency !== undefined)      pairs.push(['frequency', d.frequency]);
  if (d.responsible !== undefined)    pairs.push(['responsible', d.responsible ?? null]);
  if (d.notes !== undefined)          pairs.push(['notes', d.notes]);
  if (d.auto_create_os !== undefined) pairs.push(['auto_create_os', d.auto_create_os ? 1 : 0]);
  if (d.last_done !== undefined) {
    pairs.push(['last_done', d.last_done]);
    pairs.push(['next_due', calcNextDue(d.frequency ?? old.frequency, d.last_done)]);
  }

  if (pairs.length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await c.env.DB
    .prepare(`UPDATE maintenance_schedules SET ${pairs.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...pairs.map(([, v]) => v), id)
    .run();

  const updated = await c.env.DB
    .prepare('SELECT * FROM maintenance_schedules WHERE id = ?')
    .bind(id)
    .first<MaintenanceSchedule>();

  await writeAuditLog(c.env.DB, {
    entityType: 'maintenance_schedule', entityId: id, action: 'update',
    actorId: userId, oldData: old, newData: updated,
  });

  return ok(c, { schedule: updated });
});

// ── POST /properties/:propertyId/maintenance/:id/done ────────────────────────
// Mark a maintenance as completed today → recalculate next_due

maintenance.post('/:id/done', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const schedule = await c.env.DB
    .prepare('SELECT * FROM maintenance_schedules WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<MaintenanceSchedule>();

  if (!schedule) return err(c, 'Agendamento não encontrado', 'NOT_FOUND', 404);

  const today = new Date().toISOString().slice(0, 10);
  const nextDue = calcNextDue(schedule.frequency, today);

  await c.env.DB
    .prepare('UPDATE maintenance_schedules SET last_done = ?, next_due = ? WHERE id = ?')
    .bind(today, nextDue, id)
    .run();

  // If auto_create_os is enabled, create a service order
  if (schedule.auto_create_os) {
    const osId = nanoid();
    await c.env.DB
      .prepare(
        `INSERT INTO service_orders
         (id, property_id, system_type, requested_by, title, description, priority, status,
          before_photos, after_photos, checklist, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'preventive', 'requested', '[]', '[]', '[]', datetime('now'))`
      )
      .bind(
        osId, propertyId, schedule.system_type, userId,
        `[Auto] ${schedule.title}`,
        `Manutenção preventiva gerada automaticamente. Próxima: ${nextDue}`
      )
      .run();

    await writeAuditLog(c.env.DB, {
      entityType: 'service_order', entityId: osId, action: 'auto_create',
      actorId: userId, newData: { maintenance_schedule_id: id },
    });
  }

  await writeAuditLog(c.env.DB, {
    entityType: 'maintenance_schedule', entityId: id, action: 'mark_done',
    actorId: userId, newData: { last_done: today, next_due: nextDue },
  });

  return ok(c, { last_done: today, next_due: nextDue });
});

// ── DELETE /properties/:propertyId/maintenance/:id ───────────────────────────

maintenance.delete('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM maintenance_schedules WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first();

  if (!old) return err(c, 'Agendamento não encontrado', 'NOT_FOUND', 404);

  await c.env.DB
    .prepare(`UPDATE maintenance_schedules SET deleted_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'maintenance_schedule', entityId: id, action: 'delete',
    actorId: userId, oldData: old,
  });

  return ok(c, { success: true });
});

export default maintenance;
