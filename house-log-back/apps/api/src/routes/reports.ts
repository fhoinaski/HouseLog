import { Hono } from 'hono';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { getDb } from '../db/client';
import { documents, expenses, inventoryItems, properties, serviceOrders, users, maintenanceSchedules } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const reports = new Hono<{ Bindings: Bindings; Variables: Variables }>();
reports.use('*', authMiddleware);

// ── Health score computation ──────────────────────────────────────────────────
// Score = weighted sum of 5 factors (0–100):
//   1. Maintenance compliance   (30pts) — % of schedules not overdue
//   2. Service backlog          (20pts) — penalizes open/urgent OS
//   3. Preventive ratio         (20pts) — % of OS that are preventive
//   4. Property age penalty     (15pts) — older buildings score lower
//   5. Document completeness    (15pts) — has insurance + deed

async function computeHealthScore(db: D1Database, propertyId: string): Promise<{
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
      .where(and(eq(maintenanceSchedules.propertyId, propertyId), isNull(maintenanceSchedules.deletedAt)))
      .then((r) => r[0] as { total: number; overdue: number } | undefined),
    drizzle
      .select({
        total: sql<number>`COUNT(*)`,
        open: sql<number>`SUM(CASE WHEN ${serviceOrders.status} NOT IN ('completed','verified') THEN 1 ELSE 0 END)`,
        urgent: sql<number>`SUM(CASE WHEN ${serviceOrders.priority} = 'urgent' AND ${serviceOrders.status} NOT IN ('completed','verified') THEN 1 ELSE 0 END)`,
        preventive: sql<number>`SUM(CASE WHEN ${serviceOrders.priority} = 'preventive' THEN 1 ELSE 0 END)`,
      })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
      .then((r) => r[0] as {
        total: number; open: number; urgent: number; preventive: number;
      } | undefined),
    drizzle
      .select({ year_built: properties.yearBuilt })
      .from(properties)
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
      .limit(1)
      .then((r) => r[0] as { year_built: number | null } | undefined),
    drizzle
      .select({
        has_insurance: sql<number>`MAX(CASE WHEN ${documents.type} = 'insurance' THEN 1 ELSE 0 END)`,
        has_deed: sql<number>`MAX(CASE WHEN ${documents.type} = 'deed' THEN 1 ELSE 0 END)`,
      })
      .from(documents)
      .where(and(eq(documents.propertyId, propertyId), isNull(documents.deletedAt)))
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
    .where(eq(properties.id, propertyId));

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
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { score, breakdown } = await computeHealthScore(c.env.DB, propertyId);

  const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 30 ? 'Atenção' : 'Crítico';

  return ok(c, { score, label, breakdown });
});

// ── GET /properties/:id/report/valuation-pdf ─────────────────────────────────
// Generates a JSON "laudo" payload — PDF rendering happens client-side

reports.get('/valuation-pdf', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
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
      .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
      .limit(1)
      .then((r) => r[0]),
    computeHealthScore(c.env.DB, propertyId),
  ]);

  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const [servicesSummary, expensesTotal, servicesTotal, inventoryCount, recentServices] = await Promise.all([
    db
      .select({ status: serviceOrders.status, count: sql<number>`COUNT(*)` })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
      .groupBy(serviceOrders.status),
    db
      .select({ total: sql<number>`SUM(${expenses.amount})` })
      .from(expenses)
      .where(
        and(
          eq(expenses.propertyId, propertyId),
          isNull(expenses.deletedAt),
          sql`${expenses.referenceMonth} >= strftime('%Y-%m','now','-12 months')`
        )
      )
      .then((r) => r[0] as { total: number } | undefined),
    db
      .select({ total: sql<number>`SUM(${serviceOrders.cost})` })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt), sql`${serviceOrders.cost} IS NOT NULL`))
      .then((r) => r[0] as { total: number } | undefined),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
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
    maintenance_total: 0,
    inventory_items: inventoryCount?.count ?? 0,
    recent_services: recentServices,
  });
});

export { computeHealthScore };
export default reports;
