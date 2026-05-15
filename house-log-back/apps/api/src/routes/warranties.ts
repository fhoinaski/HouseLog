import { Hono } from 'hono';
import type { Context } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { getDb } from '../db/client';
import {
  documents,
  inventoryItems,
  properties,
  rooms,
  serviceOrders,
  warranties,
} from '../db/schema';
import { canLinkWarrantyReference } from '../lib/warranty-tenant';
import type { Bindings, Variables } from '../lib/types';
import { createId } from '../lib/id';
import {
  warrantyCreateSchema,
  warrantyFilterSchema,
  warrantyUpdateSchema,
  type WarrantyStatus,
  type WarrantyType,
} from '@houselog/contracts';

const warrantiesRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

warrantiesRoute.use('*', authMiddleware);
warrantiesRoute.use('*', resolveTenant);

type DbClient = ReturnType<typeof getDb>;
type WarrantiesContext = Context<{ Bindings: Bindings; Variables: Variables }>;

type WarrantyRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  room_id: string | null;
  service_order_id: string | null;
  document_id: string | null;
  inventory_item_id: string | null;
  title: string;
  description: string | null;
  provider_name: string | null;
  warranty_type: WarrantyType;
  start_date: string | null;
  end_date: string;
  status: WarrantyStatus;
  coverage: string | null;
  exclusions: string | null;
  created_by: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

type ReferenceTable = 'room' | 'service_order' | 'document' | 'inventory_item';

const warrantySelect = {
  id: warranties.id,
  tenant_id: warranties.tenantId,
  property_id: warranties.propertyId,
  room_id: warranties.roomId,
  service_order_id: warranties.serviceOrderId,
  document_id: warranties.documentId,
  inventory_item_id: warranties.inventoryItemId,
  title: warranties.title,
  description: warranties.description,
  provider_name: warranties.providerName,
  warranty_type: warranties.warrantyType,
  start_date: warranties.startDate,
  end_date: warranties.endDate,
  status: warranties.status,
  coverage: warranties.coverage,
  exclusions: warranties.exclusions,
  created_by: warranties.createdBy,
  created_at: warranties.createdAt,
  updated_at: warranties.updatedAt,
  deleted_at: warranties.deletedAt,
};

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function ensureTenantProperty(
  db: DbClient,
  tenantId: string,
  propertyId: string
): Promise<boolean> {
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
  if (table === 'document') {
    const [row] = await db
      .select({ tenantId: documents.tenantId, propertyId: documents.propertyId })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId), eq(documents.propertyId, propertyId), isNull(documents.deletedAt)))
      .limit(1);
    return row ?? null;
  }
  const [row] = await db
    .select({ tenantId: inventoryItems.tenantId, propertyId: inventoryItems.propertyId })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
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
): Promise<ReturnType<typeof canLinkWarrantyReference>> {
  if (!input.id) return { allowed: true };
  const reference = await readReference(db, input.table, input.id, input.tenantId, input.propertyId);
  if (!reference) return { allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' };
  return canLinkWarrantyReference({
    activeTenantId: input.tenantId,
    referenceTenantId: reference.tenantId,
    referencePropertyId: reference.propertyId,
    requestedPropertyId: input.propertyId,
  });
}

async function validateWarrantyReferences(
  db: DbClient,
  tenantId: string,
  propertyId: string,
  input: {
    room_id?: string | null;
    service_order_id?: string | null;
    document_id?: string | null;
    inventory_item_id?: string | null;
  }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 422 }> {
  const checks: Array<{ table: ReferenceTable; id: string | null | undefined; label: string }> = [
    { table: 'room', id: input.room_id, label: 'Ambiente' },
    { table: 'service_order', id: input.service_order_id, label: 'OS' },
    { table: 'document', id: input.document_id, label: 'Documento' },
    { table: 'inventory_item', id: input.inventory_item_id, label: 'Item de inventario' },
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

async function getTenantPropertyOrResponse(
  c: WarrantiesContext,
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

warrantiesRoute.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const filters = warrantyFilterSchema.safeParse({
    status: c.req.query('status'),
    warrantyType: c.req.query('warranty_type'),
    roomId: c.req.query('room_id'),
    serviceOrderId: c.req.query('service_order_id'),
    documentId: c.req.query('document_id'),
    inventoryItemId: c.req.query('inventory_item_id'),
  });
  if (!filters.success) return err(c, 'Filtros invalidos', 'VALIDATION_ERROR', 422, filters.error.flatten());

  const conditions = [
    eq(warranties.tenantId, tenantId),
    eq(warranties.propertyId, propertyId),
    isNull(warranties.deletedAt),
  ];
  if (filters.data.status) conditions.push(eq(warranties.status, filters.data.status));
  if (filters.data.warrantyType) conditions.push(eq(warranties.warrantyType, filters.data.warrantyType));
  if (filters.data.roomId) conditions.push(eq(warranties.roomId, filters.data.roomId));
  if (filters.data.serviceOrderId) conditions.push(eq(warranties.serviceOrderId, filters.data.serviceOrderId));
  if (filters.data.documentId) conditions.push(eq(warranties.documentId, filters.data.documentId));
  if (filters.data.inventoryItemId) conditions.push(eq(warranties.inventoryItemId, filters.data.inventoryItemId));

  const results = await db
    .select(warrantySelect)
    .from(warranties)
    .where(and(...conditions))
    .orderBy(asc(warranties.endDate), asc(warranties.title)) as WarrantyRow[];

  return ok(c, { warranties: results });
});

warrantiesRoute.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = warrantyCreateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data;

  const references = await validateWarrantyReferences(db, tenantId, propertyId, data);
  if (!references.ok) return err(c, references.message, references.responseCode, references.status);

  const id = createId();
  await db.insert(warranties).values({
    id,
    tenantId,
    propertyId,
    roomId: optionalText(data.room_id),
    serviceOrderId: optionalText(data.service_order_id),
    documentId: optionalText(data.document_id),
    inventoryItemId: optionalText(data.inventory_item_id),
    title: data.title.trim(),
    description: optionalText(data.description),
    providerName: optionalText(data.provider_name),
    warrantyType: data.warranty_type,
    startDate: optionalText(data.start_date),
    endDate: data.end_date,
    status: data.status,
    coverage: optionalText(data.coverage),
    exclusions: optionalText(data.exclusions),
    createdBy: userId,
  });

  const [warranty] = await db
    .select(warrantySelect)
    .from(warranties)
    .where(
      and(
        eq(warranties.id, id),
        eq(warranties.tenantId, tenantId),
        eq(warranties.propertyId, propertyId),
        isNull(warranties.deletedAt)
      )
    )
    .limit(1) as WarrantyRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'warranty',
    entityId: id,
    action: 'create',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: warranty,
  });

  return ok(c, { warranty }, 201);
});

warrantiesRoute.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [warranty] = await db
    .select(warrantySelect)
    .from(warranties)
    .where(
      and(
        eq(warranties.id, id),
        eq(warranties.tenantId, tenantId),
        eq(warranties.propertyId, propertyId),
        isNull(warranties.deletedAt)
      )
    )
    .limit(1) as WarrantyRow[];

  if (!warranty) return err(c, 'Garantia nao encontrada', 'NOT_FOUND', 404);
  return ok(c, { warranty });
});

warrantiesRoute.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(warrantySelect)
    .from(warranties)
    .where(
      and(
        eq(warranties.id, id),
        eq(warranties.tenantId, tenantId),
        eq(warranties.propertyId, propertyId),
        isNull(warranties.deletedAt)
      )
    )
    .limit(1) as WarrantyRow[];

  if (!old) return err(c, 'Garantia nao encontrada', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = warrantyUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data;

  const references = await validateWarrantyReferences(db, tenantId, propertyId, data);
  if (!references.ok) return err(c, references.message, references.responseCode, references.status);

  const patch: Partial<typeof warranties.$inferInsert> = {};
  if (data.room_id !== undefined) patch.roomId = optionalText(data.room_id);
  if (data.service_order_id !== undefined) patch.serviceOrderId = optionalText(data.service_order_id);
  if (data.document_id !== undefined) patch.documentId = optionalText(data.document_id);
  if (data.inventory_item_id !== undefined) patch.inventoryItemId = optionalText(data.inventory_item_id);
  if (data.title !== undefined) patch.title = data.title.trim();
  if (data.description !== undefined) patch.description = optionalText(data.description);
  if (data.provider_name !== undefined) patch.providerName = optionalText(data.provider_name);
  if (data.warranty_type !== undefined) patch.warrantyType = data.warranty_type;
  if (data.start_date !== undefined) patch.startDate = optionalText(data.start_date);
  if (data.end_date !== undefined) patch.endDate = data.end_date;
  if (data.status !== undefined) patch.status = data.status;
  if (data.coverage !== undefined) patch.coverage = optionalText(data.coverage);
  if (data.exclusions !== undefined) patch.exclusions = optionalText(data.exclusions);

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');
  patch.updatedAt = new Date().toISOString();

  await db
    .update(warranties)
    .set(patch)
    .where(and(eq(warranties.id, id), eq(warranties.tenantId, tenantId), eq(warranties.propertyId, propertyId)));

  const [warranty] = await db
    .select(warrantySelect)
    .from(warranties)
    .where(and(eq(warranties.id, id), eq(warranties.tenantId, tenantId), eq(warranties.propertyId, propertyId)))
    .limit(1) as WarrantyRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'warranty',
    entityId: id,
    action: 'update',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: warranty,
  });

  return ok(c, { warranty });
});

warrantiesRoute.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyOrResponse(c, db, propertyId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(warrantySelect)
    .from(warranties)
    .where(
      and(
        eq(warranties.id, id),
        eq(warranties.tenantId, tenantId),
        eq(warranties.propertyId, propertyId),
        isNull(warranties.deletedAt)
      )
    )
    .limit(1) as WarrantyRow[];

  if (!old) return err(c, 'Garantia nao encontrada', 'NOT_FOUND', 404);

  await db
    .update(warranties)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(warranties.id, id), eq(warranties.tenantId, tenantId), eq(warranties.propertyId, propertyId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'warranty',
    entityId: id,
    action: 'delete',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default warrantiesRoute;
