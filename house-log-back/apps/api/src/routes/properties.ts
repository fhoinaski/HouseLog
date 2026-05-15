import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, requireRole, assertPropertyAccess, resolveTenant, assertTenantAccess } from '../middleware/auth';
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
  inventoryItems,
  maintenanceSchedules,
  properties as propertiesTable,
  propertyCollaborators,
  rooms,
  serviceOrders,
  users,
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

// ── GET /properties ─────────────────────────────────────────────────────────
// All users (including admin) only see properties they own, manage, or are
// collaborators on. Admins no longer have a blanket "see all" view.

properties.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const search = c.req.query('search');

  const filters = [
    eq(propertiesTable.tenantId, tenantId),
    isNull(propertiesTable.deletedAt),
    or(
      eq(propertiesTable.ownerId, userId),
      eq(propertiesTable.managerId, userId),
      sql`EXISTS (
        SELECT 1 FROM property_collaborators pc
        WHERE pc.property_id = ${propertiesTable.id}
          AND pc.tenant_id = ${tenantId}
          AND pc.user_id = ${userId}
      )`
    ),
  ];

  if (search) {
    filters.push(
      or(
        sql`${propertiesTable.name} LIKE ${`%${search}%`}`,
        sql`${propertiesTable.city} LIKE ${`%${search}%`}`
      )
    );
  }

  if (cursor) filters.push(sql`${propertiesTable.createdAt} < ${cursor}`);

  const results = await db
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

  const [exp, svc, inv, maint, prop] = await Promise.all([
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
  const warrantiesExpiring = await db
    .select({
      id: inventoryItems.id,
      name: inventoryItems.name,
      warranty_until: inventoryItems.warrantyUntil,
      days_left: sql<number>`CAST(julianday(${inventoryItems.warrantyUntil}) - julianday('now') AS INTEGER)`,
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
    .limit(10) as Array<{ id: string; name: string; warranty_until: string; days_left: number }>;

  return ok(c, {
    health_score: prop?.health_score ?? 50,
    expenses: exp,
    services: svc,
    inventory: inv,
    maintenance: maint,
    monthly_expenses: monthlyExpenses,
    warranties_expiring: warrantiesExpiring,
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
