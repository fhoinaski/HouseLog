import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { validateUpload, buildR2Key, uploadToR2, getPublicUrl } from '../lib/r2';
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

  const conditions: string[] = ['property_id = ?', 'deleted_at IS NULL'];
  const bindings: unknown[] = [propertyId];

  if (category) { conditions.push('category = ?'); bindings.push(category); }
  if (roomId)   { conditions.push('room_id = ?');   bindings.push(roomId); }
  if (cursor)   { conditions.push('created_at < ?'); bindings.push(cursor); }

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

// ── POST /inventory/:id/photo — upload photo to R2 ───────────────────────────

inventory.post('/:id/photo', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const item = await c.env.DB
    .prepare('SELECT id FROM inventory_items WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first();

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const validation = validateUpload(file.type, file.size);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'inventory', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);

  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  await c.env.DB
    .prepare('UPDATE inventory_items SET photo_url = ? WHERE id = ?')
    .bind(fileUrl, id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item', entityId: id, action: 'photo_upload',
    actorId: userId, newData: { photo_url: fileUrl },
  });

  return ok(c, { photo_url: fileUrl });
});

// ── POST /properties/:propertyId/inventory/:id/qr ────────────────────────────
// Generate a QR code data URL for the item (links to the app item view)

inventory.post('/:id/qr', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const item = await c.env.DB
    .prepare('SELECT id, name FROM inventory_items WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<{ id: string; name: string }>();

  if (!item) return err(c, 'Item não encontrado', 'NOT_FOUND', 404);

  // QR content is a deep-link URL to the item in the frontend
  const corsOrigin = c.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const qrContent = `${corsOrigin}/properties/${propertyId}/inventory?item=${id}`;

  // Simple SVG QR code generation using Workers (no external lib needed)
  // We encode the URL as a text QR payload and return it as a dataURL
  // In production you'd call an external QR service or use a Wasm module
  const qrPayload = {
    content: qrContent,
    item_id: id,
    item_name: item.name,
    property_id: propertyId,
  };

  // Store qr_code on the item
  const qrCode = btoa(JSON.stringify(qrPayload));
  await c.env.DB
    .prepare('UPDATE inventory_items SET qr_code = ? WHERE id = ?')
    .bind(qrCode, id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'inventory_item', entityId: id, action: 'qr_generate',
    actorId: userId, newData: { qr_content: qrContent },
  });

  return ok(c, { qr_content: qrContent, qr_code: qrCode });
});

export default inventory;
