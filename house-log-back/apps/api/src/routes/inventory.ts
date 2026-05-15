import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import {
  uploadToR2,
  buildR2Key,
  extractR2KeyFromPublicUrl,
  validatePrivateUpload,
} from '../lib/r2';
import { extractLabelData } from '../lib/ai';
import {
  canAssignRoomToInventory,
  inventoryPhotoEndpoint,
  withInventoryPhotoEndpoint,
} from '../lib/inventory-tenant';
import { getDb } from '../db/client';
import { inventoryItems, rooms } from '../db/schema';
import { inventoryCreateSchema } from '@houselog/contracts';
import type { Bindings, Variables, InventoryItem } from '../lib/types';

const inventory = new Hono<{ Bindings: Bindings; Variables: Variables }>();

inventory.use('*', authMiddleware);
inventory.use('*', resolveTenant);

const createSchema = inventoryCreateSchema;

// Re-export so handlers stay readable. Actual logic lives in inventory-tenant.ts.
const photoEndpoint = inventoryPhotoEndpoint;
const withPhotoEndpoint = withInventoryPhotoEndpoint as <T extends InventoryItem>(item: T, propertyId: string) => T;

const inventorySelect = {
  id: inventoryItems.id,
  property_id: inventoryItems.propertyId,
  room_id: inventoryItems.roomId,
  category: inventoryItems.category,
  name: inventoryItems.name,
  brand: inventoryItems.brand,
  model: inventoryItems.model,
  serial_number: inventoryItems.serialNumber,
  color_code: inventoryItems.colorCode,
  lot_number: inventoryItems.lotNumber,
  supplier: inventoryItems.supplier,
  quantity: inventoryItems.quantity,
  unit: inventoryItems.unit,
  reserve_qty: inventoryItems.reserveQty,
  storage_loc: inventoryItems.storageLoc,
  photo_url: inventoryItems.photoUrl,
  qr_code: inventoryItems.qrCode,
  price_paid: inventoryItems.pricePaid,
  purchase_date: inventoryItems.purchaseDate,
  warranty_until: inventoryItems.warrantyUntil,
  notes: inventoryItems.notes,
  created_at: inventoryItems.createdAt,
  deleted_at: inventoryItems.deletedAt,
};

// ── GET /properties/:propertyId/inventory ────────────────────────────────────

inventory.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const category = c.req.query('category');
  const roomId = c.req.query('room_id');

  const filters = [
    eq(inventoryItems.propertyId, propertyId),
    eq(inventoryItems.tenantId, tenantId),
    isNull(inventoryItems.deletedAt),
  ];
  if (category && category !== 'undefined') {
    filters.push(eq(inventoryItems.category, category as typeof inventoryItems.$inferSelect.category));
  }
  if (roomId && roomId !== 'undefined') filters.push(eq(inventoryItems.roomId, roomId));
  if (cursor) filters.push(lt(inventoryItems.createdAt, cursor));

  const results = await db
    .select({ ...inventorySelect, room_name: rooms.name })
    .from(inventoryItems)
    .leftJoin(rooms, eq(rooms.id, inventoryItems.roomId))
    .where(and(...filters))
    .orderBy(desc(inventoryItems.createdAt))
    .limit(limit + 1) as Array<InventoryItem & { room_name: string | null }>;

  const mapped = results.map((item) => withPhotoEndpoint(item, propertyId));
  return ok(c, paginate(mapped, limit, 'created_at'));
});

// ── GET /properties/:propertyId/inventory/colors ─────────────────────────────

inventory.get('/colors', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .selectDistinct({
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      color_code: inventoryItems.colorCode,
      lot_number: inventoryItems.lotNumber,
      supplier: inventoryItems.supplier,
      room_id: inventoryItems.roomId,
      room_name: rooms.name,
    })
    .from(inventoryItems)
    .leftJoin(rooms, eq(rooms.id, inventoryItems.roomId))
    .where(
      and(
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        eq(inventoryItems.category, 'paint'),
        isNotNull(inventoryItems.colorCode),
        isNull(inventoryItems.deletedAt)
      )
    )
    .orderBy(asc(inventoryItems.name));

  return ok(c, { colors: results });
});

// ── POST /properties/:propertyId/inventory ───────────────────────────────────

inventory.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;

  if (d.room_id) {
    const [room] = await db
      .select({ tenantId: rooms.tenantId, propertyId: rooms.propertyId })
      .from(rooms)
      .where(
        and(
          eq(rooms.id, d.room_id),
          eq(rooms.tenantId, tenantId),
          eq(rooms.propertyId, propertyId),
          isNull(rooms.deletedAt)
        )
      )
      .limit(1);
    if (!room) return err(c, 'Ambiente não encontrado', 'NOT_FOUND', 404);
    const decision = canAssignRoomToInventory({
      activeTenantId: tenantId,
      roomTenantId: room.tenantId,
      roomPropertyId: room.propertyId,
      requestedPropertyId: propertyId,
    });
    if (!decision.allowed) return err(c, 'Ambiente não pertence a este imóvel', decision.code, decision.status);
  }

  const id = nanoid();

  await db.insert(inventoryItems).values({
    id,
    tenantId,
    propertyId,
    roomId: d.room_id ?? null,
    category: d.category,
    name: d.name,
    brand: d.brand ?? null,
    model: d.model ?? null,
    serialNumber: d.serial_number ?? null,
    colorCode: d.color_code ?? null,
    lotNumber: d.lot_number ?? null,
    supplier: d.supplier ?? null,
    quantity: d.quantity,
    unit: d.unit,
    reserveQty: d.reserve_qty,
    storageLoc: d.storage_loc ?? null,
    pricePaid: d.price_paid ?? null,
    purchaseDate: d.purchase_date ?? null,
    warrantyUntil: d.warranty_until ?? null,
    notes: d.notes ?? null,
  });

  const [item] = await db
    .select(inventorySelect)
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.propertyId, propertyId)))
    .limit(1) as InventoryItem[];

  if (!item) return err(c, 'Erro ao criar item', 'CREATE_ERROR', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'inventory_item', entityId: id, action: 'create',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), newData: item,
  });

  return ok(c, { item: withPhotoEndpoint(item, propertyId) }, 201);
});

// ── GET /properties/:propertyId/inventory/:itemId/photo ───────────────────────
// Must be defined before /:id to avoid shadowing.

inventory.get('/:itemId/photo', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const itemId = c.req.param('itemId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return c.json({ error: 'Sem acesso', code: 'FORBIDDEN' }, 403);

  const [item] = await db
    .select({ photoUrl: inventoryItems.photoUrl })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt)
      )
    )
    .limit(1);

  if (!item) return c.json({ error: 'Item não encontrado', code: 'NOT_FOUND' }, 404);
  if (!item.photoUrl) return c.json({ error: 'Foto não encontrada', code: 'NOT_FOUND' }, 404);

  const key = extractR2KeyFromPublicUrl(item.photoUrl, c.env.R2_PUBLIC_URL);
  const object = await c.env.STORAGE.get(key);
  if (!object) return c.json({ error: 'Arquivo não encontrado', code: 'NOT_FOUND' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=60');

  return new Response(object.body, { headers });
});

// ── GET /properties/:propertyId/inventory/:id ────────────────────────────────

inventory.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [item] = await db
    .select({ ...inventorySelect, room_name: rooms.name })
    .from(inventoryItems)
    .leftJoin(rooms, eq(rooms.id, inventoryItems.roomId))
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt)
      )
    )
    .limit(1) as Array<InventoryItem & { room_name: string | null }>;

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  return ok(c, { item: withPhotoEndpoint(item, propertyId) });
});

// ── PUT /properties/:propertyId/inventory/:id ────────────────────────────────

inventory.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select(inventorySelect)
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt)
      )
    )
    .limit(1) as InventoryItem[];

  if (!old) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;

  if (d.room_id !== undefined && d.room_id !== null) {
    const [room] = await db
      .select({ tenantId: rooms.tenantId, propertyId: rooms.propertyId })
      .from(rooms)
      .where(
        and(
          eq(rooms.id, d.room_id),
          eq(rooms.tenantId, tenantId),
          eq(rooms.propertyId, propertyId),
          isNull(rooms.deletedAt)
        )
      )
      .limit(1);
    if (!room) return err(c, 'Ambiente não encontrado', 'NOT_FOUND', 404);
    const decision = canAssignRoomToInventory({
      activeTenantId: tenantId,
      roomTenantId: room.tenantId,
      roomPropertyId: room.propertyId,
      requestedPropertyId: propertyId,
    });
    if (!decision.allowed) return err(c, 'Ambiente não pertence a este imóvel', decision.code, decision.status);
  }

  const patch: Partial<typeof inventoryItems.$inferInsert> = {};
  if (d.room_id !== undefined) patch.roomId = d.room_id;
  if (d.category !== undefined) patch.category = d.category;
  if (d.name !== undefined) patch.name = d.name;
  if (d.brand !== undefined) patch.brand = d.brand;
  if (d.model !== undefined) patch.model = d.model;
  if (d.serial_number !== undefined) patch.serialNumber = d.serial_number;
  if (d.color_code !== undefined) patch.colorCode = d.color_code;
  if (d.lot_number !== undefined) patch.lotNumber = d.lot_number;
  if (d.supplier !== undefined) patch.supplier = d.supplier;
  if (d.quantity !== undefined) patch.quantity = d.quantity;
  if (d.unit !== undefined) patch.unit = d.unit;
  if (d.reserve_qty !== undefined) patch.reserveQty = d.reserve_qty;
  if (d.storage_loc !== undefined) patch.storageLoc = d.storage_loc;
  if (d.price_paid !== undefined) patch.pricePaid = d.price_paid;
  if (d.purchase_date !== undefined) patch.purchaseDate = d.purchase_date;
  if (d.warranty_until !== undefined) patch.warrantyUntil = d.warranty_until;
  if (d.notes !== undefined) patch.notes = d.notes;

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db
    .update(inventoryItems)
    .set(patch)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)));

  const [updated] = await db
    .select(inventorySelect)
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1) as InventoryItem[];

  if (!updated) return err(c, 'Erro ao atualizar item', 'UPDATE_ERROR', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'inventory_item', entityId: id, action: 'update',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old, newData: updated,
  });

  return ok(c, { item: withPhotoEndpoint(updated, propertyId) });
});

// ── DELETE /properties/:propertyId/inventory/:id ─────────────────────────────

inventory.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select(inventorySelect)
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, id),
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt)
      )
    )
    .limit(1) as InventoryItem[];

  if (!old) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  await db
    .update(inventoryItems)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.tenantId, tenantId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'inventory_item', entityId: id, action: 'delete',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), oldData: old,
  });

  return ok(c, { success: true });
});

// ── POST /properties/:propertyId/inventory/:itemId/photo ──────────────────────

const PHOTO_ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

inventory.post('/:itemId/photo', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const itemId = c.req.param('itemId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [item] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt)
      )
    )
    .limit(1);

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const photo = formData.get('photo') as File | null;
  if (!photo) return err(c, 'Campo "photo" ausente', 'MISSING_FILE', 422);

  // Restrict to images only — original behaviour (jpeg/png/webp).
  if (!PHOTO_ALLOWED.has(photo.type)) {
    return err(c, 'Formato inválido. Use jpg, png ou webp', 'INVALID_FILE_TYPE', 422);
  }
  if (photo.size > PHOTO_MAX_BYTES) {
    return err(c, 'Arquivo excede o limite de 5MB', 'FILE_TOO_LARGE', 422);
  }

  // Additional extension + dangerous-extension check from the private-upload policy.
  const validation = validatePrivateUpload(photo.type, photo.size, photo.name);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'inventory', filename: photo.name });

  const buffer = await photo.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, photo.type);

  // Store the R2 key (not a public URL) — served via authenticated endpoint.
  await db
    .update(inventoryItems)
    .set({ photoUrl: key })
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.tenantId, tenantId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'inventory_item',
    entityId: itemId,
    action: 'PHOTO_UPLOAD',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: { photo_endpoint: photoEndpoint(propertyId, itemId) },
  });

  return ok(c, { photo_url: photoEndpoint(propertyId, itemId) });
});

// ── POST /properties/:propertyId/inventory/:itemId/label-ocr ─────────────────
// Extrai dados de uma etiqueta técnica via Workers AI (llava).
// NUNCA salva automaticamente — retorna campos sugeridos para revisão do usuário.
// Segurança: valida tenant + property + item antes de chamar a IA.

inventory.post('/:itemId/label-ocr', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const itemId = c.req.param('itemId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  // 1. Validar acesso ao imóvel (tenant + property)
  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  // 2. Validar que o item pertence a este tenant + property (defense-in-depth)
  const [item] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt)
      )
    )
    .limit(1);

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  // 3. Aceitar imagem da etiqueta via multipart
  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Campo "file" ausente', 'MISSING_FILE', 422);

  // Validar MIME e tamanho antes de qualquer chamada à IA
  if (!PHOTO_ALLOWED.has(file.type)) {
    return err(c, 'Formato inválido. Use jpg, png ou webp', 'INVALID_FILE_TYPE', 422);
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return err(c, 'Arquivo excede o limite de 5MB', 'FILE_TOO_LARGE', 422);
  }
  if (file.size === 0) {
    return err(c, 'Arquivo vazio', 'EMPTY_FILE', 422);
  }

  // 4. Chamar IA — resposta validada por Zod dentro de extractLabelData
  let extraction;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    extraction = await extractLabelData(c.env.AI, c.env.DB, bytes);
  } catch (e) {
    return err(c, 'Falha na extração de dados da etiqueta', 'AI_ERROR', 503, { message: String(e) });
  }

  // 5. Auditoria: registrar chamada de OCR (sem conteúdo bruto da imagem ou rawExtractedText)
  const foundFields = (['manufacturer', 'model', 'serialNumber', 'capacity', 'voltage', 'manufactureDate', 'warrantyUntil'] as const)
    .filter((k) => extraction[k] !== null).length;

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'inventory_item',
    entityId: itemId,
    action: 'label_ocr',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: { confidence: extraction.confidence, fields_found: foundFields },
  });

  // 6. Retornar sugestões — o usuário deve confirmar antes de salvar
  return ok(c, { extraction });
});

// ── POST /properties/:propertyId/inventory/:itemId/qr ────────────────────────

inventory.post('/:itemId/qr', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const itemId = c.req.param('itemId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [item] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.id, itemId),
        eq(inventoryItems.propertyId, propertyId),
        eq(inventoryItems.tenantId, tenantId),
        isNull(inventoryItems.deletedAt)
      )
    )
    .limit(1);

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const qrValue = `houselog://inventory/${itemId}`;

  await db
    .update(inventoryItems)
    .set({ qrCode: qrValue })
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.tenantId, tenantId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'inventory_item',
    entityId: itemId,
    action: 'QR_GENERATED',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: { qr_value: qrValue },
  });

  return ok(c, { qr_value: qrValue, item_id: itemId });
});

export default inventory;
