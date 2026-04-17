import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { uploadToR2, getPublicUrl } from '../lib/r2';
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
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const category = c.req.query('category');
  const roomId = c.req.query('room_id');

  const conditions: string[] = ['i.property_id = ?', 'i.deleted_at IS NULL'];
  const bindings: unknown[] = [propertyId];

  if (category && category !== 'undefined') { conditions.push('i.category = ?'); bindings.push(category); }
  if (roomId   && roomId   !== 'undefined') { conditions.push('i.room_id = ?');   bindings.push(roomId); }
  if (cursor)                               { conditions.push('i.created_at < ?'); bindings.push(cursor); }

  bindings.push(limit + 1);

  const { results } = await c.env.DB
    .prepare(
      `SELECT i.*, r.name as room_name
       FROM inventory_items i
       LEFT JOIN rooms r ON r.id = i.room_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.created_at DESC LIMIT ?`
    )
    .bind(...bindings)
    .all<InventoryItem & { room_name: string | null }>();

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── GET /properties/:propertyId/inventory/colors ─────────────────────────────

inventory.get('/colors', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { results } = await c.env.DB
    .prepare(
      `SELECT DISTINCT name, brand, color_code, lot_number, supplier, room_id, r.name as room_name
       FROM inventory_items i
       LEFT JOIN rooms r ON r.id = i.room_id
       WHERE i.property_id = ? AND i.category = 'paint' AND i.color_code IS NOT NULL AND i.deleted_at IS NULL
       ORDER BY i.name`
    )
    .bind(propertyId)
    .all();

  return ok(c, { colors: results });
});

// ── POST /properties/:propertyId/inventory ───────────────────────────────────

inventory.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
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

  await c.env.DB
    .prepare(
      `INSERT INTO inventory_items
       (id, property_id, room_id, category, name, brand, model, color_code, lot_number,
        supplier, quantity, unit, reserve_qty, storage_loc, price_paid, purchase_date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id, propertyId, d.room_id ?? null, d.category, d.name,
      d.brand ?? null, d.model ?? null, d.color_code ?? null, d.lot_number ?? null,
      d.supplier ?? null, d.quantity, d.unit, d.reserve_qty, d.storage_loc ?? null,
      d.price_paid ?? null, d.purchase_date ?? null, d.notes ?? null
    )
    .run();

  const item = await c.env.DB
    .prepare('SELECT * FROM inventory_items WHERE id = ?')
    .bind(id)
    .first<InventoryItem>();

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item', entityId: id, action: 'create',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), newData: item,
  });

  return ok(c, { item }, 201);
});

// ── GET /properties/:propertyId/inventory/:id ────────────────────────────────

inventory.get('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const item = await c.env.DB
    .prepare(
      `SELECT i.*, r.name as room_name FROM inventory_items i
       LEFT JOIN rooms r ON r.id = i.room_id
       WHERE i.id = ? AND i.property_id = ? AND i.deleted_at IS NULL`
    )
    .bind(id, propertyId)
    .first<InventoryItem & { room_name: string | null }>();

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  return ok(c, { item });
});

// ── PUT /properties/:propertyId/inventory/:id ────────────────────────────────

inventory.put('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM inventory_items WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<InventoryItem>();

  if (!old) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const pairs: [string, unknown][] = Object.entries({
    room_id: d.room_id, category: d.category, name: d.name,
    brand: d.brand, model: d.model, color_code: d.color_code,
    lot_number: d.lot_number, supplier: d.supplier, quantity: d.quantity,
    unit: d.unit, reserve_qty: d.reserve_qty, storage_loc: d.storage_loc,
    price_paid: d.price_paid, purchase_date: d.purchase_date, notes: d.notes,
  }).filter(([, v]) => v !== undefined);

  if (pairs.length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await c.env.DB
    .prepare(`UPDATE inventory_items SET ${pairs.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...pairs.map(([, v]) => v), id)
    .run();

  const updated = await c.env.DB
    .prepare('SELECT * FROM inventory_items WHERE id = ?')
    .bind(id)
    .first<InventoryItem>();

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item', entityId: id, action: 'update',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old, newData: updated,
  });

  return ok(c, { item: updated });
});

// ── DELETE /properties/:propertyId/inventory/:id ─────────────────────────────

inventory.delete('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM inventory_items WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<InventoryItem>();

  if (!old) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  await c.env.DB
    .prepare(`UPDATE inventory_items SET deleted_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

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
  const propertyId = c.req.param('propertyId');
  const itemId = c.req.param('itemId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const item = await c.env.DB
    .prepare('SELECT id FROM inventory_items WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(itemId, propertyId)
    .first();

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

  await c.env.DB
    .prepare(`UPDATE inventory_items SET photo_url = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(photoUrl, itemId)
    .run();

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
  const propertyId = c.req.param('propertyId');
  const itemId = c.req.param('itemId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const item = await c.env.DB
    .prepare('SELECT id FROM inventory_items WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(itemId, propertyId)
    .first();

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const qrValue = `houselog://inventory/${itemId}`;

  await c.env.DB
    .prepare(`UPDATE inventory_items SET qr_code = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(qrValue, itemId)
    .run();

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
