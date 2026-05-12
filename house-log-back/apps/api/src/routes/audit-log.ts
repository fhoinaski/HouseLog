import { Hono } from 'hono';
import { and, desc, eq, gte, isNotNull, lt, lte } from 'drizzle-orm';
import { isValidAuditDateParam, sanitizeAuditData } from '../lib/audit';
import { canViewAuditLog } from '../lib/authorization';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, resolveTenant } from '../middleware/auth';
import { getDb } from '../db/client';
import { auditLog as auditLogTable } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const auditLogRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

auditLogRoute.use('*', authMiddleware);
auditLogRoute.use('*', resolveTenant);

// ── GET /api/v1/audit-log ──────────────────────────────────────────────────────

auditLogRoute.get('/', async (c) => {
  const tenantId = c.get('tenantId') as string;
  const tenantRole = c.get('tenantRole');

  const decision = canViewAuditLog({ tenantId, tenantRole });
  if (!decision.allowed) {
    const message = decision.code === 'TENANT_REQUIRED' ? 'Tenant ativo obrigatorio' : 'Acesso negado';
    return err(c, message, decision.code, decision.status);
  }

  const db = getDb(c.env.DB);

  const rawLimit = Number(c.req.query('limit') ?? 50);
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : 50, 200);

  const cursor = c.req.query('cursor');
  const from = c.req.query('from');
  const to = c.req.query('to');

  if (cursor && !isValidAuditDateParam(cursor)) return err(c, 'cursor inválido', 'BAD_REQUEST', 400);
  if (from && !isValidAuditDateParam(from)) return err(c, 'from inválido', 'BAD_REQUEST', 400);
  if (to && !isValidAuditDateParam(to)) return err(c, 'to inválido', 'BAD_REQUEST', 400);

  const propertyId = c.req.query('property_id');
  const entityType = c.req.query('entity_type');
  const entityId = c.req.query('entity_id');
  const action = c.req.query('action');
  const actorId = c.req.query('actor_id');

  const filters = [
    eq(auditLogTable.tenantId, tenantId),
    isNotNull(auditLogTable.tenantId),
    ...(propertyId ? [eq(auditLogTable.propertyId, propertyId)] : []),
    ...(entityType ? [eq(auditLogTable.entityType, entityType)] : []),
    ...(entityId ? [eq(auditLogTable.entityId, entityId)] : []),
    ...(action ? [eq(auditLogTable.action, action)] : []),
    ...(actorId ? [eq(auditLogTable.actorId, actorId)] : []),
    ...(from ? [gte(auditLogTable.createdAt, from)] : []),
    ...(to ? [lte(auditLogTable.createdAt, to)] : []),
    ...(cursor ? [lt(auditLogTable.createdAt, cursor)] : []),
  ];

  const rows = await db
    .select({
      id: auditLogTable.id,
      tenant_id: auditLogTable.tenantId,
      property_id: auditLogTable.propertyId,
      entity_type: auditLogTable.entityType,
      entity_id: auditLogTable.entityId,
      action: auditLogTable.action,
      actor_id: auditLogTable.actorId,
      old_data: auditLogTable.oldData,
      new_data: auditLogTable.newData,
      created_at: auditLogTable.createdAt,
    })
    .from(auditLogTable)
    .where(and(...filters))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit + 1);

  const sanitized = rows.map((row) => ({
    ...row,
    old_data: sanitizeAuditData(row.old_data),
    new_data: sanitizeAuditData(row.new_data),
  }));

  return ok(c, paginate(sanitized, limit, 'created_at'));
});

export default auditLogRoute;
