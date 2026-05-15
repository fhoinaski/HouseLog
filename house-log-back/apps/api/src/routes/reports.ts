import { Hono } from 'hono';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { writeAuditLog } from '../lib/audit';
import { getDb } from '../db/client';
import { documents, expenses, inventoryItems, maintenanceSchedules, properties, renovations, rooms, serviceOrders, tenants, users, warranties } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';
import type { DossiePayload, DossieTimelineEvent } from '@houselog/contracts';

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>();
reports.use('*', authMiddleware);
reports.use('*', resolveTenant);

// ── Health score computation ──────────────────────────────────────────────────
// Score = weighted sum of 5 factors (0–100):
//   1. Maintenance compliance   (30pts) — % of schedules not overdue
//   2. Service backlog          (20pts) — penalizes open/urgent OS
//   3. Preventive ratio         (20pts) — % of OS that are preventive
//   4. Property age penalty     (15pts) — older buildings score lower
//   5. Document completeness    (15pts) — has insurance + deed

async function computeHealthScore(db: D1Database, propertyId: string, tenantId: string): Promise<{
  score: number;
  breakdown: Record<string, number>;
}> {
  const drizzle = getDb(db);
  const today = new Date().toISOString().slice(0, 10);

  const [maint, svc, age, doc] = await Promise.all([
    drizzle
      .select({
        total: sql<number>`COUNT(*)`,
        overdue: sql<number>`SUM(CASE WHEN ${maintenanceSchedules.nextDue} < ${today} THEN 1 ELSE 0 END)`,
      })
      .from(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId), isNull(maintenanceSchedules.deletedAt)))
      .then((r) => r[0] as { total: number; overdue: number } | undefined),
    drizzle
      .select({
        total: sql<number>`COUNT(*)`,
        open: sql<number>`SUM(CASE WHEN ${serviceOrders.status} NOT IN ('completed','verified') THEN 1 ELSE 0 END)`,
        urgent: sql<number>`SUM(CASE WHEN ${serviceOrders.priority} = 'urgent' AND ${serviceOrders.status} NOT IN ('completed','verified') THEN 1 ELSE 0 END)`,
        preventive: sql<number>`SUM(CASE WHEN ${serviceOrders.priority} = 'preventive' THEN 1 ELSE 0 END)`,
      })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
      .then((r) => r[0] as {
        total: number; open: number; urgent: number; preventive: number;
      } | undefined),
    drizzle
      .select({ year_built: properties.yearBuilt })
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
      .limit(1)
      .then((r) => r[0] as { year_built: number | null } | undefined),
    drizzle
      .select({
        has_insurance: sql<number>`MAX(CASE WHEN ${documents.type} = 'insurance' THEN 1 ELSE 0 END)`,
        has_deed: sql<number>`MAX(CASE WHEN ${documents.type} = 'deed' THEN 1 ELSE 0 END)`,
      })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.propertyId, propertyId), isNull(documents.deletedAt)))
      .then((r) => r[0] as { has_insurance: number; has_deed: number } | undefined),
  ]);

  const serviceStats = svc as {
    total: number; open: number; urgent: number; preventive: number;
  } | undefined;

  // 1. Maintenance compliance (30 pts)
  let maintScore = 30;
  if (maint && maint.total > 0) {
    const compliance = (maint.total - maint.overdue) / maint.total;
    maintScore = Math.round(30 * compliance);
  }

  // 2. Service backlog (20 pts)
  let svcScore = 20;
  if (serviceStats && serviceStats.total > 0) {
    const openRatio = (serviceStats.open || 0) / serviceStats.total;
    const urgentPenalty = Math.min((serviceStats.urgent || 0) * 3, 10);
    svcScore = Math.max(0, Math.round(20 * (1 - openRatio)) - urgentPenalty);
  }

  // 3. Preventive ratio (20 pts)
  let prevScore = 10; // base if no data
  if (serviceStats && serviceStats.total > 5) {
    const ratio = (serviceStats.preventive || 0) / serviceStats.total;
    prevScore = Math.round(20 * Math.min(ratio * 2, 1));
  }

  // 4. Age penalty (15 pts)
  let ageScore = 15;
  const yearBuilt = age?.year_built;
  if (yearBuilt) {
    const ageYears = new Date().getFullYear() - yearBuilt;
    if (ageYears > 50) ageScore = 3;
    else if (ageYears > 30) ageScore = 7;
    else if (ageYears > 15) ageScore = 11;
  }

  // 5. Document completeness (15 pts)
  const docScore =
    (doc?.has_insurance ? 8 : 0) + (doc?.has_deed ? 7 : 0);

  const total = maintScore + svcScore + prevScore + ageScore + docScore;
  const score = Math.min(Math.max(total, 0), 100);

  // Persist updated score
  await drizzle
    .update(properties)
    .set({ healthScore: score })
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId)));

  return {
    score,
    breakdown: {
      maintenance_compliance: maintScore,
      service_backlog: svcScore,
      preventive_ratio: prevScore,
      age_penalty: ageScore,
      document_completeness: docScore,
    },
  };
}

// ── GET /properties/:id/report/health-score ───────────────────────────────────

reports.get('/health-score', async (c) => {
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const db = getDb(c.env.DB);
  const [tenantProperty] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { score, breakdown } = await computeHealthScore(c.env.DB, propertyId, tenantId);

  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 30 ? 'Atenção' : 'Crítico';

  return ok(c, { score, label, breakdown });
});

// ── GET /properties/:id/report/valuation-pdf ─────────────────────────────────
// Generates a JSON "laudo" payload — PDF rendering happens client-side

reports.get('/valuation-pdf', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const [tenantProperty] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [property, { score, breakdown }] = await Promise.all([
    db
      .select({
        id: properties.id,
        owner_id: properties.ownerId,
        manager_id: properties.managerId,
        name: properties.name,
        type: properties.type,
        address: properties.address,
        city: properties.city,
        area_m2: properties.areaM2,
        year_built: properties.yearBuilt,
        structure: properties.structure,
        floors: properties.floors,
        cover_url: properties.coverUrl,
        health_score: properties.healthScore,
        created_at: properties.createdAt,
        deleted_at: properties.deletedAt,
        owner_name: users.name,
        owner_email: users.email,
      })
      .from(properties)
      .innerJoin(users, eq(users.id, properties.ownerId))
      .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
      .limit(1)
      .then((r) => r[0]),
    computeHealthScore(c.env.DB, propertyId, tenantId),
  ]);

  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const [servicesSummary, expensesTotal, servicesTotal, inventoryCount, maintenanceCount, recentServices] = await Promise.all([
    db
      .select({ status: serviceOrders.status, count: sql<number>`COUNT(*)` })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
      .groupBy(serviceOrders.status),
    db
      .select({ total: sql<number>`SUM(${expenses.amount})` })
      .from(expenses)
      .where(
        and(
          eq(expenses.propertyId, propertyId),
          eq(expenses.tenantId, tenantId),
          isNull(expenses.deletedAt),
          sql`${expenses.referenceMonth} >= strftime('%Y-%m','now','-12 months')`
        )
      )
      .then((r) => r[0] as { total: number } | undefined),
    db
      .select({ total: sql<number>`SUM(${serviceOrders.cost})` })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.propertyId, propertyId), eq(serviceOrders.tenantId, tenantId), isNull(serviceOrders.deletedAt), sql`${serviceOrders.cost} IS NOT NULL`))
      .then((r) => r[0] as { total: number } | undefined),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
      .then((r) => r[0] as { count: number } | undefined),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId), isNull(maintenanceSchedules.deletedAt)))
      .then((r) => r[0] as { count: number } | undefined),
    db
      .select({
        title: serviceOrders.title,
        system_type: serviceOrders.systemType,
        status: serviceOrders.status,
        completed_at: serviceOrders.completedAt,
        cost: serviceOrders.cost,
      })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.propertyId, propertyId),
          eq(serviceOrders.tenantId, tenantId),
          inArray(serviceOrders.status, ['completed', 'verified']),
          isNull(serviceOrders.deletedAt)
        )
      )
      .orderBy(sql`${serviceOrders.completedAt} DESC`)
      .limit(10),
  ]);

  return ok(c, {
    generated_at: new Date().toISOString(),
    property,
    health_score: score,
    health_label: score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 30 ? 'Atenção' : 'Crítico',
    health_breakdown: breakdown,
    services_summary: servicesSummary,
    expenses_total: expensesTotal?.total ?? 0,
    services_total: servicesTotal?.total ?? 0,
    maintenance_total: maintenanceCount?.count ?? 0,
    inventory_items: inventoryCount?.count ?? 0,
    recent_services: recentServices,
  });
});

// ── GET /properties/:id/report/dossie ────────────────────────────────────────
// Returns a JSON payload for client-side PDF rendering.
// No file is stored in R2 — PDF is generated in the browser via @react-pdf/renderer.

reports.get('/dossie', async (c) => {
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const db = getDb(c.env.DB);

  const [tenantProperty] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);

  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  // ── Parallel data fetch ────────────────────────────────────────────────────
  const [
    propRow,
    tenantRow,
    issuerRow,
    roomRows,
    inventoryRows,
    warrantyRows,
    renovationRows,
    completedSORows,
    documentRows,
    maintenanceRows,
  ] = await Promise.all([
    db
      .select({
        name: properties.name,
        type: properties.type,
        address: properties.address,
        city: properties.city,
        area_m2: properties.areaM2,
        year_built: properties.yearBuilt,
        structure: properties.structure,
        floors: properties.floors,
        health_score: properties.healthScore,
      })
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
      .limit(1)
      .then((r) => r[0]),

    db
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1)
      .then((r) => r[0]),

    db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((r) => r[0]),

    db
      .select({
        id: rooms.id,
        name: rooms.name,
        type: rooms.type,
        floor: rooms.floor,
        area_m2: rooms.areaM2,
      })
      .from(rooms)
      .where(and(eq(rooms.propertyId, propertyId), eq(rooms.tenantId, tenantId), isNull(rooms.deletedAt))),

    db
      .select({
        name: inventoryItems.name,
        category: inventoryItems.category,
        quantity: inventoryItems.quantity,
        unit: inventoryItems.unit,
        warranty_until: inventoryItems.warrantyUntil,
        brand: inventoryItems.brand,
        room_id: inventoryItems.roomId,
      })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.propertyId, propertyId), eq(inventoryItems.tenantId, tenantId), isNull(inventoryItems.deletedAt)))
      .orderBy(inventoryItems.category, inventoryItems.name),

    db
      .select({
        title: warranties.title,
        warranty_type: warranties.warrantyType,
        status: warranties.status,
        start_date: warranties.startDate,
        end_date: warranties.endDate,
        provider_name: warranties.providerName,
      })
      .from(warranties)
      .where(and(eq(warranties.propertyId, propertyId), eq(warranties.tenantId, tenantId), isNull(warranties.deletedAt)))
      .orderBy(warranties.endDate),

    db
      .select({
        title: renovations.title,
        category: renovations.category,
        status: renovations.status,
        started_at: renovations.startedAt,
        completed_at: renovations.completedAt,
        contractor_name: renovations.contractorName,
        cost: renovations.cost,
      })
      .from(renovations)
      .where(and(eq(renovations.propertyId, propertyId), eq(renovations.tenantId, tenantId), isNull(renovations.deletedAt)))
      .orderBy(desc(renovations.startedAt)),

    db
      .select({
        title: serviceOrders.title,
        system_type: serviceOrders.systemType,
        status: serviceOrders.status,
        priority: serviceOrders.priority,
        completed_at: serviceOrders.completedAt,
        cost: serviceOrders.cost,
      })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.propertyId, propertyId),
          eq(serviceOrders.tenantId, tenantId),
          inArray(serviceOrders.status, ['completed', 'verified']),
          isNull(serviceOrders.deletedAt)
        )
      )
      .orderBy(desc(serviceOrders.completedAt)),

    db
      .select({
        title: documents.title,
        type: documents.type,
        issue_date: documents.issueDate,
        expiry_date: documents.expiryDate,
      })
      .from(documents)
      .where(and(eq(documents.propertyId, propertyId), eq(documents.tenantId, tenantId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt)),

    db
      .select({
        title: maintenanceSchedules.title,
        system_type: maintenanceSchedules.systemType,
        frequency: maintenanceSchedules.frequency,
        last_done: maintenanceSchedules.lastDone,
        next_due: maintenanceSchedules.nextDue,
        responsible: maintenanceSchedules.responsible,
      })
      .from(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.propertyId, propertyId), eq(maintenanceSchedules.tenantId, tenantId), isNull(maintenanceSchedules.deletedAt)))
      .orderBy(maintenanceSchedules.systemType),
  ]);

  if (!propRow) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  // ── Room map for inventory enrichment ─────────────────────────────────────
  const roomMap = new Map<string, string>(roomRows.map((r) => [r.id, r.name]));

  // ── Build timeline ─────────────────────────────────────────────────────────
  const timeline: DossieTimelineEvent[] = [
    ...completedSORows
      .filter((s) => s.completed_at)
      .map((s) => ({ date: s.completed_at!, type: 'service_order' as const, title: s.title })),
    ...renovationRows
      .filter((r) => r.completed_at ?? r.started_at)
      .map((r) => ({ date: (r.completed_at ?? r.started_at)!, type: 'renovation' as const, title: r.title })),
    ...documentRows
      .filter((d) => d.issue_date)
      .map((d) => ({ date: d.issue_date!, type: 'document' as const, title: d.title })),
    ...warrantyRows
      .filter((w) => w.start_date)
      .map((w) => ({ date: w.start_date!, type: 'warranty' as const, title: w.title })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);

  // ── Assemble payload ───────────────────────────────────────────────────────
  const payload: DossiePayload = {
    generated_at: new Date().toISOString(),
    tenant_name: tenantRow?.name ?? '',
    issuer_name: issuerRow?.name ?? '',
    property: {
      name: propRow.name,
      type: propRow.type,
      address: propRow.address,
      city: propRow.city,
      area_m2: propRow.area_m2 ?? null,
      year_built: propRow.year_built ?? null,
      structure: propRow.structure ?? null,
      floors: propRow.floors ?? null,
      health_score: propRow.health_score ?? null,
    },
    rooms: roomRows.map(({ name, type, floor, area_m2 }) => ({ name, type, floor: floor ?? null, area_m2: area_m2 ?? null })),
    inventory_items: inventoryRows.map((item) => ({
      name: item.name,
      category: item.category,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      warranty_until: item.warranty_until ?? null,
      brand: item.brand ?? null,
      room_name: item.room_id ? (roomMap.get(item.room_id) ?? null) : null,
    })),
    warranties: warrantyRows,
    renovations: renovationRows,
    service_orders: completedSORows,
    documents: documentRows,
    maintenance_schedules: maintenanceRows,
    timeline,
  };

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'property',
    entityId: propertyId,
    action: 'property_dossie_generated',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
  });

  return ok(c, { dossie: payload });
});

export { computeHealthScore };
export default reports;
