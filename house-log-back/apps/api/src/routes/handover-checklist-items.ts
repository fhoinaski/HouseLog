import { Hono } from 'hono';
import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { getDb } from '../db/client';
import {
  documents,
  handoverChecklistItems,
  handoverPackages,
  inventoryItems,
  properties,
  rooms,
  serviceOrders,
  tenantMembers,
} from '../db/schema';
import {
  canLinkHandoverChecklistReference,
  canUseHandoverTenantUser,
  isAllowedHandoverEvidenceReference,
} from '../lib/handover-tenant';
import type { Bindings, Variables } from '../lib/types';
import {
  handoverChecklistItemCreateSchema,
  handoverChecklistItemFilterSchema,
  handoverChecklistItemStatusUpdateSchema,
  handoverChecklistItemUpdateSchema,
  type HandoverChecklistItemCategory,
  type HandoverChecklistItemCondition,
  type HandoverChecklistItemStatus,
  type HandoverChecklistItemStatusUpdateInput,
  type HandoverChecklistItemUpdateInput,
} from '@houselog/contracts';

const handoverChecklistItemsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

handoverChecklistItemsRoute.use('*', authMiddleware);
handoverChecklistItemsRoute.use('*', resolveTenant);

type DbClient = ReturnType<typeof getDb>;
type ItemsContext = Context<{ Bindings: Bindings; Variables: Variables }>;
type ReferenceTable = 'room' | 'inventory_item' | 'document' | 'service_order';

type HandoverChecklistItemRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  handover_package_id: string;
  room_id: string | null;
  inventory_item_id: string | null;
  document_id: string | null;
  service_order_id: string | null;
  title: string;
  description: string | null;
  category: HandoverChecklistItemCategory;
  required: boolean;
  status: HandoverChecklistItemStatus;
  condition: HandoverChecklistItemCondition | null;
  evidence_urls: string[];
  notes: string | null;
  sort_order: number;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

const itemSelect = {
  id: handoverChecklistItems.id,
  tenant_id: handoverChecklistItems.tenantId,
  property_id: handoverChecklistItems.propertyId,
  handover_package_id: handoverChecklistItems.handoverPackageId,
  room_id: handoverChecklistItems.roomId,
  inventory_item_id: handoverChecklistItems.inventoryItemId,
  document_id: handoverChecklistItems.documentId,
  service_order_id: handoverChecklistItems.serviceOrderId,
  title: handoverChecklistItems.title,
  description: handoverChecklistItems.description,
  category: handoverChecklistItems.category,
  required: handoverChecklistItems.required,
  status: handoverChecklistItems.status,
  condition: handoverChecklistItems.condition,
  evidence_urls: handoverChecklistItems.evidenceUrls,
  notes: handoverChecklistItems.notes,
  sort_order: handoverChecklistItems.sortOrder,
  completed_by: handoverChecklistItems.completedBy,
  completed_at: handoverChecklistItems.completedAt,
  created_at: handoverChecklistItems.createdAt,
  updated_at: handoverChecklistItems.updatedAt,
  deleted_at: handoverChecklistItems.deletedAt,
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

async function ensureTenantPackage(
  db: DbClient,
  tenantId: string,
  propertyId: string,
  packageId: string
): Promise<boolean> {
  const [pkg] = await db
    .select({ id: handoverPackages.id })
    .from(handoverPackages)
    .where(
      and(
        eq(handoverPackages.id, packageId),
        eq(handoverPackages.tenantId, tenantId),
        eq(handoverPackages.propertyId, propertyId),
        isNull(handoverPackages.deletedAt)
      )
    )
    .limit(1);
  return Boolean(pkg);
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
  if (table === 'inventory_item') {
    const [row] = await db
      .select({ tenantId: inventoryItems.tenantId, propertyId: inventoryItems.propertyId })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
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
    .select({ tenantId: serviceOrders.tenantId, propertyId: serviceOrders.propertyId })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1);
  return row ?? null;
}

async function validateOptionalReference(
  db: DbClient,
  input: { table: ReferenceTable; id?: string | null; tenantId: string; propertyId: string }
): Promise<ReturnType<typeof canLinkHandoverChecklistReference>> {
  const id = optionalText(input.id);
  if (!id) return { allowed: true };
  const reference = await readReference(db, input.table, id, input.tenantId, input.propertyId);
  if (!reference) return { allowed: false, status: 422, code: 'REFERENCE_NOT_IN_PROPERTY' };
  return canLinkHandoverChecklistReference({
    activeTenantId: input.tenantId,
    referenceTenantId: reference.tenantId,
    referencePropertyId: reference.propertyId,
    requestedPropertyId: input.propertyId,
  });
}

async function validateReferences(
  db: DbClient,
  tenantId: string,
  propertyId: string,
  input: {
    room_id?: string | null;
    inventory_item_id?: string | null;
    document_id?: string | null;
    service_order_id?: string | null;
  }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 422 }> {
  const checks: Array<{ table: ReferenceTable; id?: string | null; label: string }> = [
    { table: 'room', id: input.room_id, label: 'Ambiente' },
    { table: 'inventory_item', id: input.inventory_item_id, label: 'Item de inventario' },
    { table: 'document', id: input.document_id, label: 'Documento' },
    { table: 'service_order', id: input.service_order_id, label: 'OS' },
  ];

  for (const check of checks) {
    const decision = await validateOptionalReference(db, {
      table: check.table,
      id: check.id,
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

async function validateCompletedBy(
  db: DbClient,
  input: { tenantId: string; completedBy?: string | null }
): Promise<{ ok: true } | { ok: false; responseCode: string; message: string; status: 400 | 403 }> {
  const completedBy = optionalText(input.completedBy);
  if (!completedBy) return { ok: true };

  const [membership] = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, input.tenantId), eq(tenantMembers.userId, completedBy), eq(tenantMembers.status, 'active')))
    .limit(1);

  const decision = canUseHandoverTenantUser({
    activeTenantId: input.tenantId,
    userTenantId: membership?.tenantId ?? null,
  });

  if (!decision.allowed) {
    return {
      ok: false,
      responseCode: decision.code,
      message: 'completedBy nao pertence ao tenant ativo.',
      status: decision.status,
    };
  }
  return { ok: true };
}

function validateEvidenceUrls(
  urls: string[] | undefined,
  publicR2BaseUrl?: string | null
): { ok: true } | { ok: false; message: string } {
  if (!urls) return { ok: true };
  const invalid = urls.some((value) => !isAllowedHandoverEvidenceReference({ value, publicR2BaseUrl }));
  if (invalid) return { ok: false, message: 'Evidencias devem usar endpoint autenticado ou URL publica permitida, nao R2 privado.' };
  return { ok: true };
}

async function getTenantPropertyPackageOrResponse(
  c: ItemsContext,
  db: DbClient,
  propertyId: string,
  packageId: string,
  tenantId: string
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) {
    return { ok: false, response: err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404) };
  }

  const hasAccess = await assertPropertyAccess(
    c.env.DB,
    propertyId,
    c.get('userId'),
    c.get('userRole'),
    tenantId,
    c.get('tenantRole')
  );
  if (!hasAccess) return { ok: false, response: err(c, 'Sem acesso', 'FORBIDDEN', 403) };

  if (!(await ensureTenantPackage(db, tenantId, propertyId, packageId))) {
    return { ok: false, response: err(c, 'Dossie nao encontrado', 'NOT_FOUND', 404) };
  }
  return { ok: true };
}

function applyCompletionFields(
  patch: Partial<typeof handoverChecklistItems.$inferInsert>,
  input: {
    nextStatus?: HandoverChecklistItemStatus;
    oldStatus?: HandoverChecklistItemStatus;
    providedCompletedBy?: string | null;
    providedCompletedAt?: string | null;
    oldCompletedBy?: string | null;
    oldCompletedAt?: string | null;
    actorId: string;
    now: string;
    isCreate?: boolean;
  }
) {
  if (input.nextStatus === 'done') {
    if (input.providedCompletedBy !== undefined) patch.completedBy = optionalText(input.providedCompletedBy);
    else if (input.isCreate || !input.oldCompletedBy) patch.completedBy = input.actorId;

    if (input.providedCompletedAt !== undefined) patch.completedAt = optionalText(input.providedCompletedAt);
    else if (input.isCreate || !input.oldCompletedAt) patch.completedAt = input.now;
    return;
  }

  if (input.nextStatus && input.oldStatus === 'done') {
    // Reopened or invalidated items should not keep completion markers.
    patch.completedBy = null;
    patch.completedAt = null;
  }
}

handoverChecklistItemsRoute.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const packageId = c.req.param('packageId')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyPackageOrResponse(c, db, propertyId, packageId, tenantId);
  if (!context.ok) return context.response;

  const filters = handoverChecklistItemFilterSchema.safeParse({
    status: c.req.query('status'),
    category: c.req.query('category'),
    required: c.req.query('required'),
    roomId: c.req.query('room_id'),
    inventoryItemId: c.req.query('inventory_item_id'),
    documentId: c.req.query('document_id'),
    serviceOrderId: c.req.query('service_order_id'),
    condition: c.req.query('condition'),
  });
  if (!filters.success) return err(c, 'Filtros invalidos', 'VALIDATION_ERROR', 422, filters.error.flatten());

  const conditions = [
    eq(handoverChecklistItems.tenantId, tenantId),
    eq(handoverChecklistItems.propertyId, propertyId),
    eq(handoverChecklistItems.handoverPackageId, packageId),
    isNull(handoverChecklistItems.deletedAt),
  ];
  if (filters.data.status) conditions.push(eq(handoverChecklistItems.status, filters.data.status));
  if (filters.data.category) conditions.push(eq(handoverChecklistItems.category, filters.data.category));
  if (filters.data.required) conditions.push(eq(handoverChecklistItems.required, filters.data.required === 'true'));
  if (filters.data.roomId) conditions.push(eq(handoverChecklistItems.roomId, filters.data.roomId));
  if (filters.data.inventoryItemId) conditions.push(eq(handoverChecklistItems.inventoryItemId, filters.data.inventoryItemId));
  if (filters.data.documentId) conditions.push(eq(handoverChecklistItems.documentId, filters.data.documentId));
  if (filters.data.serviceOrderId) conditions.push(eq(handoverChecklistItems.serviceOrderId, filters.data.serviceOrderId));
  if (filters.data.condition) conditions.push(eq(handoverChecklistItems.condition, filters.data.condition));

  const items = await db
    .select(itemSelect)
    .from(handoverChecklistItems)
    .where(and(...conditions))
    .orderBy(asc(handoverChecklistItems.sortOrder), asc(handoverChecklistItems.createdAt)) as HandoverChecklistItemRow[];

  return ok(c, { items });
});

handoverChecklistItemsRoute.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const packageId = c.req.param('packageId')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyPackageOrResponse(c, db, propertyId, packageId, tenantId);
  if (!context.ok) return context.response;

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = handoverChecklistItemCreateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data;

  const references = await validateReferences(db, tenantId, propertyId, data);
  if (!references.ok) return err(c, references.message, references.responseCode, references.status);

  const completedBy = await validateCompletedBy(db, { tenantId, completedBy: data.completed_by });
  if (!completedBy.ok) return err(c, completedBy.message, completedBy.responseCode, completedBy.status);

  const evidence = validateEvidenceUrls(data.evidence_urls, c.env.R2_PUBLIC_URL);
  if (!evidence.ok) return err(c, evidence.message, 'INVALID_EVIDENCE_REFERENCE', 422);

  const now = new Date().toISOString();
  const insertData: typeof handoverChecklistItems.$inferInsert = {
    id: nanoid(),
    tenantId,
    propertyId,
    handoverPackageId: packageId,
    roomId: optionalText(data.room_id),
    inventoryItemId: optionalText(data.inventory_item_id),
    documentId: optionalText(data.document_id),
    serviceOrderId: optionalText(data.service_order_id),
    title: data.title.trim(),
    description: optionalText(data.description),
    category: data.category,
    required: data.required,
    status: data.status,
    condition: data.condition ?? null,
    evidenceUrls: data.evidence_urls,
    notes: optionalText(data.notes),
    sortOrder: data.sort_order,
    completedBy: optionalText(data.completed_by),
    completedAt: optionalText(data.completed_at),
  };
  applyCompletionFields(insertData, {
    nextStatus: data.status,
    providedCompletedBy: data.completed_by,
    providedCompletedAt: data.completed_at,
    actorId: userId,
    now,
    isCreate: true,
  });

  await db.insert(handoverChecklistItems).values(insertData);

  const [item] = await db
    .select(itemSelect)
    .from(handoverChecklistItems)
    .where(
      and(
        eq(handoverChecklistItems.id, insertData.id),
        eq(handoverChecklistItems.tenantId, tenantId),
        eq(handoverChecklistItems.propertyId, propertyId),
        eq(handoverChecklistItems.handoverPackageId, packageId),
        isNull(handoverChecklistItems.deletedAt)
      )
    )
    .limit(1) as HandoverChecklistItemRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_checklist_item',
    entityId: insertData.id,
    action: 'create',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: item,
  });

  return ok(c, { item }, 201);
});

handoverChecklistItemsRoute.get('/:itemId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const packageId = c.req.param('packageId')!;
  const itemId = c.req.param('itemId')!;
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyPackageOrResponse(c, db, propertyId, packageId, tenantId);
  if (!context.ok) return context.response;

  const [item] = await db
    .select(itemSelect)
    .from(handoverChecklistItems)
    .where(
      and(
        eq(handoverChecklistItems.id, itemId),
        eq(handoverChecklistItems.tenantId, tenantId),
        eq(handoverChecklistItems.propertyId, propertyId),
        eq(handoverChecklistItems.handoverPackageId, packageId),
        isNull(handoverChecklistItems.deletedAt)
      )
    )
    .limit(1) as HandoverChecklistItemRow[];

  if (!item) return err(c, 'Item do checklist nao encontrado', 'NOT_FOUND', 404);
  return ok(c, { item });
});

async function updateItem(
  c: ItemsContext,
  options: { statusOnly: boolean }
): Promise<Response> {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const packageId = c.req.param('packageId')!;
  const itemId = c.req.param('itemId')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyPackageOrResponse(c, db, propertyId, packageId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(itemSelect)
    .from(handoverChecklistItems)
    .where(
      and(
        eq(handoverChecklistItems.id, itemId),
        eq(handoverChecklistItems.tenantId, tenantId),
        eq(handoverChecklistItems.propertyId, propertyId),
        eq(handoverChecklistItems.handoverPackageId, packageId),
        isNull(handoverChecklistItems.deletedAt)
      )
    )
    .limit(1) as HandoverChecklistItemRow[];

  if (!old) return err(c, 'Item do checklist nao encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = options.statusOnly
    ? handoverChecklistItemStatusUpdateSchema.safeParse(body)
    : handoverChecklistItemUpdateSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const data = parsed.data as HandoverChecklistItemUpdateInput | HandoverChecklistItemStatusUpdateInput;

  if (!options.statusOnly) {
    const fullData = data as HandoverChecklistItemUpdateInput;
    const references = await validateReferences(db, tenantId, propertyId, fullData);
    if (!references.ok) return err(c, references.message, references.responseCode, references.status);
    const evidence = validateEvidenceUrls(fullData.evidence_urls, c.env.R2_PUBLIC_URL);
    if (!evidence.ok) return err(c, evidence.message, 'INVALID_EVIDENCE_REFERENCE', 422);
  }

  const completedBy = await validateCompletedBy(db, { tenantId, completedBy: data.completed_by });
  if (!completedBy.ok) return err(c, completedBy.message, completedBy.responseCode, completedBy.status);

  const patch: Partial<typeof handoverChecklistItems.$inferInsert> = {};
  if (!options.statusOnly) {
    const full = data as typeof handoverChecklistItemUpdateSchema._type;
    if (full.room_id !== undefined) patch.roomId = optionalText(full.room_id);
    if (full.inventory_item_id !== undefined) patch.inventoryItemId = optionalText(full.inventory_item_id);
    if (full.document_id !== undefined) patch.documentId = optionalText(full.document_id);
    if (full.service_order_id !== undefined) patch.serviceOrderId = optionalText(full.service_order_id);
    if (full.title !== undefined) patch.title = full.title.trim();
    if (full.description !== undefined) patch.description = optionalText(full.description);
    if (full.category !== undefined) patch.category = full.category;
    if (full.required !== undefined) patch.required = full.required;
    if (full.condition !== undefined) patch.condition = full.condition ?? null;
    if (full.evidence_urls !== undefined) patch.evidenceUrls = full.evidence_urls;
    if (full.sort_order !== undefined) patch.sortOrder = full.sort_order;
  }
  if (data.status !== undefined) patch.status = data.status;
  if (data.notes !== undefined) patch.notes = optionalText(data.notes);
  if (data.completed_by !== undefined) patch.completedBy = optionalText(data.completed_by);
  if (data.completed_at !== undefined) patch.completedAt = optionalText(data.completed_at);

  applyCompletionFields(patch, {
    nextStatus: data.status,
    oldStatus: old.status,
    providedCompletedBy: data.completed_by,
    providedCompletedAt: data.completed_at,
    oldCompletedBy: old.completed_by,
    oldCompletedAt: old.completed_at,
    actorId: userId,
    now: new Date().toISOString(),
  });

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');
  patch.updatedAt = new Date().toISOString();

  await db
    .update(handoverChecklistItems)
    .set(patch)
    .where(
      and(
        eq(handoverChecklistItems.id, itemId),
        eq(handoverChecklistItems.tenantId, tenantId),
        eq(handoverChecklistItems.propertyId, propertyId),
        eq(handoverChecklistItems.handoverPackageId, packageId),
        isNull(handoverChecklistItems.deletedAt)
      )
    );

  const [item] = await db
    .select(itemSelect)
    .from(handoverChecklistItems)
    .where(and(eq(handoverChecklistItems.id, itemId), eq(handoverChecklistItems.tenantId, tenantId), eq(handoverChecklistItems.propertyId, propertyId), eq(handoverChecklistItems.handoverPackageId, packageId)))
    .limit(1) as HandoverChecklistItemRow[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_checklist_item',
    entityId: itemId,
    action: data.status !== undefined && data.status !== old.status ? 'handover_checklist_item_status_changed' : 'update',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: item,
  });

  return ok(c, { item });
}

handoverChecklistItemsRoute.put('/:itemId', (c) => updateItem(c, { statusOnly: false }));
handoverChecklistItemsRoute.patch('/:itemId/status', (c) => updateItem(c, { statusOnly: true }));

handoverChecklistItemsRoute.delete('/:itemId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const packageId = c.req.param('packageId')!;
  const itemId = c.req.param('itemId')!;
  const tenantId = c.get('tenantId');
  const userId = c.get('userId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const context = await getTenantPropertyPackageOrResponse(c, db, propertyId, packageId, tenantId);
  if (!context.ok) return context.response;

  const [old] = await db
    .select(itemSelect)
    .from(handoverChecklistItems)
    .where(
      and(
        eq(handoverChecklistItems.id, itemId),
        eq(handoverChecklistItems.tenantId, tenantId),
        eq(handoverChecklistItems.propertyId, propertyId),
        eq(handoverChecklistItems.handoverPackageId, packageId),
        isNull(handoverChecklistItems.deletedAt)
      )
    )
    .limit(1) as HandoverChecklistItemRow[];

  if (!old) return err(c, 'Item do checklist nao encontrado', 'NOT_FOUND', 404);

  await db
    .update(handoverChecklistItems)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(and(eq(handoverChecklistItems.id, itemId), eq(handoverChecklistItems.tenantId, tenantId), eq(handoverChecklistItems.propertyId, propertyId), eq(handoverChecklistItems.handoverPackageId, packageId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'handover_checklist_item',
    entityId: itemId,
    action: 'delete',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default handoverChecklistItemsRoute;
