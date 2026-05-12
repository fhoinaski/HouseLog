import { Hono } from 'hono';
import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { getDb } from '../db/client';
import {
  documents,
  handoverChecklistItems,
  handoverPackages,
  inventoryItems,
  maintenanceSchedules,
  properties,
  rooms,
  technicalSystems,
  warranties,
  tenantMembers,
} from '../db/schema';
import {
  canLinkHandoverSummaryDocument,
  canUseHandoverTenantUser,
} from '../lib/handover-tenant';
import {
  buildHandoverPackageHash,
  buildHandoverPackageSnapshot,
  buildPublicAccessUrl,
  canIssueHandoverPackage,
  canRevokeHandoverPackage,
  generatePublicAccessToken,
} from '../lib/handover-issue';
import type { Bindings, Variables } from '../lib/types';
import {
  handoverPackageCreateSchema,
  handoverPackageFilterSchema,
  HandoverPackageRevokeInputSchema,
  handoverPackageUpdateSchema,
  type HandoverPackageStatus,
  type HandoverPackageType,
} from '@houselog/contracts';

const handoverPackagesRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

handoverPackagesRoute.use('*', authMiddleware);
handoverPackagesRoute.use('*', resolveTenant);

type DbClient = ReturnType<typeof getDb>;
type HandoverContext = Context<{ Bindings: Bindings; Variables: Variables }>;

type HandoverPackageRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  title: string;
  description: string | null;
  type: HandoverPackageType;
  status: HandoverPackageStatus;
  version: number;
  prepared_by: string;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  summary_document_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  issued_at: string | null;
  issued_by: string | null;
  accepted_at: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  expires_at: string | null;
  public_access_token_hash: string | null;
  snapshot_json: Record<string, unknown> | null;
  package_hash: string | null;
};

const handoverPackageSelect = {
  id: handoverPackages.id,
  tenant_id: handoverPackages.tenantId,
  property_id: handoverPackages.propertyId,
  title: handoverPackages.title,
  description: handoverPackages.description,
  type: handoverPackages.type,
  status: handoverPackages.status,
  version: handoverPackages.version,
  prepared_by: handoverPackages.preparedBy,
  reviewed_by: handoverPackages.reviewedBy,
  approved_by: handoverPackages.approvedBy,
  approved_at: handoverPackages.approvedAt,
  completed_at: handoverPackages.completedAt,
  summary_document_id: handoverPackages.summaryDocumentId,
  notes: handoverPackages.notes,
  created_at: handoverPackages.createdAt,
  updated_at: handoverPackages.updatedAt,
  deleted_at: handoverPackages.deletedAt,
  issued_at: handoverPackages.issuedAt,
  issued_by: handoverPackages.issuedBy,
  accepted_at: handoverPackages.acceptedAt,
  accepted_by_name: handoverPackages.acceptedByName,
  accepted_by_email: handoverPackages.acceptedByEmail,
  revoked_at: handoverPackages.revokedAt,
  revoked_by: handoverPackages.revokedBy,
  revoke_reason: handoverPackages.revokeReason,
  expires_at: handoverPackages.expiresAt,
  public_access_token_hash: handoverPackages.publicAccessTokenHash,
  snapshot_json: handoverPackages.snapshotJson,
  package_hash: handoverPackages.packageHash,
};

type PackageIssueBody = {
  expires_at?: string | null;
};

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function ensureTenantProperty(db: DbClient, tenantId: string, propertyId: string): Promise<boolean> {
  const [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);
  return Boolean(property);
}

async function validateSummaryDocument(
  db: DbClient,
  input: { tenantId: string; propertyId: string; summaryDocumentId?: string | null }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 422 }> {
  const summaryDocumentId = optionalText(input.summaryDocumentId);
  if (!summaryDocumentId) return { ok: true };

  const [document] = await db
    .select({ tenantId: documents.tenantId, propertyId: documents.propertyId })
    .from(documents)
    .where(and(eq(documents.id, summaryDocumentId), isNull(documents.deletedAt)))
    .limit(1);

  const decision = document
    ? canLinkHandoverSummaryDocument({
        activeTenantId: input.tenantId,
        documentTenantId: document.tenantId,
        documentPropertyId: document.propertyId,
        requestedPropertyId: input.propertyId,
      })
    : { allowed: false as const, status: 422 as const, code: 'REFERENCE_NOT_IN_PROPERTY' as const };

  if (!decision.allowed) {
    return {
      ok: false,
      responseCode: decision.code,
      message: 'Documento de resumo nao pertence a este tenant/imovel.',
      status: decision.status,
    };
  }

  return { ok: true };
}

async function validateTenantUser(
  db: DbClient,
  input: { tenantId: string; userId?: string | null; label: string }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 403 }> {
  const userId = optionalText(input.userId);
  if (!userId) return { ok: true };

  const [membership] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, input.tenantId), eq(tenantMembers.userId, userId), eq(tenantMembers.status, 'active')))
    .limit(1);

  const decision = canUseHandoverTenantUser({
    activeTenantId: input.tenantId,
    userTenantId: membership?.tenantId ?? null,
  });

  if (!decision.allowed) {
    return {
      ok: false,
      responseCode: decision.code,
      message: `${input.label} nao pertence ao tenant ativo.`,
      status: decision.status,
    };
  }

  return { ok: true };
}

async function validatePackageLinks(
  db: DbClient,
  input: {
    tenantId: string;
    propertyId: string;
    summaryDocumentId?: string | null;
    reviewedBy?: string | null;
    approvedBy?: string | null;
  }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 403 | 422 }> {
  const summaryDocument = await validateSummaryDocument(db, input);
  if (!summaryDocument.ok) return summaryDocument;

  const reviewedBy = await validateTenantUser(db, { tenantId: input.tenantId, userId: input.reviewedBy, label: 'reviewedBy' });
  if (!reviewedBy.ok) return reviewedBy;

  const approvedBy = await validateTenantUser(db, { tenantId: input.tenantId, userId: input.approvedBy, label: 'approvedBy' });
  if (!approvedBy.ok) return approvedBy;

  return { ok: true };
}

async function getTenantPropertyOrResponse(
  c: HandoverContext,
  db: DbClient,
  propertyId: string,
  tenantId: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const hasTenantProperty = await ensureTenantProperty(db, tenantId, propertyId);
  if (!hasTenantProperty) return { ok: false, response: err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404) };

  const hasAccess = await assertPropertyAccess(
    c.env.DB,
    propertyId,
    c.get('userId'),
    c.get('userRole'),
    tenantId,
    c.get('tenantRole')
  );
  if (!hasAccess) return { ok: false, response: err(c, 'Sem acesso', 'FORBIDDEN', 403) };

  return { ok: true };
}

async function loadIssueSnapshotData(db: DbClient, tenantId: string, propertyId: string, packageId: string) {
  const [property] = await db
    .select({
      id: properties.id,
      name: properties.name,
      type: properties.type,
      address: properties.address,
      city: properties.city,
      areaM2: properties.areaM2,
      yearBuilt: properties.yearBuilt,
      structure: properties.structure,
      floors: properties.floors,
      healthScore: properties.healthScore,
      ownerId: properties.ownerId,
      managerId: properties.managerId,
    })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) return null;

  const [handoverPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!handoverPackage) return null;

  const [roomsRows, documentRows, systemRows, inventoryRows, warrantyRows, maintenanceRows, checklistRows] = await Promise.all([
    db
      .select({
        id: rooms.id,
        name: rooms.name,
        type: rooms.type,
        floor: rooms.floor,
        areaM2: rooms.areaM2,
      })
      .from(rooms)
      .where(and(eq(rooms.tenantId, tenantId), eq(rooms.propertyId, propertyId), isNull(rooms.deletedAt)))
      .orderBy(asc(rooms.floor), asc(rooms.name)),
    db
      .select({
        id: documents.id,
        title: documents.title,
        type: documents.type,
        issueDate: documents.issueDate,
        expiryDate: documents.expiryDate,
      })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.propertyId, propertyId), isNull(documents.deletedAt)))
      .orderBy(desc(documents.createdAt)),
    db
      .select({
        id: technicalSystems.id,
        name: technicalSystems.name,
        type: technicalSystems.type,
        status: technicalSystems.status,
        locationSummary: technicalSystems.locationSummary,
        lastInspectionAt: technicalSystems.lastInspectionAt,
      })
      .from(technicalSystems)
      .where(and(eq(technicalSystems.tenantId, tenantId), eq(technicalSystems.propertyId, propertyId), isNull(technicalSystems.deletedAt)))
      .orderBy(asc(technicalSystems.name)),
    db
      .select({
        id: inventoryItems.id,
        name: inventoryItems.name,
        category: inventoryItems.category,
        roomId: inventoryItems.roomId,
        quantity: inventoryItems.quantity,
        unit: inventoryItems.unit,
        warrantyUntil: inventoryItems.warrantyUntil,
      })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
      .orderBy(asc(inventoryItems.name)),
    db
      .select({
        id: warranties.id,
        title: warranties.title,
        warrantyType: warranties.warrantyType,
        status: warranties.status,
        startDate: warranties.startDate,
        endDate: warranties.endDate,
        providerName: warranties.providerName,
      })
      .from(warranties)
      .where(and(eq(warranties.tenantId, tenantId), eq(warranties.propertyId, propertyId), isNull(warranties.deletedAt)))
      .orderBy(desc(warranties.endDate)),
    db
      .select({
        id: maintenanceSchedules.id,
        title: maintenanceSchedules.title,
        systemType: maintenanceSchedules.systemType,
        responsible: maintenanceSchedules.responsible,
        frequency: maintenanceSchedules.frequency,
        lastDone: maintenanceSchedules.lastDone,
        nextDue: maintenanceSchedules.nextDue,
        autoCreateOs: maintenanceSchedules.autoCreateOs,
      })
      .from(maintenanceSchedules)
      .where(and(eq(maintenanceSchedules.tenantId, tenantId), eq(maintenanceSchedules.propertyId, propertyId), isNull(maintenanceSchedules.deletedAt)))
      .orderBy(asc(maintenanceSchedules.nextDue)),
    db
      .select({
        id: handoverChecklistItems.id,
        title: handoverChecklistItems.title,
        category: handoverChecklistItems.category,
        status: handoverChecklistItems.status,
        required: handoverChecklistItems.required,
        condition: handoverChecklistItems.condition,
        completedAt: handoverChecklistItems.completedAt,
        roomId: handoverChecklistItems.roomId,
        documentId: handoverChecklistItems.documentId,
        inventoryItemId: handoverChecklistItems.inventoryItemId,
        serviceOrderId: handoverChecklistItems.serviceOrderId,
      })
      .from(handoverChecklistItems)
      .where(
        and(
          eq(handoverChecklistItems.tenantId, tenantId),
          eq(handoverChecklistItems.propertyId, propertyId),
          eq(handoverChecklistItems.handoverPackageId, packageId),
          isNull(handoverChecklistItems.deletedAt)
        )
      )
      .orderBy(asc(handoverChecklistItems.sortOrder), asc(handoverChecklistItems.createdAt)),
  ]);

  return {
    property,
    handoverPackage,
    rooms: roomsRows,
    documents: documentRows,
    technicalSystems: systemRows,
    inventoryItems: inventoryRows,
    warranties: warrantyRows,
    maintenanceSchedules: maintenanceRows,
    checklistItems: checklistRows,
  };
}

handoverPackagesRoute.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const filters = handoverPackageFilterSchema.safeParse({
    status: c.req.query('status'),
    type: c.req.query('type'),
    reviewedBy: c.req.query('reviewed_by'),
    approvedBy: c.req.query('approved_by'),
    summaryDocumentId: c.req.query('summary_document_id'),
    createdFrom: c.req.query('created_from'),
    createdTo: c.req.query('created_to'),
    completedFrom: c.req.query('completed_from'),
    completedTo: c.req.query('completed_to'),
  });
  if (!filters.success) return err(c, 'Filtros invalidos', 'VALIDATION_ERROR', 422, filters.error.flatten());

  const conditions = [
    eq(handoverPackages.tenantId, tenantId),
    eq(handoverPackages.propertyId, propertyId),
    isNull(handoverPackages.deletedAt),
  ];
  if (filters.data.status) conditions.push(eq(handoverPackages.status, filters.data.status));
  if (filters.data.type) conditions.push(eq(handoverPackages.type, filters.data.type));
  if (filters.data.reviewedBy) conditions.push(eq(handoverPackages.reviewedBy, filters.data.reviewedBy));
  if (filters.data.approvedBy) conditions.push(eq(handoverPackages.approvedBy, filters.data.approvedBy));
  if (filters.data.summaryDocumentId) conditions.push(eq(handoverPackages.summaryDocumentId, filters.data.summaryDocumentId));
  if (filters.data.createdFrom) conditions.push(gte(handoverPackages.createdAt, filters.data.createdFrom));
  if (filters.data.createdTo) conditions.push(lte(handoverPackages.createdAt, filters.data.createdTo));
  if (filters.data.completedFrom) conditions.push(gte(handoverPackages.completedAt, filters.data.completedFrom));
  if (filters.data.completedTo) conditions.push(lte(handoverPackages.completedAt, filters.data.completedTo));

  const results = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(and(...conditions))
    .orderBy(desc(handoverPackages.createdAt), asc(handoverPackages.title)) as HandoverPackageRow[];

  return ok(c, { packages: results });
});

handoverPackagesRoute.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = handoverPackageCreateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data;

  const links = await validatePackageLinks(db, {
    tenantId,
    propertyId,
    summaryDocumentId: data.summary_document_id,
    reviewedBy: data.reviewed_by,
    approvedBy: data.approved_by,
  });
  if (!links.ok) return err(c, links.message, links.responseCode, links.status);

  const id = nanoid();
  await db.insert(handoverPackages).values({
    id,
    tenantId,
    propertyId,
    title: data.title.trim(),
    description: optionalText(data.description),
    type: data.type,
    status: data.status,
    version: data.version,
    preparedBy: userId,
    reviewedBy: optionalText(data.reviewed_by),
    approvedBy: optionalText(data.approved_by),
    approvedAt: optionalText(data.approved_at),
    completedAt: optionalText(data.completed_at),
    summaryDocumentId: optionalText(data.summary_document_id),
    notes: optionalText(data.notes),
  });

  const [handoverPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, id),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_package',
    entityId: id,
    action: 'create',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: handoverPackage,
  });

  return ok(c, { package: handoverPackage }, 201);
});

handoverPackagesRoute.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [handoverPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, id),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!handoverPackage) return err(c, 'Dossie nao encontrado', 'NOT_FOUND', 404);
  return ok(c, { package: handoverPackage });
});

handoverPackagesRoute.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, id),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!old) return err(c, 'Dossie nao encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = handoverPackageUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data;

  const links = await validatePackageLinks(db, {
    tenantId,
    propertyId,
    summaryDocumentId: data.summary_document_id,
    reviewedBy: data.reviewed_by,
    approvedBy: data.approved_by,
  });
  if (!links.ok) return err(c, links.message, links.responseCode, links.status);

  const patch: Partial<typeof handoverPackages.$inferInsert> = {};
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.description !== undefined) patch.description = optionalText(data.description);
  if (data.type !== undefined) patch.type = data.type;
  if (data.status !== undefined) patch.status = data.status;
  if (data.version !== undefined) patch.version = data.version;
  if (data.reviewed_by !== undefined) patch.reviewedBy = optionalText(data.reviewed_by);
  if (data.approved_by !== undefined) patch.approvedBy = optionalText(data.approved_by);
  if (data.approved_at !== undefined) patch.approvedAt = optionalText(data.approved_at);
  if (data.completed_at !== undefined) patch.completedAt = optionalText(data.completed_at);
  if (data.summary_document_id !== undefined) patch.summaryDocumentId = optionalText(data.summary_document_id);
  if (data.notes !== undefined) patch.notes = optionalText(data.notes);

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');
  patch.updatedAt = new Date().toISOString();

  await db
    .update(handoverPackages)
    .set(patch)
    .where(
      and(
        eq(handoverPackages.id, id),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    );

  const [handoverPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(and(eq(handoverPackages.id, id), eq(handoverPackages.tenantId, tenantId), eq(handoverPackages.propertyId, propertyId)))
    .limit(1) as HandoverPackageRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_package',
    entityId: id,
    action: data.status !== undefined && data.status !== old.status ? 'handover_package_status_changed' : 'update',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: handoverPackage,
  });

  return ok(c, { package: handoverPackage });
});

handoverPackagesRoute.post('/:id/issue', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const packageId = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const tenantRole = c.get('tenantRole');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [property] = await db
    .select({
      id: properties.id,
      ownerId: properties.ownerId,
      managerId: properties.managerId,
    })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const [handoverPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!handoverPackage) return err(c, 'Dossie nao encontrado', 'NOT_FOUND', 404);

  const permission = canIssueHandoverPackage({
    tenantId,
    tenantRole,
    userId,
    userRole,
    propertyOwnerId: property.ownerId,
    propertyManagerId: property.managerId,
    packageStatus: handoverPackage.status,
    issuedAt: handoverPackage.issued_at,
    revokedAt: handoverPackage.revoked_at,
    acceptedAt: handoverPackage.accepted_at,
    publicAccessTokenHash: handoverPackage.public_access_token_hash,
  });
  if (!permission.allowed) {
    const code = permission.code === 'CONFLICT' ? 'PACKAGE_NOT_READY' : permission.code;
    const status = permission.status;
    return err(
      c,
      code === 'PACKAGE_NOT_READY' ? 'Dossie nao esta pronto para emissao.' : 'Sem permissão para emitir o dossie.',
      code,
      status
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parsedBody = body && typeof body === 'object' ? (body as PackageIssueBody) : {};
  const now = new Date().toISOString();
  let expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
  if (parsedBody.expires_at) {
    const expiresAtDate = new Date(parsedBody.expires_at);
    if (Number.isNaN(expiresAtDate.getTime())) {
      return err(c, 'Data de expiracao invalida.', 'VALIDATION_ERROR', 422);
    }
    expiresAt = expiresAtDate.toISOString();
  }

  const issueData = await loadIssueSnapshotData(db, tenantId, propertyId, packageId);
  if (!issueData) return err(c, 'Dossie nao encontrado', 'NOT_FOUND', 404);

  const snapshotJson = buildHandoverPackageSnapshot({
    generatedAt: now,
    property: {
      id: issueData.property.id,
      name: issueData.property.name,
      type: issueData.property.type,
      address: issueData.property.address,
      city: issueData.property.city,
      areaM2: issueData.property.areaM2,
      yearBuilt: issueData.property.yearBuilt,
      structure: issueData.property.structure,
      floors: issueData.property.floors,
      healthScore: issueData.property.healthScore,
    },
    package: {
      id: issueData.handoverPackage.id,
      title: issueData.handoverPackage.title,
      type: issueData.handoverPackage.type,
      version: issueData.handoverPackage.version,
      status: issueData.handoverPackage.status,
    },
    rooms: issueData.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      type: room.type,
      floor: room.floor,
      areaM2: room.areaM2,
    })),
    documents: issueData.documents.map((document) => ({
      id: document.id,
      title: document.title,
      type: document.type,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
    })),
    technicalSystems: issueData.technicalSystems.map((system) => ({
      id: system.id,
      name: system.name,
      type: system.type,
      status: system.status,
      locationSummary: system.locationSummary,
      lastInspectionAt: system.lastInspectionAt,
    })),
    inventoryItems: issueData.inventoryItems.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      roomId: item.roomId,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      warrantyUntil: item.warrantyUntil,
    })),
    warranties: issueData.warranties.map((warranty) => ({
      id: warranty.id,
      title: warranty.title,
      warrantyType: warranty.warrantyType,
      status: warranty.status,
      startDate: warranty.startDate,
      endDate: warranty.endDate,
      providerName: warranty.providerName,
    })),
    maintenanceSchedules: issueData.maintenanceSchedules.map((schedule) => ({
      id: schedule.id,
      title: schedule.title,
      systemType: schedule.systemType,
      responsible: schedule.responsible,
      frequency: schedule.frequency,
      lastDone: schedule.lastDone,
      nextDue: schedule.nextDue,
      autoCreateOs: Boolean(schedule.autoCreateOs),
    })),
    checklistItems: issueData.checklistItems.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      status: item.status,
      required: Boolean(item.required),
      condition: item.condition,
      completedAt: item.completedAt,
      roomId: item.roomId,
      documentId: item.documentId,
      inventoryItemId: item.inventoryItemId,
      serviceOrderId: item.serviceOrderId,
    })),
  });

  const { token, tokenHash } = await generatePublicAccessToken();
  const packageHash = await buildHandoverPackageHash({
    packageId,
    version: issueData.handoverPackage.version,
    issuedAt: now,
    expiresAt,
    snapshotJson,
  });

  await db
    .update(handoverPackages)
    .set({
      status: 'issued',
      issuedAt: now,
      issuedBy: userId,
      expiresAt,
      publicAccessTokenHash: tokenHash,
      snapshotJson,
      packageHash,
      updatedAt: now,
    })
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    );

  const [issuedPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!issuedPackage) return err(c, 'Erro ao emitir dossie', 'INTERNAL_ERROR', 500);

  const publicAccessUrl = buildPublicAccessUrl(c.env.APP_URL, token);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_package',
    entityId: packageId,
    action: 'handover_package_issued',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: handoverPackage,
    newData: issuedPackage,
  });

  return ok(c, { package: issuedPackage, publicAccessUrl });
});

handoverPackagesRoute.post('/:id/revoke', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const packageId = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const tenantRole = c.get('tenantRole');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const body = await c.req.json().catch((): unknown => ({}));
  const parsedBody = HandoverPackageRevokeInputSchema.safeParse(body);
  if (!parsedBody.success) {
    return err(c, 'Dados de revogacao invalidos.', 'VALIDATION_ERROR', 422);
  }

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [property] = await db
    .select({
      id: properties.id,
      ownerId: properties.ownerId,
      managerId: properties.managerId,
    })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const [handoverPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!handoverPackage) return err(c, 'Dossie nao encontrado', 'NOT_FOUND', 404);

  const permission = canRevokeHandoverPackage({
    tenantId,
    tenantRole,
    userId,
    userRole,
    propertyOwnerId: property.ownerId,
    propertyManagerId: property.managerId,
    packageStatus: handoverPackage.status,
    issuedAt: handoverPackage.issued_at,
    revokedAt: handoverPackage.revoked_at,
    publicAccessTokenHash: handoverPackage.public_access_token_hash,
  });
  if (!permission.allowed) {
    const message = permission.code === 'CONFLICT'
      ? 'Dossie nao pode ser revogado neste estado.'
      : 'Sem permissao para revogar o dossie.';
    return err(c, message, permission.code, permission.status);
  }

  const now = new Date().toISOString();
  await db
    .update(handoverPackages)
    .set({
      status: 'revoked',
      revokedAt: now,
      revokedBy: userId,
      revokeReason: parsedBody.data.revokeReason,
      updatedAt: now,
    })
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    );

  const [revokedPackage] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!revokedPackage) return err(c, 'Erro ao revogar dossie', 'INTERNAL_ERROR', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_package',
    entityId: packageId,
    action: 'handover_package_revoked',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: {
      id: handoverPackage.id,
      property_id: handoverPackage.property_id,
      status: handoverPackage.status,
      revoked_at: handoverPackage.revoked_at,
    },
    newData: {
      id: revokedPackage.id,
      property_id: revokedPackage.property_id,
      status: revokedPackage.status,
      revoked_at: revokedPackage.revoked_at,
      revoked_by: revokedPackage.revoked_by,
      revoke_reason: revokedPackage.revoke_reason,
    },
  });

  return ok(c, { package: revokedPackage });
});

handoverPackagesRoute.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(handoverPackageSelect)
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, id),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1) as HandoverPackageRow[];

  if (!old) return err(c, 'Dossie nao encontrado', 'NOT_FOUND', 404);

  await db
    .update(handoverPackages)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(handoverPackages.id, id), eq(handoverPackages.tenantId, tenantId), eq(handoverPackages.propertyId, propertyId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_package',
    entityId: id,
    action: 'delete',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default handoverPackagesRoute;
