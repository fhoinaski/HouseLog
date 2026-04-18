import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { getDb } from '../db/client';
import { rooms as roomsTable } from '../db/schema';
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
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso a este imóvel', 'FORBIDDEN', 403);

  const results = await db
    .select({
      id: roomsTable.id,
      property_id: roomsTable.propertyId,
      name: roomsTable.name,
      type: roomsTable.type,
      floor: roomsTable.floor,
      area_m2: roomsTable.areaM2,
      notes: roomsTable.notes,
      created_at: roomsTable.createdAt,
      deleted_at: roomsTable.deletedAt,
    })
    .from(roomsTable)
    .where(and(eq(roomsTable.propertyId, propertyId), isNull(roomsTable.deletedAt)))
    .orderBy(asc(roomsTable.floor), asc(roomsTable.name)) as Room[];

  return ok(c, { rooms: results });
});

// ── POST /properties/:propertyId/rooms ───────────────────────────────────────

rooms.post('/', async (c) => {
  const db = getDb(c.env.DB);
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

  await db.insert(roomsTable).values({
    id,
    propertyId,
    name,
    type,
    floor,
    areaM2: area_m2 ?? null,
    notes: notes ?? null,
  });

  const [room] = await db
    .select({
      id: roomsTable.id,
      property_id: roomsTable.propertyId,
      name: roomsTable.name,
      type: roomsTable.type,
      floor: roomsTable.floor,
      area_m2: roomsTable.areaM2,
      notes: roomsTable.notes,
      created_at: roomsTable.createdAt,
      deleted_at: roomsTable.deletedAt,
    })
    .from(roomsTable)
    .where(eq(roomsTable.id, id))
    .limit(1) as Room[];

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
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [room] = await db
    .select({
      id: roomsTable.id,
      property_id: roomsTable.propertyId,
      name: roomsTable.name,
      type: roomsTable.type,
      floor: roomsTable.floor,
      area_m2: roomsTable.areaM2,
      notes: roomsTable.notes,
      created_at: roomsTable.createdAt,
      deleted_at: roomsTable.deletedAt,
    })
    .from(roomsTable)
    .where(
      and(
        eq(roomsTable.id, id),
        eq(roomsTable.propertyId, propertyId),
        isNull(roomsTable.deletedAt)
      )
    )
    .limit(1) as Room[];

  if (!room) return err(c, 'Cômodo não encontrado', 'NOT_FOUND', 404);

  return ok(c, { room });
});

// ── PUT /properties/:propertyId/rooms/:id ────────────────────────────────────

rooms.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: roomsTable.id,
      property_id: roomsTable.propertyId,
      name: roomsTable.name,
      type: roomsTable.type,
      floor: roomsTable.floor,
      area_m2: roomsTable.areaM2,
      notes: roomsTable.notes,
      created_at: roomsTable.createdAt,
      deleted_at: roomsTable.deletedAt,
    })
    .from(roomsTable)
    .where(
      and(
        eq(roomsTable.id, id),
        eq(roomsTable.propertyId, propertyId),
        isNull(roomsTable.deletedAt)
      )
    )
    .limit(1) as Room[];

  if (!old) return err(c, 'Cômodo não encontrado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = schema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const data = parsed.data;
  const patch: Partial<typeof roomsTable.$inferInsert> = {};

  if (data.name !== undefined) patch.name = data.name;
  if (data.type !== undefined) patch.type = data.type;
  if (data.floor !== undefined) patch.floor = data.floor;
  if (data.area_m2 !== undefined) patch.areaM2 = data.area_m2;
  if (data.notes !== undefined) patch.notes = data.notes;

  if (Object.keys(patch).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db.update(roomsTable).set(patch).where(eq(roomsTable.id, id));

  const [updated] = await db
    .select({
      id: roomsTable.id,
      property_id: roomsTable.propertyId,
      name: roomsTable.name,
      type: roomsTable.type,
      floor: roomsTable.floor,
      area_m2: roomsTable.areaM2,
      notes: roomsTable.notes,
      created_at: roomsTable.createdAt,
      deleted_at: roomsTable.deletedAt,
    })
    .from(roomsTable)
    .where(eq(roomsTable.id, id))
    .limit(1) as Room[];

  await writeAuditLog(c.env.DB, {
    entityType: 'room', entityId: id, action: 'update',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old, newData: updated,
  });

  return ok(c, { room: updated });
});

// ── DELETE /properties/:propertyId/rooms/:id ─────────────────────────────────

rooms.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: roomsTable.id,
      property_id: roomsTable.propertyId,
      name: roomsTable.name,
      type: roomsTable.type,
      floor: roomsTable.floor,
      area_m2: roomsTable.areaM2,
      notes: roomsTable.notes,
      created_at: roomsTable.createdAt,
      deleted_at: roomsTable.deletedAt,
    })
    .from(roomsTable)
    .where(
      and(
        eq(roomsTable.id, id),
        eq(roomsTable.propertyId, propertyId),
        isNull(roomsTable.deletedAt)
      )
    )
    .limit(1) as Room[];

  if (!old) return err(c, 'Cômodo não encontrado', 'NOT_FOUND', 404);

  await db
    .update(roomsTable)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(roomsTable.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'room', entityId: id, action: 'delete',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default rooms;
