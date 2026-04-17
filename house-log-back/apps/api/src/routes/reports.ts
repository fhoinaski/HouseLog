import { Hono } from 'hono';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
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
  const today = new Date().toISOString().slice(0, 10);

  const [maintRow, serviceRow, ageRow, docRow] = await db.batch([
    db.prepare(
      `SELECT COUNT(*) as total,
       SUM(CASE WHEN next_due < ? THEN 1 ELSE 0 END) as overdue
       FROM maintenance_schedules WHERE property_id = ? AND deleted_at IS NULL`
    ).bind(today, propertyId),
    db.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status NOT IN ('completed','verified') THEN 1 ELSE 0 END) as open,
        SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('completed','verified') THEN 1 ELSE 0 END) as urgent,
        SUM(CASE WHEN priority = 'preventive' THEN 1 ELSE 0 END) as preventive
       FROM service_orders WHERE property_id = ? AND deleted_at IS NULL`
    ).bind(propertyId),
    db.prepare(
      'SELECT year_built FROM properties WHERE id = ? AND deleted_at IS NULL'
    ).bind(propertyId),
    db.prepare(
      `SELECT
        MAX(CASE WHEN type = 'insurance' THEN 1 ELSE 0 END) as has_insurance,
        MAX(CASE WHEN type = 'deed' THEN 1 ELSE 0 END) as has_deed
       FROM documents WHERE property_id = ? AND deleted_at IS NULL`
    ).bind(propertyId),
  ]);

  const maint = maintRow.results[0] as { total: number; overdue: number } | undefined;
  const svc = serviceRow.results[0] as {
    total: number; open: number; urgent: number; preventive: number;
  } | undefined;
  const age = ageRow.results[0] as { year_built: number | null } | undefined;
  const doc = docRow.results[0] as { has_insurance: number; has_deed: number } | undefined;

  // 1. Maintenance compliance (30 pts)
  let maintScore = 30;
  if (maint && maint.total > 0) {
    const compliance = (maint.total - maint.overdue) / maint.total;
    maintScore = Math.round(30 * compliance);
  }

  // 2. Service backlog (20 pts)
  let svcScore = 20;
  if (svc && svc.total > 0) {
    const openRatio = (svc.open || 0) / svc.total;
    const urgentPenalty = Math.min((svc.urgent || 0) * 3, 10);
    svcScore = Math.max(0, Math.round(20 * (1 - openRatio)) - urgentPenalty);
  }

  // 3. Preventive ratio (20 pts)
  let prevScore = 10; // base if no data
  if (svc && svc.total > 5) {
    const ratio = (svc.preventive || 0) / svc.total;
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
  await db
    .prepare('UPDATE properties SET health_score = ? WHERE id = ?')
    .bind(score, propertyId)
    .run();

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
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [property, { score, breakdown }] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT p.*, u.name as owner_name, u.email as owner_email
         FROM properties p JOIN users u ON u.id = p.owner_id
         WHERE p.id = ? AND p.deleted_at IS NULL`
      )
      .bind(propertyId)
      .first(),
    computeHealthScore(c.env.DB, propertyId),
  ]);

  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const [servicesSummary, expensesTotal, servicesTotal, inventoryCount, recentServices] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT status, COUNT(*) as count FROM service_orders
         WHERE property_id = ? AND deleted_at IS NULL GROUP BY status`
      )
      .bind(propertyId)
      .all(),
    c.env.DB
      .prepare(
        `SELECT SUM(amount) as total FROM expenses
         WHERE property_id = ? AND deleted_at IS NULL
           AND reference_month >= strftime('%Y-%m','now','-12 months')`
      )
      .bind(propertyId)
      .first<{ total: number }>(),
    c.env.DB
      .prepare(
        `SELECT SUM(cost) as total FROM service_orders
         WHERE property_id = ? AND deleted_at IS NULL AND cost IS NOT NULL`
      )
      .bind(propertyId)
      .first<{ total: number }>(),
    c.env.DB
      .prepare('SELECT COUNT(*) as count FROM inventory_items WHERE property_id = ? AND deleted_at IS NULL')
      .bind(propertyId)
      .first<{ count: number }>(),
    c.env.DB
      .prepare(
        `SELECT title, system_type, status, completed_at, cost
         FROM service_orders WHERE property_id = ? AND status IN ('completed','verified')
         AND deleted_at IS NULL ORDER BY completed_at DESC LIMIT 10`
      )
      .bind(propertyId)
      .all(),
  ]);

  return ok(c, {
    generated_at: new Date().toISOString(),
    property,
    health_score: score,
    health_label: score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 30 ? 'Atenção' : 'Crítico',
    health_breakdown: breakdown,
    services_summary: servicesSummary.results,
    expenses_total: expensesTotal?.total ?? 0,
    services_total: servicesTotal?.total ?? 0,
    maintenance_total: 0,
    inventory_items: inventoryCount?.count ?? 0,
    recent_services: recentServices.results,
  });
});

export { computeHealthScore };
export default reports;
