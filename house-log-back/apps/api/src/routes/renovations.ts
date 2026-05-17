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
  properties,
  propertyCollaborators,
  renovations,
  rooms,
  serviceOrders,
  tenantMembers,
} from '../db/schema';
import {
  canLinkRenovationReference,
  canUseRenovationContractor,
  isPublicRenovationPhotoReference,
} from '../lib/renovation-tenant';
import type { Bindings, Variables } from '../lib/types';
import {
  renovationCreateSchema,
  renovationFilterSchema,
  renovationUpdateSchema,
  type RenovationCategory,
  type RenovationStatus,
} from '@houselog/contracts';

const renovationsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

renovationsRoute.use('*', authMiddleware);
renovationsRoute.use('*', resolveTenant);

type DbClient = ReturnType<typeof getDb>;
type RenovationsContext = Context<{ Bindings: Bindings; Variables: Variables }>;
type ReferenceTable = 'room' | 'service_order' | 'document';

type RenovationRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string | null;
  service_order_id: string | null;
  document_id: string | null;
  title: string;
  description: string | null;
  category: RenovationCategory;
  status: RenovationStatus;
  started_at: string | null;
  completed_at: string | null;
  contractor_name: string | null;
  contractor_id: string | null;
  cost: number | null;
  notes: string | null;
  before_photos: string[];
  after_photos: string[];
  created_by: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

const renovationSelect = {
  id: renovations.id,
  tenant_id: renovations.tenantId,
  property_id: renovations.propertyId,
  room_id: renovations.roomId,
  service_order_id: renovations.serviceOrderId,
  document_id: renovations.documentId,
  title: renovations.title,
  description: renovations.description,
  category: renovations.category,
  status: renovations.status,
  started_at: renovations.startedAt,
  completed_at: renovations.completedAt,
  contractor_name: renovations.contractorName,
  contractor_id: renovations.contractorId,
  cost: renovations.cost,
  notes: renovations.notes,
  before_photos: renovations.beforePhotos,
  after_photos: renovations.afterPhotos,
  created_by: renovations.createdBy,
  created_at: renovations.createdAt,
  updated_at: renovations.updatedAt,
  deleted_at: renovations.deletedAt,
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

async function readReference(
  db: DbClient,
  table: ReferenceTable,
  id: string,
  tenantId: string,
  propertyId: string
): Promise<{ tenantId: string | null; propertyId: string } | null> {
  if (table === 'room') {
    const [row] = await db
      .select({ tenantId: rooms.tenantId, propertyId: rooms.propertyId })
      .from(rooms)
      .where(and(eq(rooms.id, id), eq(rooms.tenantId, tenantId), eq(rooms.propertyId, propertyId), isNull(rooms.deletedAt)))
      .limit(1);
    return row ?? null;
  }
  if (table === 'service_order') {
    const [row] = await db
      .select({ tenantId: serviceOrders.tenantId, propertyId: serviceOrders.propertyId })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.id, id), eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select({ tenantId: documents.tenantId, propertyId: documents.propertyId })
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId), eq(documents.propertyId, propertyId), isNull(documents.deletedAt)))
    .limit(1);
  return row ?? null;
}

async function validateOptionalReference(
  db: DbClient,
  input: {
    table: ReferenceTable;
    id: string | null | undefined;
    tenantId: string;
    propertyId: string;
  }
): Promise<ReturnType<typeof canLinkRenovationReference>> {
  if (!input.id) return { allowed: true };
  const reference = await readReference(db, input.table, input.id, input.tenantId, input.propertyId);
  if (!reference) return { allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' };
  return canLinkRenovationReference({
    activeTenantId: input.tenantId,
    referenceTenantId: reference.tenantId,
    referencePropertyId: reference.propertyId,
    requestedPropertyId: input.propertyId,
  });
}

async function validateRenovationReferences(
  db: DbClient,
  tenantId: string,
  propertyId: string,
  input: {
    room_id?: string | null;
    service_order_id?: string | null;
    document_id?: string | null;
  }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 422 }> {
  const checks: Array<{ table: ReferenceTable; id: string | null | undefined; label: string }> = [
    { table: 'room', id: input.room_id, label: 'Ambiente' },
    { table: 'service_order', id: input.service_order_id, label: 'OS' },
    { table: 'document', id: input.document_id, label: 'Documento' },
  ];

  for (const check of checks) {
    const decision = await validateOptionalReference(db, {
      table: check.table,
      id: optionalText(check.id),
      tenantId,
      propertyId,
    });
    if (!decision.allowed) {
      return {
        ok: false,
        responseCode: decision.code,
        message: `${check.label} nao pertence a este tenant/imovel.`,
        status: decision.status,
      };
    }
  }

  return { ok: true };
}

async function validateContractor(
  db: DbClient,
  input: { tenantId: string; propertyId: string; contractorId?: string | null }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 403 }> {
  const contractorId = optionalText(input.contractorId);
  if (!contractorId) return { ok: true };

  const [membership] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.tenantId, input.tenantId),
        eq(tenantMembers.userId, contractorId),
        eq(tenantMembers.status, 'active')
      )
    )
    .limit(1);

  const [providerCollaborator] = await db
    .select({ tenantId: propertyCollaborators.tenantId, propertyId: propertyCollaborators.propertyId })
    .from(propertyCollaborators)
    .where(
      and(
        eq(propertyCollaborators.tenantId, input.tenantId),
        eq(propertyCollaborators.propertyId, input.propertyId),
        eq(propertyCollaborators.userId, contractorId),
        eq(propertyCollaborators.role, 'provider')
      )
    )
    .limit(1);

  const decision = canUseRenovationContractor({
    activeTenantId: input.tenantId,
    contractorTenantId: membership?.tenantId ?? null,
    contractorCollaboratorTenantId: providerCollaborator?.tenantId ?? null,
    contractorCollaboratorPropertyId: providerCollaborator?.propertyId ?? null,
    requestedPropertyId: input.propertyId,
  });

  if (!decision.allowed) {
    return {
      ok: false,
      responseCode: decision.code,
      message: 'Contratado nao pertence ao tenant/imovel.',
      status: decision.status,
    };
  }

  return { ok: true };
}

function validatePhotoReferences(
  propertyId: string,
  photos: string[] | undefined,
  publicR2BaseUrl?: string | null
): { ok: true } | { ok: false; message: string } {
  if (!photos) return { ok: true };
  const hasPrivateReference = photos.some((value) =>
    !isPublicRenovationPhotoReference({ propertyId, value, publicR2BaseUrl })
  );
  if (hasPrivateReference) {
    return { ok: false, message: 'Fotos devem usar endpoint autenticado ou URL publica permitida, nao R2 privado.' };
  }
  return { ok: true };
}

async function getTenantPropertyOrResponse(
  c: RenovationsContext,
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

renovationsRoute.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const filters = renovationFilterSchema.safeParse({
    status: c.req.query('status'),
    category: c.req.query('category'),
    roomId: c.req.query('room_id'),
    serviceOrderId: c.req.query('service_order_id'),
    documentId: c.req.query('document_id'),
    startedFrom: c.req.query('started_from'),
    startedTo: c.req.query('started_to'),
    completedFrom: c.req.query('completed_from'),
    completedTo: c.req.query('completed_to'),
  });
  if (!filters.success) return err(c, 'Filtros invalidos', 'VALIDATION_ERROR', 422, filters.error.flatten());

  const conditions = [
    eq(renovations.tenantId, tenantId),
    eq(renovations.propertyId, propertyId),
    isNull(renovations.deletedAt),
  ];
  if (filters.data.status) conditions.push(eq(renovations.status, filters.data.status));
  if (filters.data.category) conditions.push(eq(renovations.category, filters.data.category));
  if (filters.data.roomId) conditions.push(eq(renovations.roomId, filters.data.roomId));
  if (filters.data.serviceOrderId) conditions.push(eq(renovations.serviceOrderId, filters.data.serviceOrderId));
  if (filters.data.documentId) conditions.push(eq(renovations.documentId, filters.data.documentId));
  if (filters.data.startedFrom) conditions.push(gte(renovations.startedAt, filters.data.startedFrom));
  if (filters.data.startedTo) conditions.push(lte(renovations.startedAt, filters.data.startedTo));
  if (filters.data.completedFrom) conditions.push(gte(renovations.completedAt, filters.data.completedFrom));
  if (filters.data.completedTo) conditions.push(lte(renovations.completedAt, filters.data.completedTo));

  const results = await db
    .select(renovationSelect)
    .from(renovations)
    .where(and(...conditions))
    .orderBy(desc(renovations.startedAt), asc(renovations.title)) as RenovationRow[];

  return ok(c, { renovations: results });
});

renovationsRoute.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = renovationCreateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data;

  const references = await validateRenovationReferences(db, tenantId, propertyId, data);
  if (!references.ok) return err(c, references.message, references.responseCode, references.status);

  const contractor = await validateContractor(db, { tenantId, propertyId, contractorId: data.contractor_id });
  if (!contractor.ok) return err(c, contractor.message, contractor.responseCode, contractor.status);

  const beforePhotos = validatePhotoReferences(propertyId, data.before_photos, c.env.R2_PUBLIC_URL);
  if (!beforePhotos.ok) return err(c, beforePhotos.message, 'INVALID_PHOTO_REFERENCE', 422);
  const afterPhotos = validatePhotoReferences(propertyId, data.after_photos, c.env.R2_PUBLIC_URL);
  if (!afterPhotos.ok) return err(c, afterPhotos.message, 'INVALID_PHOTO_REFERENCE', 422);

  const id = nanoid();
  await db.insert(renovations).values({
    id,
    tenantId,
    propertyId,
    roomId: optionalText(data.room_id),
    serviceOrderId: optionalText(data.service_order_id),
    documentId: optionalText(data.document_id),
    title: data.title.trim(),
    description: optionalText(data.description),
    category: data.category,
    status: data.status,
    startedAt: optionalText(data.started_at),
    completedAt: optionalText(data.completed_at),
    contractorName: optionalText(data.contractor_name),
    contractorId: optionalText(data.contractor_id),
    cost: data.cost ?? null,
    notes: optionalText(data.notes),
    beforePhotos: data.before_photos ?? [],
    afterPhotos: data.after_photos ?? [],
    createdBy: userId,
  });

  const [renovation] = await db
    .select(renovationSelect)
    .from(renovations)
    .where(
      and(
        eq(renovations.id, id),
        eq(renovations.tenantId, tenantId),
        eq(renovations.propertyId, propertyId),
        isNull(renovations.deletedAt)
      )
    )
    .limit(1) as RenovationRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'renovation',
    entityId: id,
    action: 'create',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: renovation,
  });

  return ok(c, { renovation }, 201);
});

renovationsRoute.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [renovation] = await db
    .select(renovationSelect)
    .from(renovations)
    .where(
      and(
        eq(renovations.id, id),
        eq(renovations.tenantId, tenantId),
        eq(renovations.propertyId, propertyId),
        isNull(renovations.deletedAt)
      )
    )
    .limit(1) as RenovationRow[];

  if (!renovation) return err(c, 'Reforma nao encontrada', 'NOT_FOUND', 404);
  return ok(c, { renovation });
});

renovationsRoute.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(renovationSelect)
    .from(renovations)
    .where(
      and(
        eq(renovations.id, id),
        eq(renovations.tenantId, tenantId),
        eq(renovations.propertyId, propertyId),
        isNull(renovations.deletedAt)
      )
    )
    .limit(1) as RenovationRow[];

  if (!old) return err(c, 'Reforma nao encontrada', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = renovationUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data;

  const references = await validateRenovationReferences(db, tenantId, propertyId, data);
  if (!references.ok) return err(c, references.message, references.responseCode, references.status);

  const contractor = await validateContractor(db, { tenantId, propertyId, contractorId: data.contractor_id });
  if (!contractor.ok) return err(c, contractor.message, contractor.responseCode, contractor.status);

  const beforePhotos = validatePhotoReferences(propertyId, data.before_photos, c.env.R2_PUBLIC_URL);
  if (!beforePhotos.ok) return err(c, beforePhotos.message, 'INVALID_PHOTO_REFERENCE', 422);
  const afterPhotos = validatePhotoReferences(propertyId, data.after_photos, c.env.R2_PUBLIC_URL);
  if (!afterPhotos.ok) return err(c, afterPhotos.message, 'INVALID_PHOTO_REFERENCE', 422);

  const patch: Partial<typeof renovations.$inferInsert> = {};
  if (data.room_id !== undefined) patch.roomId = optionalText(data.room_id);
  if (data.service_order_id !== undefined) patch.serviceOrderId = optionalText(data.service_order_id);
  if (data.document_id !== undefined) patch.documentId = optionalText(data.document_id);
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.description !== undefined) patch.description = optionalText(data.description);
  if (data.category !== undefined) patch.category = data.category;
  if (data.status !== undefined) patch.status = data.status;
  if (data.started_at !== undefined) patch.startedAt = optionalText(data.started_at);
  if (data.completed_at !== undefined) patch.completedAt = optionalText(data.completed_at);
  if (data.contractor_name !== undefined) patch.contractorName = optionalText(data.contractor_name);
  if (data.contractor_id !== undefined) patch.contractorId = optionalText(data.contractor_id);
  if (data.cost !== undefined) patch.cost = data.cost ?? null;
  if (data.notes !== undefined) patch.notes = optionalText(data.notes);
  if (data.before_photos !== undefined) patch.beforePhotos = data.before_photos;
  if (data.after_photos !== undefined) patch.afterPhotos = data.after_photos;

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');
  patch.updatedAt = new Date().toISOString();

  await db
    .update(renovations)
    .set(patch)
    .where(
      and(
        eq(renovations.id, id),
        eq(renovations.tenantId, tenantId),
        eq(renovations.propertyId, propertyId),
        isNull(renovations.deletedAt)
      )
    );

  const [renovation] = await db
    .select(renovationSelect)
    .from(renovations)
    .where(and(
      eq(renovations.id, id),
      eq(renovations.tenantId, tenantId),
      eq(renovations.propertyId, propertyId),
      isNull(renovations.deletedAt)
    ))
    .limit(1) as RenovationRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'renovation',
    entityId: id,
    action: 'update',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: renovation,
  });

  return ok(c, { renovation });
});

renovationsRoute.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(renovationSelect)
    .from(renovations)
    .where(
      and(
        eq(renovations.id, id),
        eq(renovations.tenantId, tenantId),
        eq(renovations.propertyId, propertyId),
        isNull(renovations.deletedAt)
      )
    )
    .limit(1) as RenovationRow[];

  if (!old) return err(c, 'Reforma nao encontrada', 'NOT_FOUND', 404);

  await db
    .update(renovations)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(
      eq(renovations.id, id),
      eq(renovations.tenantId, tenantId),
      eq(renovations.propertyId, propertyId),
      isNull(renovations.deletedAt)
    ));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'renovation',
    entityId: id,
    action: 'delete',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default renovationsRoute;
