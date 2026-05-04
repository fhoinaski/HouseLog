import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { canMarkMaintenanceDone } from '../lib/authorization';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { canCreateMaintenanceScheduleInTenant, canUseTenantMaintenanceSchedule } from '../lib/maintenance-tenant';
import { getDb } from '../db/client';
import { maintenanceSchedules, properties, serviceOrders, users } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

type MaintenanceSchedule = {
  id: string; tenant_id: string | null; property_id: string; system_type: string; title: string;
  description: string | null; responsible: string | null;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  last_done: string | null; next_due: string | null;
  auto_create_os: number; notes: string | null;
  created_at: string; deleted_at: string | null;
};

type MaintenanceScheduleResponse = Omit<MaintenanceSchedule, 'tenant_id'>;

const maintenance = new Hono<{ Bindings: Bindings; Variables: Variables }>();
maintenance.use('*', authMiddleware);
maintenance.use('*', resolveTenant);

type MaintenanceContext = Context<{ Bindings: Bindings; Variables: Variables }>;

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

function toMaintenanceScheduleResponse(schedule: MaintenanceSchedule): MaintenanceScheduleResponse {
  const { tenant_id: _tenantId, ...response } = schedule;
  return response;
}

async function getTenantProperty(db: D1Database, propertyId: string, tenantId: string) {
  const drizzle = getDb(db);
  const [property] = await drizzle
    .select({ id: properties.id, tenant_id: properties.tenantId })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);

  return property ?? null;
}

async function markMaintenanceDone(c: MaintenanceContext) {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const tenantProperty = await getTenantProperty(c.env.DB, propertyId, tenantId);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await canMarkMaintenanceDone(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [schedule] = await db
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      frequency: maintenanceSchedules.frequency,
      last_done: maintenanceSchedules.lastDone,
      next_due: maintenanceSchedules.nextDue,
      auto_create_os: maintenanceSchedules.autoCreateOs,
      notes: maintenanceSchedules.notes,
      created_at: maintenanceSchedules.createdAt,
      deleted_at: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.id, id),
        eq(maintenanceSchedules.tenantId, tenantId),
        eq(maintenanceSchedules.propertyId, propertyId),
        isNull(maintenanceSchedules.deletedAt)
      )
    )
    .limit(1) as MaintenanceSchedule[];

  if (!schedule) return err(c, 'Agendamento nÃ£o encontrado', 'NOT_FOUND', 404);

  const tenantDecision = canUseTenantMaintenanceSchedule({
    activeTenantId: tenantId,
    propertyTenantId: tenantProperty.tenant_id,
    scheduleTenantId: schedule.tenant_id,
    schedulePropertyId: schedule.property_id,
    requestedPropertyId: propertyId,
  });
  if (!tenantDecision.allowed) return err(c, 'Agendamento nao encontrado', tenantDecision.code, tenantDecision.status);

  const today = new Date().toISOString().slice(0, 10);
  const nextDue = calcNextDue(schedule.frequency, today);

  await db
    .update(maintenanceSchedules)
    .set({ lastDone: today, nextDue })
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId)));

  // If auto_create_os is enabled, create a service order
  if (schedule.auto_create_os) {
    const osId = nanoid();
    await db.insert(serviceOrders).values({
      id: osId,
      tenantId,
      propertyId,
      systemType: schedule.system_type as typeof serviceOrders.$inferInsert.systemType,
      requestedBy: userId,
      title: `[Auto] ${schedule.title}`,
      description: `ManutenÃ§Ã£o preventiva gerada automaticamente. PrÃ³xima: ${nextDue}`,
      priority: 'preventive',
      status: 'requested',
      beforePhotos: [],
      afterPhotos: [],
      checklist: [],
    });

    await writeAuditLog(c.env.DB, {
      tenantId,
      propertyId,
      entityType: 'service_order',
      entityId: osId,
      action: 'auto_create',
      actorId: userId,
      newData: { maintenance_schedule_id: id, property_id: propertyId },
    });
  }

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'maintenance_schedule',
    entityId: id,
    action: 'maintenance_mark_done',
    actorId: userId,
    oldData: {
      previous_last_done: schedule.last_done,
      previous_next_due: schedule.next_due,
      auto_create_os: schedule.auto_create_os === 1,
    },
    newData: {
      property_id: propertyId,
      maintenance_schedule_id: id,
      last_done: today,
      next_due: nextDue,
      auto_create_os: schedule.auto_create_os === 1,
    },
  });

  return ok(c, { last_done: today, next_due: nextDue });
}

// ── GET /properties/:propertyId/maintenance ───────────────────────────────────

maintenance.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const tenantProperty = await getTenantProperty(c.env.DB, propertyId, tenantId);
  const tenantDecision = canCreateMaintenanceScheduleInTenant({
    activeTenantId: tenantId,
    propertyTenantId: tenantProperty?.tenant_id,
  });
  if (!tenantDecision.allowed) return err(c, 'Imovel nao encontrado', tenantDecision.code, tenantDecision.status);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      frequency: maintenanceSchedules.frequency,
      last_done: maintenanceSchedules.lastDone,
      next_due: maintenanceSchedules.nextDue,
      auto_create_os: maintenanceSchedules.autoCreateOs,
      notes: maintenanceSchedules.notes,
      created_at: maintenanceSchedules.createdAt,
      deleted_at: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(and(eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId), isNull(maintenanceSchedules.deletedAt)))
    .orderBy(asc(maintenanceSchedules.nextDue)) as MaintenanceSchedule[];

  // Flag overdue items
  const today = new Date().toISOString().slice(0, 10);
  const enriched = results.map((s) => {
    const schedule = toMaintenanceScheduleResponse(s);
    return {
      ...schedule,
      is_overdue: schedule.next_due != null && schedule.next_due < today,
      days_until_due: schedule.next_due
        ? Math.ceil((new Date(schedule.next_due).getTime() - Date.now()) / 86400000)
        : null,
    };
  });

  return ok(c, { schedules: enriched });
});

// ── POST /properties/:propertyId/maintenance ──────────────────────────────────

maintenance.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const tenantProperty = await getTenantProperty(c.env.DB, propertyId, tenantId);
  const tenantDecision = canCreateMaintenanceScheduleInTenant({
    activeTenantId: tenantId,
    propertyTenantId: tenantProperty?.tenant_id,
  });
  if (!tenantDecision.allowed) return err(c, 'Imovel nao encontrado', tenantDecision.code, tenantDecision.status);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
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

  await db.insert(maintenanceSchedules).values({
    id,
    tenantId,
    propertyId,
    systemType: system_type,
    title,
    description: description ?? null,
    frequency,
    responsible: responsible ?? null,
    lastDone: last_done ?? null,
    nextDue: next_due,
    autoCreateOs: auto_create_os ? 1 : 0,
    notes: notes ?? null,
  });

  const [schedule] = await db
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      frequency: maintenanceSchedules.frequency,
      last_done: maintenanceSchedules.lastDone,
      next_due: maintenanceSchedules.nextDue,
      auto_create_os: maintenanceSchedules.autoCreateOs,
      notes: maintenanceSchedules.notes,
      created_at: maintenanceSchedules.createdAt,
      deleted_at: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId)))
    .limit(1) as MaintenanceSchedule[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'maintenance_schedule', entityId: id, action: 'create',
    actorId: userId, newData: schedule,
  });

  return ok(c, { schedule: schedule ? toMaintenanceScheduleResponse(schedule) : null }, 201);
});

// ── PUT /properties/:propertyId/maintenance/:id ───────────────────────────────

maintenance.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const tenantProperty = await getTenantProperty(c.env.DB, propertyId, tenantId);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      frequency: maintenanceSchedules.frequency,
      last_done: maintenanceSchedules.lastDone,
      next_due: maintenanceSchedules.nextDue,
      auto_create_os: maintenanceSchedules.autoCreateOs,
      notes: maintenanceSchedules.notes,
      created_at: maintenanceSchedules.createdAt,
      deleted_at: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.id, id),
        eq(maintenanceSchedules.tenantId, tenantId),
        eq(maintenanceSchedules.propertyId, propertyId),
        isNull(maintenanceSchedules.deletedAt)
      )
    )
    .limit(1) as MaintenanceSchedule[];

  if (!old) return err(c, 'Agendamento não encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const patch: Partial<typeof maintenanceSchedules.$inferInsert> = {};

  if (d.system_type !== undefined) patch.systemType = d.system_type;
  if (d.title !== undefined) patch.title = d.title;
  if (d.description !== undefined) patch.description = d.description ?? null;
  if (d.frequency !== undefined) patch.frequency = d.frequency;
  if (d.responsible !== undefined) patch.responsible = d.responsible ?? null;
  if (d.notes !== undefined) patch.notes = d.notes;
  if (d.auto_create_os !== undefined) patch.autoCreateOs = d.auto_create_os ? 1 : 0;
  if (d.last_done !== undefined) {
    patch.lastDone = d.last_done;
    patch.nextDue = calcNextDue(d.frequency ?? old.frequency, d.last_done);
  }

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db
    .update(maintenanceSchedules)
    .set(patch)
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId)));

  const [updated] = await db
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      frequency: maintenanceSchedules.frequency,
      last_done: maintenanceSchedules.lastDone,
      next_due: maintenanceSchedules.nextDue,
      auto_create_os: maintenanceSchedules.autoCreateOs,
      notes: maintenanceSchedules.notes,
      created_at: maintenanceSchedules.createdAt,
      deleted_at: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId)))
    .limit(1) as MaintenanceSchedule[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'maintenance_schedule', entityId: id, action: 'update',
    actorId: userId, oldData: old, newData: updated,
  });

  return ok(c, { schedule: updated ? toMaintenanceScheduleResponse(updated) : null });
});

// ── POST /properties/:propertyId/maintenance/:id/done ────────────────────────
// Mark a maintenance as completed today → recalculate next_due

maintenance.post('/:id/mark-done', markMaintenanceDone);

maintenance.post('/:id/done', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const tenantProperty = await getTenantProperty(c.env.DB, propertyId, tenantId);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await canMarkMaintenanceDone(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [schedule] = await db
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      frequency: maintenanceSchedules.frequency,
      last_done: maintenanceSchedules.lastDone,
      next_due: maintenanceSchedules.nextDue,
      auto_create_os: maintenanceSchedules.autoCreateOs,
      notes: maintenanceSchedules.notes,
      created_at: maintenanceSchedules.createdAt,
      deleted_at: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.id, id),
        eq(maintenanceSchedules.tenantId, tenantId),
        eq(maintenanceSchedules.propertyId, propertyId),
        isNull(maintenanceSchedules.deletedAt)
      )
    )
    .limit(1) as MaintenanceSchedule[];

  if (!schedule) return err(c, 'Agendamento não encontrado', 'NOT_FOUND', 404);

  const today = new Date().toISOString().slice(0, 10);
  const nextDue = calcNextDue(schedule.frequency, today);

  await db
    .update(maintenanceSchedules)
    .set({ lastDone: today, nextDue })
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId)));

  // If auto_create_os is enabled, create a service order
  if (schedule.auto_create_os) {
    const osId = nanoid();
    await db.insert(serviceOrders).values({
      id: osId,
      tenantId,
      propertyId,
      systemType: schedule.system_type as typeof serviceOrders.$inferInsert.systemType,
      requestedBy: userId,
      title: `[Auto] ${schedule.title}`,
      description: `Manutenção preventiva gerada automaticamente. Próxima: ${nextDue}`,
      priority: 'preventive',
      status: 'requested',
      beforePhotos: [],
      afterPhotos: [],
      checklist: [],
    });

    await writeAuditLog(c.env.DB, {
      tenantId,
      propertyId,
      entityType: 'service_order', entityId: osId, action: 'auto_create',
      actorId: userId, newData: { maintenance_schedule_id: id, property_id: propertyId },
    });
  }

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'maintenance_schedule', entityId: id, action: 'maintenance_mark_done',
    actorId: userId,
    oldData: {
      previous_last_done: schedule.last_done,
      previous_next_due: schedule.next_due,
      auto_create_os: schedule.auto_create_os === 1,
    },
    newData: {
      property_id: propertyId,
      maintenance_schedule_id: id,
      last_done: today,
      next_due: nextDue,
      auto_create_os: schedule.auto_create_os === 1,
    },
  });

  return ok(c, { last_done: today, next_due: nextDue });
});

// ── DELETE /properties/:propertyId/maintenance/:id ───────────────────────────

maintenance.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const tenantProperty = await getTenantProperty(c.env.DB, propertyId, tenantId);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      frequency: maintenanceSchedules.frequency,
      last_done: maintenanceSchedules.lastDone,
      next_due: maintenanceSchedules.nextDue,
      auto_create_os: maintenanceSchedules.autoCreateOs,
      notes: maintenanceSchedules.notes,
      created_at: maintenanceSchedules.createdAt,
      deleted_at: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(
      and(
        eq(maintenanceSchedules.id, id),
        eq(maintenanceSchedules.tenantId, tenantId),
        eq(maintenanceSchedules.propertyId, propertyId),
        isNull(maintenanceSchedules.deletedAt)
      )
    )
    .limit(1);

  if (!old) return err(c, 'Agendamento não encontrado', 'NOT_FOUND', 404);

  await db
    .update(maintenanceSchedules)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(maintenanceSchedules.id, id), eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
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
  tenant_id: string;
  property_id: string;
  system_type: string;
  title: string;
  description: string | null;
  responsible: string | null;
  next_due: string;
};

export async function autoCreateOverdueOS(db: D1Database): Promise<{ checked: number; created: number; skipped: number }> {
  const drizzle = getDb(db);
  const schedules = await drizzle
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      property_id: maintenanceSchedules.propertyId,
      system_type: maintenanceSchedules.systemType,
      title: maintenanceSchedules.title,
      description: maintenanceSchedules.description,
      responsible: maintenanceSchedules.responsible,
      next_due: maintenanceSchedules.nextDue,
    })
    .from(maintenanceSchedules)
    .innerJoin(properties, and(eq(properties.id, maintenanceSchedules.propertyId), eq(properties.tenantId, maintenanceSchedules.tenantId)))
    .where(
      and(
        eq(maintenanceSchedules.autoCreateOs, 1),
        isNotNull(maintenanceSchedules.tenantId),
        lte(maintenanceSchedules.nextDue, sql`datetime('now')`),
        isNull(maintenanceSchedules.deletedAt),
        isNull(properties.deletedAt)
      )
    ) as OverdueSchedule[];

  let created = 0;
  let skipped = 0;

  for (const schedule of schedules) {
    const autoTitle = `[Auto] ${schedule.title}`;

    // Check if an OS with this title and scheduled_at already exists for the property
    const [existing] = await drizzle
      .select({ id: serviceOrders.id })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.tenantId, schedule.tenant_id),
          eq(serviceOrders.propertyId, schedule.property_id),
          eq(serviceOrders.title, autoTitle),
          eq(serviceOrders.scheduledAt, schedule.next_due)
        )
      )
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    // Determine requested_by: responsible field or first owner of the property
    let requestedBy: string | null = schedule.responsible ?? null;
    if (!requestedBy) {
      const [owner] = await drizzle
        .select({ owner_id: properties.ownerId })
        .from(properties)
        .where(and(eq(properties.id, schedule.property_id), eq(properties.tenantId, schedule.tenant_id), isNull(properties.deletedAt)))
        .limit(1) as Array<{ owner_id: string }>;
      requestedBy = owner?.owner_id ?? null;
    }

    if (!requestedBy) {
      skipped++;
      continue;
    }

    const osId = nanoid();

    await drizzle.insert(serviceOrders).values({
      id: osId,
      tenantId: schedule.tenant_id,
      propertyId: schedule.property_id,
      systemType: schedule.system_type as typeof serviceOrders.$inferInsert.systemType,
      requestedBy,
      title: autoTitle,
      description: schedule.description ?? null,
      priority: 'preventive',
      status: 'requested',
      scheduledAt: schedule.next_due,
      checklist: [],
    });

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

  const drizzle = getDb(db);
  const results = await drizzle
    .select({
      id: maintenanceSchedules.id,
      tenant_id: maintenanceSchedules.tenantId,
      title: maintenanceSchedules.title,
      next_due: maintenanceSchedules.nextDue,
      property_id: maintenanceSchedules.propertyId,
      days_until_due: sql<number>`CAST(julianday(${maintenanceSchedules.nextDue}) - julianday('now') AS INTEGER)`,
      property_name: properties.name,
      user_id: users.id,
      email: users.email,
      user_name: users.name,
      notification_prefs: users.notificationPrefs,
    })
    .from(maintenanceSchedules)
    .innerJoin(properties, and(eq(properties.id, maintenanceSchedules.propertyId), eq(properties.tenantId, maintenanceSchedules.tenantId)))
    .innerJoin(users, eq(users.id, properties.ownerId))
    .where(
      and(
        isNotNull(maintenanceSchedules.tenantId),
        isNull(maintenanceSchedules.deletedAt),
        isNull(properties.deletedAt),
        lte(sql`julianday(${maintenanceSchedules.nextDue}) - julianday('now')`, 3),
        sql`julianday(${maintenanceSchedules.nextDue}) - julianday('now') > -7`
      )
    )
    .orderBy(maintenanceSchedules.propertyId, maintenanceSchedules.nextDue) as Array<{
    id: string; tenant_id: string; title: string; next_due: string; days_until_due: number;
    property_id: string; property_name: string;
    user_id: string; email: string; user_name: string; notification_prefs: string;
  }>;

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
    if (!first) continue;
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
