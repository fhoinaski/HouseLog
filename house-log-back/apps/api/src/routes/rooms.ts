import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import type { Bindings, Variables, Room } from '../lib/types';

const rooms = new Hono<{ Bindings: Bindings; Variables: Variables }>();

rooms.use('*', authMiddleware);

const schema = z.object({
  name: z.string().min(1),
  type: z.enum(['bedroom', 'bathroom', 'kitchen', 'living', 'garage', 'laundry', 'external', 'roof', 'other']),
  floor: z.number().int().default(0),
  area_m2: z.number().positive().optional(),
  notes: z.string().optional(),
});

// ── GET /properties/:propertyId/rooms ────────────────────────────────────────

rooms.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const { results } = await c.env.DB
    .prepare(
      `SELECT * FROM rooms WHERE property_id = ? AND deleted_at IS NULL ORDER BY floor ASC, name ASC`
    )
    .bind(propertyId)
    .all<Room>();

  return ok(c, { rooms: results });
});

// ── POST /properties/:propertyId/rooms ───────────────────────────────────────

rooms.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { name, type, floor, area_m2, notes } = parsed.data;
  const id = nanoid();

  await c.env.DB
    .prepare(
      `INSERT INTO rooms (id, property_id, name, type, floor, area_m2, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(id, propertyId, name, type, floor, area_m2 ?? null, notes ?? null)
    .run();

  const room = await c.env.DB
    .prepare('SELECT * FROM rooms WHERE id = ?')
    .bind(id)
    .first<Room>();

  await writeAuditLog(c.env.DB, {
    entityType: 'room',
    entityId: id,
    action: 'create',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: room,
  });

  return ok(c, { room }, 201);
});

// ── GET /properties/:propertyId/rooms/:id ────────────────────────────────────

rooms.get('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const room = await c.env.DB
    .prepare('SELECT * FROM rooms WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<Room>();

  if (!room) return err(c, 'Cômodo não encontrado', 'NOT_FOUND', 404);

  return ok(c, { room });
});

// ── PUT /properties/:propertyId/rooms/:id ────────────────────────────────────

rooms.put('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM rooms WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<Room>();

  if (!old) return err(c, 'Cômodo não encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const data = parsed.data;
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined)   { fields.push('name = ?');    values.push(data.name); }
  if (data.type !== undefined)   { fields.push('type = ?');    values.push(data.type); }
  if (data.floor !== undefined)  { fields.push('floor = ?');   values.push(data.floor); }
  if (data.area_m2 !== undefined){ fields.push('area_m2 = ?'); values.push(data.area_m2); }
  if (data.notes !== undefined)  { fields.push('notes = ?');   values.push(data.notes); }

  if (fields.length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await c.env.DB
    .prepare(`UPDATE rooms SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<Room>();

  await writeAuditLog(c.env.DB, {
    entityType: 'room', entityId: id, action: 'update',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old, newData: updated,
  });

  return ok(c, { room: updated });
});

// ── DELETE /properties/:propertyId/rooms/:id ─────────────────────────────────

rooms.delete('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM rooms WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<Room>();

  if (!old) return err(c, 'Cômodo não encontrado', 'NOT_FOUND', 404);

  await c.env.DB
    .prepare(`UPDATE rooms SET deleted_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'room', entityId: id, action: 'delete',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default rooms;
