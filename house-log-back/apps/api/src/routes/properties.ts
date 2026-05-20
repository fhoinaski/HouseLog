import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, requireRole, assertPropertyAccess, resolveTenant, assertTenantAccess } from '../middleware/auth';
import { listAccessiblePropertyIds } from '../lib/authorization';
import { canCreatePropertyInTenant } from '../lib/property-tenant';
import { buildR2Key, uploadToR2, preparePrivateUpload } from '../lib/r2';
import { getDb } from '../db/client';
import {
  documentExtractionCandidates,
  documentExtractionReviews,
  documentExtractions,
  documentIngestionJobs,
  documents as documentsTable,
  expenses,
  handoverPackages,
  inventoryItems,
  maintenanceSchedules,
  properties as propertiesTable,
  propertyCollaborators,
  rooms,
  serviceRequests,
  serviceOrders,
  users,
  warranties,
} from '../db/schema';
import type { Bindings, Variables, Property } from '../lib/types';
import { PropertyDocumentIngestionSummarySchema, propertyCreateSchema, propertyUpdateSchema } from '@houselog/contracts';
import { createId } from '../lib/id';

const properties = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// All routes require auth and an active tenant. Legacy rows with tenant_id=NULL
// are intentionally excluded here; migration 0014 backfills existing data and
// new property writes must never create tenantless records.
properties.use('*', authMiddleware);
properties.use('*', resolveTenant);

// ── Schemas ────────────────────────────────────────────────────────────────

const createSchema = propertyCreateSchema;
const updateSchema = propertyUpdateSchema;

function countValue(value: number | string | bigint | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type DashboardLastEvent = {
  type:
    | 'document_uploaded'
    | 'warranty_created'
    | 'service_request_opened'
    | 'service_order_created'
    | 'service_order_completed'
    | 'inventory_updated'
    | 'handover_issued'
    | 'handover_accepted';
  title: string;
  at: string;
  entity_type: 'document' | 'warranty' | 'service_request' | 'service_order' | 'inventory_item' | 'handover_package';
  entity_id: string;
  severity: 'neutral' | 'success' | 'warning' | 'critical';
};

type PreventiveAlertSeverity = 'info' | 'warning' | 'critical';

type PreventiveAlertType =
  | 'warranty_expiring'
  | 'warranty_expired'
  | 'maintenance_overdue'
  | 'stale_service_order'
  | 'missing_essential_documents'
  | 'handover_pending';

type PreventiveAlert = {
  id: string;
  type: PreventiveAlertType;
  severity: PreventiveAlertSeverity;
  title: string;
  description: string;
  entity_type: 'property' | 'warranty' | 'inventory_item' | 'maintenance_schedule' | 'service_order' | 'handover_package';
  entity_id: string | null;
  due_date: string | null;
  days_delta: number | null;
  action_href: string;
};

const ESSENTIAL_DOCUMENT_TYPES = ['deed', 'insurance', 'project', 'permit'] as const;
const ESSENTIAL_DOCUMENT_LABELS: Record<(typeof ESSENTIAL_DOCUMENT_TYPES)[number], string> = {
  deed: 'Escritura',
  insurance: 'Seguro',
  project: 'Projeto',
  permit: 'Licenca',
};

function latestDashboardEvent(events: Array<DashboardLastEvent | null>): DashboardLastEvent | null {
  return events
    .filter((event): event is DashboardLastEvent => Boolean(event))
    .sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

// ── GET /properties ─────────────────────────────────────────────────────────
// All users (including admin) only see properties they own, manage, or are
// collaborators on. Admins no longer have a blanket "see all" view.

properties.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const accessiblePropertyIds = await listAccessiblePropertyIds(c.env.DB, {
    userId,
    role,
    tenantId,
    tenantRole: c.get('tenantRole'),
  });
  if (accessiblePropertyIds.length === 0) return ok(c, paginate([], limit, 'created_at'));
  const cursor = c.req.query('cursor');
  const search = c.req.query('search');

  const filters: SQL[] = [
    eq(propertiesTable.tenantId, tenantId),
    isNull(propertiesTable.deletedAt),
    inArray(propertiesTable.id, accessiblePropertyIds),
  ];

  if (search) {
    const searchFilter = or(
      or(
        sql`${propertiesTable.name} LIKE ${`%${search}%`}`,
        sql`${propertiesTable.city} LIKE ${`%${search}%`}`
      )
    );
    if (searchFilter) filters.push(searchFilter);
  }

  if (cursor) filters.push(sql`${propertiesTable.createdAt} < ${cursor}`);

  const results = await db
    .select({
      id: propertiesTable.id,
      tenant_id: propertiesTable.tenantId,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
      owner_name: users.name,
      owner_email: users.email,
    })
    .from(propertiesTable)
    .innerJoin(users, eq(users.id, propertiesTable.ownerId))
    .where(and(...filters))
    .orderBy(desc(propertiesTable.createdAt))
    .limit(limit + 1) as Array<Property & { owner_name: string; owner_email: string }>;

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── POST /properties ────────────────────────────────────────────────────────

properties.post('/', requireRole('admin', 'owner'), async (c) => {
  const db = getDb(c.env.DB);
  const tenantId = c.get('tenantId');
  const createAccess = canCreatePropertyInTenant({
    activeTenantId: tenantId,
    userRole: c.get('userRole'),
    tenantRole: c.get('tenantRole'),
  });
  if (!createAccess.allowed) {
    const message = createAccess.code === 'TENANT_REQUIRED' ? 'Tenant ativo obrigatorio' : 'Sem permissao para criar imovel neste tenant';
    return err(c, message, createAccess.code, createAccess.status);
  }
  const activeTenantId = tenantId;
  if (!activeTenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const userId = c.get('userId');
  const role = c.get('userRole');
  const data = parsed.data;

  // Only admin can assign a different owner_id
  const ownerId = role === 'admin' && data.owner_id ? data.owner_id : userId;
  if (ownerId !== userId) {
    const ownerInTenant = await assertTenantAccess(c.env.DB, activeTenantId, ownerId, ['owner']);
    if (!ownerInTenant) return err(c, 'Owner informado nao pertence ao tenant ativo', 'FORBIDDEN', 403);
  }

  const id = createId();

  await db.insert(propertiesTable).values({
    id,
    tenantId: activeTenantId,
    ownerId,
    name: data.name,
    type: data.type,
    address: data.address,
    city: data.city,
    areaM2: data.area_m2 ?? null,
    yearBuilt: data.year_built ?? null,
    structure: data.structure ?? null,
    floors: data.floors,
  });

  const [property] = await db
    .select({
      id: propertiesTable.id,
      tenant_id: propertiesTable.tenantId,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, activeTenantId)))
    .limit(1) as Array<Property>;

  await writeAuditLog(c.env.DB, {
    tenantId: activeTenantId,
    propertyId: id,
    entityType: 'property',
    entityId: id,
    action: 'create',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: property,
  });

  return ok(c, { property }, 201);
});

// ── GET /properties/:id ──────────────────────────────────────────────────────

properties.get('/:id/ingestion-summary', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [tenantProperty] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imovel', 'FORBIDDEN', 403);

  const [documentCounts, jobRows, extractionCount, pendingReviewCount, candidateRows, latestJob] = await Promise.all([
    db
      .select({
        totalDocuments: sql<number>`COUNT(DISTINCT ${documentsTable.id})`,
        documentsWithIngestion: sql<number>`COUNT(DISTINCT CASE WHEN ${documentIngestionJobs.id} IS NOT NULL THEN ${documentsTable.id} END)`,
      })
      .from(documentsTable)
      .leftJoin(
        documentIngestionJobs,
        and(
          eq(documentIngestionJobs.tenantId, tenantId),
          eq(documentIngestionJobs.propertyId, id),
          eq(documentIngestionJobs.documentId, documentsTable.id)
        )
      )
      .where(and(
        eq(documentsTable.tenantId, tenantId),
        eq(documentsTable.propertyId, id),
        isNull(documentsTable.deletedAt)
      ))
      .then((rows) => rows[0] ?? { totalDocuments: 0, documentsWithIngestion: 0 }),
    db
      .select({
        status: documentIngestionJobs.status,
        total: sql<number>`COUNT(*)`,
      })
      .from(documentIngestionJobs)
      .innerJoin(
        documentsTable,
        and(
          eq(documentsTable.id, documentIngestionJobs.documentId),
          eq(documentsTable.tenantId, tenantId),
          eq(documentsTable.propertyId, id),
          isNull(documentsTable.deletedAt)
        )
      )
      .where(and(eq(documentIngestionJobs.tenantId, tenantId), eq(documentIngestionJobs.propertyId, id)))
      .groupBy(documentIngestionJobs.status),
    db
      .select({ total: sql<number>`COUNT(*)` })
      .from(documentExtractions)
      .innerJoin(
        documentsTable,
        and(
          eq(documentsTable.id, documentExtractions.documentId),
          eq(documentsTable.tenantId, tenantId),
          eq(documentsTable.propertyId, id),
          isNull(documentsTable.deletedAt)
        )
      )
      .where(and(eq(documentExtractions.tenantId, tenantId), eq(documentExtractions.propertyId, id)))
      .then((rows) => rows[0] ?? { total: 0 }),
    db
      .select({ total: sql<number>`COUNT(*)` })
      .from(documentExtractionReviews)
      .innerJoin(
        documentsTable,
        and(
          eq(documentsTable.id, documentExtractionReviews.documentId),
          eq(documentsTable.tenantId, tenantId),
          eq(documentsTable.propertyId, id),
          isNull(documentsTable.deletedAt)
        )
      )
      .where(and(
        eq(documentExtractionReviews.tenantId, tenantId),
        eq(documentExtractionReviews.propertyId, id),
        eq(documentExtractionReviews.status, 'pending')
      ))
      .then((rows) => rows[0] ?? { total: 0 }),
    db
      .select({
        status: documentExtractionCandidates.status,
        total: sql<number>`COUNT(*)`,
      })
      .from(documentExtractionCandidates)
      .innerJoin(
        documentsTable,
        and(
          eq(documentsTable.id, documentExtractionCandidates.documentId),
          eq(documentsTable.tenantId, tenantId),
          eq(documentsTable.propertyId, id),
          isNull(documentsTable.deletedAt)
        )
      )
      .where(and(eq(documentExtractionCandidates.tenantId, tenantId), eq(documentExtractionCandidates.propertyId, id)))
      .groupBy(documentExtractionCandidates.status),
    db
      .select({
        status: documentIngestionJobs.status,
        createdAt: documentIngestionJobs.createdAt,
      })
      .from(documentIngestionJobs)
      .innerJoin(
        documentsTable,
        and(
          eq(documentsTable.id, documentIngestionJobs.documentId),
          eq(documentsTable.tenantId, tenantId),
          eq(documentsTable.propertyId, id),
          isNull(documentsTable.deletedAt)
        )
      )
      .where(and(eq(documentIngestionJobs.tenantId, tenantId), eq(documentIngestionJobs.propertyId, id)))
      .orderBy(desc(documentIngestionJobs.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const jobTotals: Partial<Record<string, number>> = {};
  for (const row of jobRows) {
    jobTotals[row.status] = countValue(row.total);
  }

  const candidateTotals: Partial<Record<string, number>> = {};
  for (const row of candidateRows) {
    candidateTotals[row.status] = countValue(row.total);
  }
  const summary = PropertyDocumentIngestionSummarySchema.parse({
    totalDocuments: countValue(documentCounts.totalDocuments),
    documentsWithIngestion: countValue(documentCounts.documentsWithIngestion),
    totalJobs: jobRows.reduce((total, row) => total + countValue(row.total), 0),
    processingJobs: countValue(jobTotals.queued) + countValue(jobTotals.processing),
    failedJobs: countValue(jobTotals.failed),
    needsReviewJobs: countValue(jobTotals.needs_review),
    totalExtractions: countValue(extractionCount.total),
    pendingExtractionReviews: countValue(pendingReviewCount.total),
    totalCandidates: candidateRows.reduce((total, row) => total + countValue(row.total), 0),
    pendingCandidates: countValue(candidateTotals.pending),
    approvedCandidates: countValue(candidateTotals.approved),
    rejectedCandidates: countValue(candidateTotals.rejected),
    appliedCandidates: countValue(candidateTotals.applied),
    lastIngestionAt: latestJob?.createdAt ?? null,
    latestStatus: latestJob?.status ?? null,
  });

  return ok(c, { summary });
});

properties.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [property] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
      owner_name: users.name,
    })
    .from(propertiesTable)
    .innerJoin(users, eq(users.id, propertiesTable.ownerId))
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1) as Array<Property & { owner_name: string }>;

  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  return ok(c, { property });
});

// ── PUT /properties/:id ──────────────────────────────────────────────────────

properties.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [tenantProperty] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const [old] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1) as Array<Property>;

  if (!old) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const data = parsed.data;
  const updateData: Partial<typeof propertiesTable.$inferInsert> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.area_m2 !== undefined) updateData.areaM2 = data.area_m2;
  if (data.year_built !== undefined) updateData.yearBuilt = data.year_built;
  if (data.structure !== undefined) updateData.structure = data.structure ?? null;
  if (data.floors !== undefined) updateData.floors = data.floors;
  if (data.cover_url !== undefined) updateData.coverUrl = data.cover_url ?? null;

  if (Object.keys(updateData).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db.update(propertiesTable).set(updateData).where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId)));

  const [updated] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId)))
    .limit(1) as Array<Property>;

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId: id,
    entityType: 'property',
    entityId: id,
    action: 'update',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: updated,
  });

  return ok(c, { property: updated });
});

// ── DELETE /properties/:id (soft-delete) ─────────────────────────────────────

properties.delete('/:id', requireRole('admin', 'owner'), async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [tenantProperty] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: propertiesTable.id,
      owner_id: propertiesTable.ownerId,
      manager_id: propertiesTable.managerId,
      name: propertiesTable.name,
      type: propertiesTable.type,
      address: propertiesTable.address,
      city: propertiesTable.city,
      area_m2: propertiesTable.areaM2,
      year_built: propertiesTable.yearBuilt,
      structure: propertiesTable.structure,
      floors: propertiesTable.floors,
      cover_url: propertiesTable.coverUrl,
      health_score: propertiesTable.healthScore,
      created_at: propertiesTable.createdAt,
      deleted_at: propertiesTable.deletedAt,
    })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1) as Array<Property>;

  if (!old) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  await db
    .update(propertiesTable)
    .set({ deletedAt: sql`datetime('now')` })
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId: id,
    entityType: 'property',
    entityId: id,
    action: 'delete',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

// ── POST /properties/:id/cover ───────────────────────────────────────────────

properties.post('/:id/cover', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [tenantProperty] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const validation = await preparePrivateUpload(file);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId: id, category: 'photos', filename: `cover.${file.name.split('.').pop()}` });
  await uploadToR2(c.env.STORAGE, key, validation.buffer, validation.mimeType);

  const coverUrl = `/api/v1/properties/${id}/media/${encodeURIComponent(key)}`;

  await db.update(propertiesTable).set({ coverUrl }).where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId: id,
    entityType: 'property', entityId: id, action: 'cover_upload',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: { cover_url: coverUrl },
  });

  return ok(c, { cover_url: coverUrl });
});

// ── GET /properties/:id/dashboard ────────────────────────────────────────────

properties.get('/:id/media/*', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imovel', 'FORBIDDEN', 403);

  const key = decodeURIComponent(c.req.path.split(`/properties/${id}/media/`)[1] ?? '');
  // Block path traversal and enforce that the key belongs to this property (prefix check)
  if (!key || key.includes('..') || !key.startsWith(`${id}/`)) {
    return err(c, 'Arquivo nao encontrado', 'NOT_FOUND', 404);
  }

  const [property] = await db
    .select({ coverUrl: propertiesTable.coverUrl })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);

  if (!property || property.coverUrl !== `/api/v1/properties/${id}/media/${encodeURIComponent(key)}`) {
    return err(c, 'Arquivo nao encontrado', 'NOT_FOUND', 404);
  }

  const object = await c.env.STORAGE.get(key);
  if (!object) return err(c, 'Arquivo nao encontrado', 'STORAGE_ERROR', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=60');

  return new Response(object.body, { headers });
});

properties.get('/:id/dashboard', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [tenantProperty] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const [exp, svc, inv, maint, prop, docs, docJobs, warrantySummary, handoverSummary] = await Promise.all([
    db
      .select({
        total: sql<number>`SUM(${expenses.amount})`,
        this_month: sql<number>`SUM(CASE WHEN ${expenses.referenceMonth} = strftime('%Y-%m', 'now') THEN ${expenses.amount} ELSE 0 END)`,
      })
      .from(expenses)
      .where(and(eq(expenses.tenantId, tenantId), eq(expenses.propertyId, id), isNull(expenses.deletedAt)))
      .then((r) => r[0] ?? { total: 0, this_month: 0 }),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        requested: sql<number>`SUM(CASE WHEN ${serviceOrders.status} = 'requested' THEN 1 ELSE 0 END)`,
        in_progress: sql<number>`SUM(CASE WHEN ${serviceOrders.status} = 'in_progress' THEN 1 ELSE 0 END)`,
        done: sql<number>`SUM(CASE WHEN ${serviceOrders.status} IN ('completed','verified') THEN 1 ELSE 0 END)`,
        urgent_open: sql<number>`SUM(CASE WHEN ${serviceOrders.priority} = 'urgent' AND ${serviceOrders.status} NOT IN ('completed','verified') THEN 1 ELSE 0 END)`,
      })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.propertyId, id), isNull(serviceOrders.deletedAt)))
      .then((r) => r[0] ?? { total: 0, requested: 0, in_progress: 0, done: 0, urgent_open: 0 }),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        low_stock: sql<number>`SUM(CASE WHEN ${inventoryItems.quantity} <= ${inventoryItems.reserveQty} THEN 1 ELSE 0 END)`,
      })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.propertyId, id), isNull(inventoryItems.deletedAt)))
      .then((r) => r[0] ?? { total: 0, low_stock: 0 }),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        overdue: sql<number>`SUM(CASE WHEN ${maintenanceSchedules.nextDue} < date('now') THEN 1 ELSE 0 END)`,
        due_soon: sql<number>`SUM(CASE WHEN ${maintenanceSchedules.nextDue} >= date('now') AND ${maintenanceSchedules.nextDue} <= date('now', '+30 days') THEN 1 ELSE 0 END)`,
      })
      .from(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, id), isNull(maintenanceSchedules.deletedAt)))
      .then((r) => r[0] ?? { total: 0, overdue: 0, due_soon: 0 }),
    db
      .select({ health_score: propertiesTable.healthScore })
      .from(propertiesTable)
      .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
      .limit(1)
      .then((r) => r[0]),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        expired: sql<number>`SUM(CASE WHEN ${documentsTable.expiryDate} IS NOT NULL AND ${documentsTable.expiryDate} < date('now') THEN 1 ELSE 0 END)`,
        expiring_soon: sql<number>`SUM(CASE WHEN ${documentsTable.expiryDate} IS NOT NULL AND ${documentsTable.expiryDate} >= date('now') AND ${documentsTable.expiryDate} <= date('now', '+30 days') THEN 1 ELSE 0 END)`,
      })
      .from(documentsTable)
      .where(and(eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, id), isNull(documentsTable.deletedAt)))
      .then((r) => r[0] ?? { total: 0, expired: 0, expiring_soon: 0 }),
    db
      .select({
        pending_review: sql<number>`SUM(CASE WHEN ${documentIngestionJobs.status} = 'needs_review' THEN 1 ELSE 0 END)`,
        failed_processing: sql<number>`SUM(CASE WHEN ${documentIngestionJobs.status} = 'failed' THEN 1 ELSE 0 END)`,
      })
      .from(documentIngestionJobs)
      .where(and(eq(documentIngestionJobs.tenantId, tenantId), eq(documentIngestionJobs.propertyId, id)))
      .then((r) => r[0] ?? { pending_review: 0, failed_processing: 0 }),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        active: sql<number>`SUM(CASE WHEN ${warranties.status} = 'active' THEN 1 ELSE 0 END)`,
        expired: sql<number>`SUM(CASE WHEN ${warranties.status} = 'expired' OR ${warranties.endDate} < date('now') THEN 1 ELSE 0 END)`,
        expiring_soon: sql<number>`SUM(CASE WHEN ${warranties.status} = 'active' AND ${warranties.endDate} >= date('now') AND ${warranties.endDate} <= date('now', '+30 days') THEN 1 ELSE 0 END)`,
      })
      .from(warranties)
      .where(and(eq(warranties.tenantId, tenantId), eq(warranties.propertyId, id), isNull(warranties.deletedAt)))
      .then((r) => r[0] ?? { total: 0, active: 0, expired: 0, expiring_soon: 0 }),
    db
      .select({
        total: sql<number>`COUNT(*)`,
        issued: sql<number>`SUM(CASE WHEN ${handoverPackages.status} IN ('issued','accepted') THEN 1 ELSE 0 END)`,
        accepted: sql<number>`SUM(CASE WHEN ${handoverPackages.status} = 'accepted' THEN 1 ELSE 0 END)`,
      })
      .from(handoverPackages)
      .where(and(eq(handoverPackages.tenantId, tenantId), eq(handoverPackages.propertyId, id), isNull(handoverPackages.deletedAt)))
      .then((r) => r[0] ?? { total: 0, issued: 0, accepted: 0 }),
  ]);

  // Monthly expenses for chart (last 6 months)
  const monthlyExpenses = await db
    .select({
      reference_month: expenses.referenceMonth,
      total: sql<number>`SUM(${expenses.amount})`,
      category: expenses.category,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.propertyId, id),
        eq(expenses.tenantId, tenantId),
        isNull(expenses.deletedAt),
        eq(expenses.type, 'expense'),
        gte(expenses.referenceMonth, sql`strftime('%Y-%m', 'now', '-5 months')`)
      )
    )
    .groupBy(expenses.referenceMonth, expenses.category)
    .orderBy(asc(expenses.referenceMonth)) as Array<{ reference_month: string; total: number; category: string }>;

  // Warranties expiring within 30 days
  const [
    inventoryWarrantiesExpiring,
    propertyWarrantiesExpiring,
    inventoryWarrantiesExpired,
    propertyWarrantiesExpired,
    overdueMaintenanceAlerts,
    staleServiceOrderAlerts,
    existingEssentialDocumentTypes,
    latestDocument,
    latestServiceOrder,
    latestServiceRequest,
    latestWarranty,
    latestInventoryItem,
    latestHandover,
  ] = await Promise.all([
    db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        warranty_until: inventoryItems.warrantyUntil,
        days_left: sql<number>`CAST(julianday(${inventoryItems.warrantyUntil}) - julianday('now') AS INTEGER)`,
        source: sql<'inventory'>`'inventory'`,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.propertyId, id),
          eq(inventoryItems.tenantId, tenantId),
          isNull(inventoryItems.deletedAt),
          isNotNull(inventoryItems.warrantyUntil),
          lte(sql`julianday(${inventoryItems.warrantyUntil}) - julianday('now')`, 30),
          gte(sql`julianday(${inventoryItems.warrantyUntil}) - julianday('now')`, 0)
        )
      )
      .orderBy(asc(inventoryItems.warrantyUntil))
      .limit(10) as Promise<Array<{ id: string; name: string; warranty_until: string; days_left: number; source: 'inventory' }>>,
    db
      .select({
        id: warranties.id,
        name: warranties.title,
        warranty_until: warranties.endDate,
        days_left: sql<number>`CAST(julianday(${warranties.endDate}) - julianday('now') AS INTEGER)`,
        source: sql<'warranty'>`'warranty'`,
      })
      .from(warranties)
      .where(
        and(
          eq(warranties.propertyId, id),
          eq(warranties.tenantId, tenantId),
          isNull(warranties.deletedAt),
          eq(warranties.status, 'active'),
          lte(sql`julianday(${warranties.endDate}) - julianday('now')`, 30),
          gte(sql`julianday(${warranties.endDate}) - julianday('now')`, 0)
        )
      )
      .orderBy(asc(warranties.endDate))
      .limit(10) as Promise<Array<{ id: string; name: string; warranty_until: string; days_left: number; source: 'warranty' }>>,
    db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        warranty_until: inventoryItems.warrantyUntil,
        days_overdue: sql<number>`CAST(julianday('now') - julianday(${inventoryItems.warrantyUntil}) AS INTEGER)`,
        source: sql<'inventory'>`'inventory'`,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.propertyId, id),
          eq(inventoryItems.tenantId, tenantId),
          isNull(inventoryItems.deletedAt),
          isNotNull(inventoryItems.warrantyUntil),
          lte(inventoryItems.warrantyUntil, sql`date('now', '-1 day')`)
        )
      )
      .orderBy(asc(inventoryItems.warrantyUntil))
      .limit(10) as Promise<Array<{ id: string; name: string; warranty_until: string; days_overdue: number; source: 'inventory' }>>,
    db
      .select({
        id: warranties.id,
        name: warranties.title,
        warranty_until: warranties.endDate,
        days_overdue: sql<number>`CAST(julianday('now') - julianday(${warranties.endDate}) AS INTEGER)`,
        source: sql<'warranty'>`'warranty'`,
      })
      .from(warranties)
      .where(
        and(
          eq(warranties.propertyId, id),
          eq(warranties.tenantId, tenantId),
          isNull(warranties.deletedAt),
          or(eq(warranties.status, 'expired'), lte(warranties.endDate, sql`date('now', '-1 day')`))
        )
      )
      .orderBy(asc(warranties.endDate))
      .limit(10) as Promise<Array<{ id: string; name: string; warranty_until: string; days_overdue: number; source: 'warranty' }>>,
    db
      .select({
        id: maintenanceSchedules.id,
        title: maintenanceSchedules.title,
        next_due: maintenanceSchedules.nextDue,
        days_overdue: sql<number>`CAST(julianday('now') - julianday(${maintenanceSchedules.nextDue}) AS INTEGER)`,
      })
      .from(maintenanceSchedules)
      .where(
        and(
          eq(maintenanceSchedules.propertyId, id),
          eq(maintenanceSchedules.tenantId, tenantId),
          isNull(maintenanceSchedules.deletedAt),
          isNotNull(maintenanceSchedules.nextDue),
          lte(maintenanceSchedules.nextDue, sql`date('now', '-1 day')`)
        )
      )
      .orderBy(asc(maintenanceSchedules.nextDue))
      .limit(10) as Promise<Array<{ id: string; title: string; next_due: string; days_overdue: number }>>,
    db
      .select({
        id: serviceOrders.id,
        title: serviceOrders.title,
        status: serviceOrders.status,
        created_at: serviceOrders.createdAt,
        days_open: sql<number>`CAST(julianday('now') - julianday(${serviceOrders.createdAt}) AS INTEGER)`,
      })
      .from(serviceOrders)
      .where(
        and(
          eq(serviceOrders.propertyId, id),
          eq(serviceOrders.tenantId, tenantId),
          isNull(serviceOrders.deletedAt),
          inArray(serviceOrders.status, ['requested', 'approved', 'in_progress']),
          lte(serviceOrders.createdAt, sql`datetime('now', '-14 days')`)
        )
      )
      .orderBy(asc(serviceOrders.createdAt))
      .limit(10) as Promise<Array<{ id: string; title: string; status: string; created_at: string; days_open: number }>>,
    db
      .select({ type: documentsTable.type })
      .from(documentsTable)
      .where(
        and(
          eq(documentsTable.propertyId, id),
          eq(documentsTable.tenantId, tenantId),
          isNull(documentsTable.deletedAt),
          inArray(documentsTable.type, ESSENTIAL_DOCUMENT_TYPES)
        )
      ) as Promise<Array<{ type: (typeof ESSENTIAL_DOCUMENT_TYPES)[number] }>>,
    db
      .select({ id: documentsTable.id, title: documentsTable.title, created_at: documentsTable.createdAt })
      .from(documentsTable)
      .where(and(eq(documentsTable.propertyId, id), eq(documentsTable.tenantId, tenantId), isNull(documentsTable.deletedAt)))
      .orderBy(desc(documentsTable.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        id: serviceOrders.id,
        title: serviceOrders.title,
        status: serviceOrders.status,
        priority: serviceOrders.priority,
        created_at: serviceOrders.createdAt,
        completed_at: serviceOrders.completedAt,
      })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.propertyId, id), eq(serviceOrders.tenantId, tenantId), isNull(serviceOrders.deletedAt)))
      .orderBy(desc(sql`COALESCE(${serviceOrders.completedAt}, ${serviceOrders.createdAt})`))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({ id: serviceRequests.id, title: serviceRequests.title, status: serviceRequests.status, created_at: serviceRequests.createdAt })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.propertyId, id), eq(serviceRequests.tenantId, tenantId)))
      .orderBy(desc(serviceRequests.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({ id: warranties.id, title: warranties.title, status: warranties.status, created_at: warranties.createdAt })
      .from(warranties)
      .where(and(eq(warranties.propertyId, id), eq(warranties.tenantId, tenantId), isNull(warranties.deletedAt)))
      .orderBy(desc(warranties.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({ id: inventoryItems.id, name: inventoryItems.name, created_at: inventoryItems.createdAt })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.propertyId, id), eq(inventoryItems.tenantId, tenantId), isNull(inventoryItems.deletedAt)))
      .orderBy(desc(inventoryItems.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        id: handoverPackages.id,
        title: handoverPackages.title,
        status: handoverPackages.status,
        issued_at: handoverPackages.issuedAt,
        accepted_at: handoverPackages.acceptedAt,
        created_at: handoverPackages.createdAt,
      })
      .from(handoverPackages)
      .where(and(eq(handoverPackages.propertyId, id), eq(handoverPackages.tenantId, tenantId), isNull(handoverPackages.deletedAt)))
      .orderBy(desc(sql`COALESCE(${handoverPackages.acceptedAt}, ${handoverPackages.issuedAt}, ${handoverPackages.createdAt})`))
      .limit(1)
      .then((r) => r[0] ?? null),
  ]);

  const warrantiesExpiring = [...inventoryWarrantiesExpiring, ...propertyWarrantiesExpiring]
    .sort((a, b) => a.days_left - b.days_left)
    .slice(0, 10);

  const lastEvent = latestDashboardEvent([
    latestDocument ? {
      type: 'document_uploaded',
      title: latestDocument.title,
      at: latestDocument.created_at,
      entity_type: 'document',
      entity_id: latestDocument.id,
      severity: 'neutral',
    } : null,
    latestServiceOrder ? {
      type: latestServiceOrder.status === 'completed' || latestServiceOrder.status === 'verified' ? 'service_order_completed' : 'service_order_created',
      title: latestServiceOrder.title,
      at: latestServiceOrder.completed_at ?? latestServiceOrder.created_at,
      entity_type: 'service_order',
      entity_id: latestServiceOrder.id,
      severity: latestServiceOrder.priority === 'urgent' && latestServiceOrder.status !== 'completed' && latestServiceOrder.status !== 'verified' ? 'critical' : 'neutral',
    } : null,
    latestServiceRequest ? {
      type: 'service_request_opened',
      title: latestServiceRequest.title,
      at: latestServiceRequest.created_at,
      entity_type: 'service_request',
      entity_id: latestServiceRequest.id,
      severity: latestServiceRequest.status === 'OPEN' ? 'warning' : 'neutral',
    } : null,
    latestWarranty ? {
      type: 'warranty_created',
      title: latestWarranty.title,
      at: latestWarranty.created_at,
      entity_type: 'warranty',
      entity_id: latestWarranty.id,
      severity: latestWarranty.status === 'expired' || latestWarranty.status === 'void' ? 'warning' : 'neutral',
    } : null,
    latestInventoryItem ? {
      type: 'inventory_updated',
      title: latestInventoryItem.name,
      at: latestInventoryItem.created_at,
      entity_type: 'inventory_item',
      entity_id: latestInventoryItem.id,
      severity: 'neutral',
    } : null,
    latestHandover ? {
      type: latestHandover.status === 'accepted' ? 'handover_accepted' : 'handover_issued',
      title: latestHandover.title,
      at: latestHandover.accepted_at ?? latestHandover.issued_at ?? latestHandover.created_at,
      entity_type: 'handover_package',
      entity_id: latestHandover.id,
      severity: latestHandover.status === 'accepted' ? 'success' : 'neutral',
    } : null,
  ]);

  const preventiveAlerts: PreventiveAlert[] = [];
  const warrantiesHref = `/properties/${id}?tab=warranties`;
  const inventoryHref = `/properties/${id}?tab=inventory`;
  const maintenanceHref = `/properties/${id}/maintenance`;
  const servicesHref = `/properties/${id}?tab=services`;
  const documentsHref = `/properties/${id}?tab=documents`;
  const handoverHref = `/properties/${id}?tab=handover`;

  for (const warranty of propertyWarrantiesExpired) {
    preventiveAlerts.push({
      id: `warranty-expired-${warranty.id}`,
      type: 'warranty_expired',
      severity: 'critical',
      title: 'Garantia vencida',
      description: `${warranty.name} venceu ha ${Math.max(1, countValue(warranty.days_overdue))} dia(s).`,
      entity_type: 'warranty',
      entity_id: warranty.id,
      due_date: warranty.warranty_until,
      days_delta: -Math.max(1, countValue(warranty.days_overdue)),
      action_href: warrantiesHref,
    });
  }

  for (const warranty of inventoryWarrantiesExpired) {
    preventiveAlerts.push({
      id: `inventory-warranty-expired-${warranty.id}`,
      type: 'warranty_expired',
      severity: 'critical',
      title: 'Garantia de item vencida',
      description: `${warranty.name} venceu ha ${Math.max(1, countValue(warranty.days_overdue))} dia(s).`,
      entity_type: 'inventory_item',
      entity_id: warranty.id,
      due_date: warranty.warranty_until,
      days_delta: -Math.max(1, countValue(warranty.days_overdue)),
      action_href: inventoryHref,
    });
  }

  for (const warranty of warrantiesExpiring) {
    preventiveAlerts.push({
      id: `warranty-expiring-${warranty.source}-${warranty.id}`,
      type: 'warranty_expiring',
      severity: warranty.days_left <= 7 ? 'warning' : 'info',
      title: warranty.days_left === 0 ? 'Garantia vence hoje' : 'Garantia vence em 30 dias',
      description: `${warranty.name} vence ${warranty.days_left === 0 ? 'hoje' : `em ${warranty.days_left} dia(s)`}.`,
      entity_type: warranty.source === 'inventory' ? 'inventory_item' : 'warranty',
      entity_id: warranty.id,
      due_date: warranty.warranty_until,
      days_delta: warranty.days_left,
      action_href: warranty.source === 'inventory' ? inventoryHref : warrantiesHref,
    });
  }

  for (const schedule of overdueMaintenanceAlerts) {
    preventiveAlerts.push({
      id: `maintenance-overdue-${schedule.id}`,
      type: 'maintenance_overdue',
      severity: 'critical',
      title: 'Manutencao preventiva atrasada',
      description: `${schedule.title} esta atrasada ha ${Math.max(1, countValue(schedule.days_overdue))} dia(s).`,
      entity_type: 'maintenance_schedule',
      entity_id: schedule.id,
      due_date: schedule.next_due,
      days_delta: -Math.max(1, countValue(schedule.days_overdue)),
      action_href: maintenanceHref,
    });
  }

  for (const order of staleServiceOrderAlerts) {
    preventiveAlerts.push({
      id: `stale-service-order-${order.id}`,
      type: 'stale_service_order',
      severity: order.days_open >= 30 ? 'critical' : 'warning',
      title: 'OS aberta ha muitos dias',
      description: `${order.title} esta aberta ha ${Math.max(14, countValue(order.days_open))} dia(s).`,
      entity_type: 'service_order',
      entity_id: order.id,
      due_date: order.created_at,
      days_delta: Math.max(14, countValue(order.days_open)),
      action_href: `/properties/${id}/services/${order.id}`,
    });
  }

  const existingEssentialTypes = new Set(existingEssentialDocumentTypes.map((document) => document.type));
  const missingEssentialTypes = ESSENTIAL_DOCUMENT_TYPES.filter((type) => !existingEssentialTypes.has(type));
  if (missingEssentialTypes.length > 0) {
    preventiveAlerts.push({
      id: `missing-essential-documents-${id}`,
      type: 'missing_essential_documents',
      severity: missingEssentialTypes.length >= ESSENTIAL_DOCUMENT_TYPES.length ? 'warning' : 'info',
      title: 'Imovel sem documentos essenciais',
      description: `Pendentes: ${missingEssentialTypes.map((type) => ESSENTIAL_DOCUMENT_LABELS[type]).join(', ')}.`,
      entity_type: 'property',
      entity_id: id,
      due_date: null,
      days_delta: null,
      action_href: documentsHref,
    });
  }

  if (countValue(handoverSummary.accepted) === 0) {
    preventiveAlerts.push({
      id: latestHandover ? `handover-pending-${latestHandover.id}` : `handover-pending-${id}`,
      type: 'handover_pending',
      severity: countValue(handoverSummary.total) > 0 ? 'warning' : 'info',
      title: 'Handover pendente',
      description: countValue(handoverSummary.total) > 0
        ? 'Existe pacote de handover sem aceite final.'
        : 'Nenhum pacote de handover foi aceito para este imovel.',
      entity_type: latestHandover ? 'handover_package' : 'property',
      entity_id: latestHandover?.id ?? id,
      due_date: latestHandover?.issued_at ?? latestHandover?.created_at ?? null,
      days_delta: null,
      action_href: handoverHref,
    });
  }

  preventiveAlerts.sort((a, b) => {
    const severityOrder: Record<PreventiveAlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return a.title.localeCompare(b.title);
  });

  return ok(c, {
    health_score: prop?.health_score ?? 50,
    expenses: {
      total: countValue(exp.total),
      this_month: countValue(exp.this_month),
    },
    services: {
      total: countValue(svc.total),
      requested: countValue(svc.requested),
      in_progress: countValue(svc.in_progress),
      done: countValue(svc.done),
      urgent_open: countValue(svc.urgent_open),
    },
    inventory: {
      total: countValue(inv.total),
      low_stock: countValue(inv.low_stock),
    },
    maintenance: {
      total: countValue(maint.total),
      overdue: countValue(maint.overdue),
      due_soon: countValue(maint.due_soon),
    },
    documents: {
      total: countValue(docs.total),
      pending_review: countValue(docJobs.pending_review),
      failed_processing: countValue(docJobs.failed_processing),
      expiring_soon: countValue(docs.expiring_soon),
      expired: countValue(docs.expired),
    },
    warranties: {
      total: countValue(warrantySummary.total),
      active: countValue(warrantySummary.active),
      expiring_soon: countValue(warrantySummary.expiring_soon) + inventoryWarrantiesExpiring.length,
      expired: countValue(warrantySummary.expired),
    },
    handover: {
      total: countValue(handoverSummary.total),
      issued: countValue(handoverSummary.issued),
      accepted: countValue(handoverSummary.accepted),
      dossier_status: countValue(handoverSummary.issued) > 0 ? 'issued' : 'pending',
    },
    last_event: lastEvent,
    monthly_expenses: monthlyExpenses,
    warranties_expiring: warrantiesExpiring,
    preventive_alerts: preventiveAlerts.slice(0, 30),
  });
});

// ── GET /properties/:id/providers ────────────────────────────────────────────
// Returns collaborators with role='provider' — used to populate the OS assignment dropdown.

properties.get('/:id/providers', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [tenantProperty] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .select({
      collab_id: propertyCollaborators.id,
      user_id: propertyCollaborators.userId,
      role: propertyCollaborators.role,
      can_open_os: propertyCollaborators.canOpenOs,
      specialties: propertyCollaborators.specialties,
      whatsapp: propertyCollaborators.whatsapp,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatar_url: users.avatarUrl,
    })
    .from(propertyCollaborators)
    .innerJoin(users, eq(users.id, propertyCollaborators.userId))
    .where(
      and(
        eq(propertyCollaborators.tenantId, tenantId),
        eq(propertyCollaborators.propertyId, id),
        eq(propertyCollaborators.role, 'provider')
      )
    )
    .orderBy(asc(users.name)) as Array<{
    collab_id: string; user_id: string; role: string; can_open_os: number;
    specialties: string | null; whatsapp: string | null;
    name: string; email: string; phone: string | null; avatar_url: string | null;
  }>;

  return ok(c, { providers: results });
});

// ── POST /properties/:id/apply-template ──────────────────────────────────────

const templateSchema = z.object({
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
});

const TEMPLATES: Record<string, {
  rooms: { name: string; type: string; floor: number }[];
  maintenance: { title: string; system_type: string; frequency: string; description?: string }[];
}> = {
  house: {
    rooms: [
      { name: 'Sala de Estar', type: 'living', floor: 0 },
      { name: 'Cozinha', type: 'kitchen', floor: 0 },
      { name: 'Quarto Principal', type: 'bedroom', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
      { name: 'Garagem', type: 'garage', floor: 0 },
      { name: 'Área de Serviço', type: 'laundry', floor: 0 },
    ],
    maintenance: [
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Limpeza de Calhas', system_type: 'Calhas', frequency: 'semiannual', description: 'Limpeza e desobstrução de calhas' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico e fiações' },
      { title: 'Revisão Hidráulica', system_type: 'Hidráulica', frequency: 'annual', description: 'Inspeção de encanamentos e válvulas' },
    ],
  },
  apt: {
    rooms: [
      { name: 'Sala', type: 'living', floor: 0 },
      { name: 'Cozinha', type: 'kitchen', floor: 0 },
      { name: 'Quarto Principal', type: 'bedroom', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
    ],
    maintenance: [
      { title: 'Manutenção Ar-Condicionado', system_type: 'Climatização', frequency: 'semiannual', description: 'Limpeza de filtros e revisão do sistema' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico e tomadas' },
    ],
  },
  commercial: {
    rooms: [
      { name: 'Recepção', type: 'living', floor: 0 },
      { name: 'Escritório', type: 'other', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
      { name: 'Copa', type: 'kitchen', floor: 0 },
    ],
    maintenance: [
      { title: 'Manutenção Ar-Condicionado', system_type: 'Climatização', frequency: 'quarterly', description: 'Limpeza de filtros e revisão do sistema' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e insetos' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico' },
    ],
  },
  warehouse: {
    rooms: [
      { name: 'Área de Carga', type: 'other', floor: 0 },
      { name: 'Escritório', type: 'other', floor: 0 },
      { name: 'Banheiro', type: 'bathroom', floor: 0 },
    ],
    maintenance: [
      { title: 'Revisão Estrutural', system_type: 'Estrutura', frequency: 'annual', description: 'Inspeção de telhado, piso e estrutura' },
      { title: 'Dedetização', system_type: 'Pragas', frequency: 'annual', description: 'Controle de pragas e roedores' },
      { title: 'Revisão Elétrica', system_type: 'Elétrica', frequency: 'annual', description: 'Verificação de quadro elétrico industrial' },
    ],
  },
};

properties.post('/:id/apply-template', async (c) => {
  const db = getDb(c.env.DB);
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const [tenantProperty] = await db
    .select({ id: propertiesTable.id })
    .from(propertiesTable)
    .where(and(eq(propertiesTable.id, id), eq(propertiesTable.tenantId, tenantId), isNull(propertiesTable.deletedAt)))
    .limit(1);
  if (!tenantProperty) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, id, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = templateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Template inválido', 'VALIDATION_ERROR', 422);

  const template = TEMPLATES[parsed.data.type];
  if (!template) return err(c, 'Template inválido', 'VALIDATION_ERROR', 422);

  function calcNextDue(freq: string): string {
    const days: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90, semiannual: 180, annual: 365 };
    const d = new Date();
    d.setDate(d.getDate() + (days[freq] ?? 365));
    return d.toISOString().slice(0, 10);
  }

  await Promise.all([
    ...template.rooms.map((r) =>
      db
        .insert(rooms)
        .values({ id: createId(), tenantId, propertyId: id, name: r.name, type: r.type as never, floor: r.floor })
        .onConflictDoNothing()
    ),
    ...template.maintenance.map((m) =>
      db.insert(maintenanceSchedules).values({
        id: createId(),
        tenantId,
        propertyId: id,
        systemType: m.system_type,
        title: m.title,
        description: m.description ?? null,
        frequency: m.frequency as never,
        nextDue: calcNextDue(m.frequency),
        autoCreateOs: 0,
      })
    ),
  ]);

  return ok(c, { created: { rooms: template.rooms.length, maintenance: template.maintenance.length } }, 201);
});

export default properties;
