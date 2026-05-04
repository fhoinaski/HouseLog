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
  handoverPackages,
  properties,
  tenantMembers,
} from '../db/schema';
import {
  canLinkHandoverSummaryDocument,
  canUseHandoverTenantUser,
} from '../lib/handover-tenant';
import type { Bindings, Variables } from '../lib/types';
import {
  handoverPackageCreateSchema,
  handoverPackageFilterSchema,
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
