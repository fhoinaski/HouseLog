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

// ── POST /maintenance/auto-check ─────────────────────────────────────────────
// Admin-only endpoint to trigger auto-creation of overdue service orders

maintenance.post('/auto-check', async (c) => {
  if (c.get('userRole') !== 'admin') return err(c, 'Forbidden', 'FORBIDDEN', 403);
  const result = await autoCreateOverdueOS(c.env.DB);
  return ok(c, result);
});

export default maintenance;

// ── Standalone exported function (also called by cron) ───────────────────────

type OverdueSchedule = {
  id: string;
  property_id: string;
  system_type: string;
  title: string;
  description: string | null;
  responsible: string | null;
  next_due: string;
};

export async function autoCreateOverdueOS(db: D1Database): Promise<{ checked: number; created: number; skipped: number }> {
  const { results: schedules } = await db
    .prepare(
      `SELECT ms.id, ms.property_id, ms.system_type, ms.title, ms.description,
              ms.responsible, ms.next_due
       FROM maintenance_schedules ms
       WHERE ms.auto_create_os = 1
         AND ms.next_due <= datetime('now')
         AND ms.deleted_at IS NULL`
    )
    .all<OverdueSchedule>();

  let created = 0;
  let skipped = 0;

  for (const schedule of schedules) {
    const autoTitle = `[Auto] ${schedule.title}`;

    // Check if an OS with this title and scheduled_at already exists for the property
    const existing = await db
      .prepare(
        `SELECT id FROM service_orders
         WHERE property_id = ?
           AND title = ?
           AND scheduled_at = ?
         LIMIT 1`
      )
      .bind(schedule.property_id, autoTitle, schedule.next_due)
      .first();

    if (existing) {
      skipped++;
      continue;
    }

    // Determine requested_by: responsible field or first owner of the property
    let requestedBy: string | null = schedule.responsible ?? null;
    if (!requestedBy) {
      const owner = await db
        .prepare(
          `SELECT owner_id FROM properties WHERE id = ? LIMIT 1`
        )
        .bind(schedule.property_id)
        .first<{ owner_id: string }>();
      requestedBy = owner?.owner_id ?? null;
    }

    const osId = nanoid();

    await db
      .prepare(
        `INSERT INTO service_orders
         (id, property_id, room_id, system_type, requested_by, assigned_to,
          title, description, priority, status, cost, warranty_until,
          scheduled_at, checklist, created_at)
         VALUES (?, ?, NULL, ?, ?, NULL, ?, ?, 'preventive', 'requested',
                 NULL, NULL, ?, '[]', datetime('now'))`
      )
      .bind(
        osId,
        schedule.property_id,
        schedule.system_type,
        requestedBy,
        autoTitle,
        schedule.description ?? null,
        schedule.next_due
      )
      .run();

    created++;
  }

  return { checked: schedules.length, created, skipped };
}

export async function sendMaintenanceDueEmails(
  db: D1Database,
  resendApiKey: string,
  appUrl: string
): Promise<void> {
  if (!resendApiKey) return;

  const { results } = await db.prepare(`
    SELECT m.id, m.title, m.next_due, m.property_id,
           CAST(julianday(m.next_due) - julianday('now') AS INTEGER) as days_until_due,
           p.name as property_name,
           u.id as user_id, u.email, u.name as user_name, u.notification_prefs
    FROM maintenance_schedules m
    JOIN properties p ON p.id = m.property_id
    JOIN users u ON u.id = p.owner_id
    WHERE m.deleted_at IS NULL
      AND julianday(m.next_due) - julianday('now') <= 3
      AND julianday(m.next_due) - julianday('now') > -7
    ORDER BY m.property_id, m.next_due
  `).all<{
    id: string; title: string; next_due: string; days_until_due: number;
    property_id: string; property_name: string;
    user_id: string; email: string; user_name: string; notification_prefs: string;
  }>();

  if (results.length === 0) return;

  // Group by user+property
  const grouped = new Map<string, typeof results>();
  for (const row of results) {
    const key = `${row.user_id}::${row.property_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const { sendEmail, emailMaintenanceDue } = await import('../lib/email');

  for (const [, schedules] of grouped) {
    const first = schedules[0];
    const prefs = JSON.parse(first.notification_prefs || '{}') as Record<string, boolean>;
    if (prefs.maintenance_due === false) continue;

    try {
      await sendEmail(resendApiKey, {
        to: first.email,
        subject: `${schedules.length} manutenção${schedules.length !== 1 ? 'ões' : ''} pendente${schedules.length !== 1 ? 's' : ''} em ${first.property_name}`,
        html: emailMaintenanceDue({
          recipientName: first.user_name,
          schedules: schedules.map(s => ({ title: s.title, days_until_due: s.days_until_due })),
          propertyName: first.property_name,
          appUrl,
          maintenanceUrl: `${appUrl}/properties/${first.property_id}/maintenance`,
        }),
      });
    } catch (e) {
      console.error(`Maintenance email failed for ${first.email}:`, e);
    }
  }
}
