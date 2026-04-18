import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { uploadToR2, getPublicUrl } from '../lib/r2';
import { getDb } from '../db/client';
import { inventoryItems, rooms } from '../db/schema';
import type { Bindings, Variables, InventoryItem } from '../lib/types';

const inventory = new Hono<{ Bindings: Bindings; Variables: Variables }>();

inventory.use('*', authMiddleware);

const createSchema = z.object({
  category: z.enum(['paint', 'tile', 'waterproof', 'plumbing', 'electrical', 'hardware', 'adhesive', 'sealant', 'other']),
  name: z.string().min(1),
  room_id: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color_code: z.string().optional(),
  lot_number: z.string().optional(),
  supplier: z.string().optional(),
  quantity: z.number().min(0).default(0),
  unit: z.string().default('un'),
  reserve_qty: z.number().min(0).default(0),
  storage_loc: z.string().optional(),
  price_paid: z.number().positive().optional(),
  purchase_date: z.string().optional(),
  notes: z.string().optional(),
});

// ── GET /properties/:propertyId/inventory ────────────────────────────────────

inventory.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const category = c.req.query('category');
  const roomId = c.req.query('room_id');

  const filters = [eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)];
  if (category && category !== 'undefined') {
    filters.push(eq(inventoryItems.category, category as typeof inventoryItems.$inferSelect.category));
  }
  if (roomId && roomId !== 'undefined') filters.push(eq(inventoryItems.roomId, roomId));
  if (cursor) filters.push(lt(inventoryItems.createdAt, cursor));

  const results = await db
    .select({
      id: inventoryItems.id,
      property_id: inventoryItems.propertyId,
      room_id: inventoryItems.roomId,
      category: inventoryItems.category,
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      model: inventoryItems.model,
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
      room_name: rooms.name,
    })
    .from(inventoryItems)
    .leftJoin(rooms, eq(rooms.id, inventoryItems.roomId))
    .where(and(...filters))
    .orderBy(desc(inventoryItems.createdAt))
    .limit(limit + 1) as Array<InventoryItem & { room_name: string | null }>;

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── GET /properties/:propertyId/inventory/colors ─────────────────────────────

inventory.get('/colors', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
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

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const id = nanoid();

  await db.insert(inventoryItems).values({
    id,
    propertyId,
    roomId: d.room_id ?? null,
    category: d.category,
    name: d.name,
    brand: d.brand ?? null,
    model: d.model ?? null,
    colorCode: d.color_code ?? null,
    lotNumber: d.lot_number ?? null,
    supplier: d.supplier ?? null,
    quantity: d.quantity,
    unit: d.unit,
    reserveQty: d.reserve_qty,
    storageLoc: d.storage_loc ?? null,
    pricePaid: d.price_paid ?? null,
    purchaseDate: d.purchase_date ?? null,
    notes: d.notes ?? null,
  });

  const [item] = await db
    .select({
      id: inventoryItems.id,
      property_id: inventoryItems.propertyId,
      room_id: inventoryItems.roomId,
      category: inventoryItems.category,
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      model: inventoryItems.model,
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
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1) as InventoryItem[];

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item', entityId: id, action: 'create',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), newData: item,
  });

  return ok(c, { item }, 201);
});

// ── GET /properties/:propertyId/inventory/:id ────────────────────────────────

inventory.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [item] = await db
    .select({
      id: inventoryItems.id,
      property_id: inventoryItems.propertyId,
      room_id: inventoryItems.roomId,
      category: inventoryItems.category,
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      model: inventoryItems.model,
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
      room_name: rooms.name,
    })
    .from(inventoryItems)
    .leftJoin(rooms, eq(rooms.id, inventoryItems.roomId))
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
    .limit(1) as Array<InventoryItem & { room_name: string | null }>;

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  return ok(c, { item });
});

// ── PUT /properties/:propertyId/inventory/:id ────────────────────────────────

inventory.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: inventoryItems.id,
      property_id: inventoryItems.propertyId,
      room_id: inventoryItems.roomId,
      category: inventoryItems.category,
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      model: inventoryItems.model,
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
    })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
    .limit(1) as InventoryItem[];

  if (!old) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const patch: Partial<typeof inventoryItems.$inferInsert> = {};
  if (d.room_id !== undefined) patch.roomId = d.room_id;
  if (d.category !== undefined) patch.category = d.category;
  if (d.name !== undefined) patch.name = d.name;
  if (d.brand !== undefined) patch.brand = d.brand;
  if (d.model !== undefined) patch.model = d.model;
  if (d.color_code !== undefined) patch.colorCode = d.color_code;
  if (d.lot_number !== undefined) patch.lotNumber = d.lot_number;
  if (d.supplier !== undefined) patch.supplier = d.supplier;
  if (d.quantity !== undefined) patch.quantity = d.quantity;
  if (d.unit !== undefined) patch.unit = d.unit;
  if (d.reserve_qty !== undefined) patch.reserveQty = d.reserve_qty;
  if (d.storage_loc !== undefined) patch.storageLoc = d.storage_loc;
  if (d.price_paid !== undefined) patch.pricePaid = d.price_paid;
  if (d.purchase_date !== undefined) patch.purchaseDate = d.purchase_date;
  if (d.notes !== undefined) patch.notes = d.notes;

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db.update(inventoryItems).set(patch).where(eq(inventoryItems.id, id));

  const [updated] = await db
    .select({
      id: inventoryItems.id,
      property_id: inventoryItems.propertyId,
      room_id: inventoryItems.roomId,
      category: inventoryItems.category,
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      model: inventoryItems.model,
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
    })
    .from(inventoryItems)
    .where(eq(inventoryItems.id, id))
    .limit(1) as InventoryItem[];

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item', entityId: id, action: 'update',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old, newData: updated,
  });

  return ok(c, { item: updated });
});

// ── DELETE /properties/:propertyId/inventory/:id ─────────────────────────────

inventory.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: inventoryItems.id,
      property_id: inventoryItems.propertyId,
      room_id: inventoryItems.roomId,
      category: inventoryItems.category,
      name: inventoryItems.name,
      brand: inventoryItems.brand,
      model: inventoryItems.model,
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
    })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, id), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
    .limit(1) as InventoryItem[];

  if (!old) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  await db
    .update(inventoryItems)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(inventoryItems.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item', entityId: id, action: 'delete',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), oldData: old,
  });

  return ok(c, { success: true });
});

// ── POST /properties/:propertyId/inventory/:itemId/photo ─────────────────────

const PHOTO_ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

inventory.post('/:itemId/photo', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const itemId = c.req.param('itemId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [item] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
    .limit(1);

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const photo = formData.get('photo') as File | null;
  if (!photo) return err(c, 'Campo "photo" ausente', 'MISSING_FILE', 422);

  if (!PHOTO_ALLOWED.has(photo.type)) {
    return err(c, 'Formato inválido. Use jpg, png ou webp', 'INVALID_FILE_TYPE', 422);
  }
  if (photo.size > PHOTO_MAX_BYTES) {
    return err(c, 'Arquivo excede o limite de 5MB', 'FILE_TOO_LARGE', 422);
  }

  const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const key = `properties/${propertyId}/inventory/${itemId}/${Date.now()}.${ext}`;

  const buffer = await photo.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, photo.type);

  const photoUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  await db
    .update(inventoryItems)
    .set({ photoUrl })
    .where(eq(inventoryItems.id, itemId));

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item',
    entityId: itemId,
    action: 'PHOTO_UPLOAD',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: { photo_url: photoUrl },
  });

  return ok(c, { photo_url: photoUrl });
});

// ── POST /properties/:propertyId/inventory/:itemId/qr ────────────────────────

inventory.post('/:itemId/qr', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const itemId = c.req.param('itemId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [item] = await db
    .select({ id: inventoryItems.id })
    .from(inventoryItems)
    .where(and(eq(inventoryItems.id, itemId), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt)))
    .limit(1);

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const qrValue = `houselog://inventory/${itemId}`;

  await db
    .update(inventoryItems)
    .set({ qrCode: qrValue })
    .where(eq(inventoryItems.id, itemId));

  await writeAuditLog(c.env.DB, {
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
