import { Hono } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware, requireTenantPropertyAccess, resolveTenant } from '../middleware/auth';
import { getDb } from '../db/client';
import { rooms as roomsTable } from '../db/schema';
import { roomCreateSchema } from '@houselog/contracts';
import type { Bindings, Variables, Room } from '../lib/types';
import { createId } from '../lib/id';

const rooms = new Hono<{ Bindings: Bindings; Variables: Variables }>();

rooms.use('*', authMiddleware);
rooms.use('*', resolveTenant);
rooms.use('*', requireTenantPropertyAccess('propertyId', 'view'));

const schema = roomCreateSchema;

const roomSelect = {
  id: roomsTable.id,
  property_id: roomsTable.propertyId,
  name: roomsTable.name,
  type: roomsTable.type,
  floor: roomsTable.floor,
  area_m2: roomsTable.areaM2,
  notes: roomsTable.notes,
  created_at: roomsTable.createdAt,
  deleted_at: roomsTable.deletedAt,
};

// ── GET /properties/:propertyId/rooms ────────────────────────────────────────

rooms.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const tenantId = c.get('tenantId') as string;

  const results = await db
    .select(roomSelect)
    .from(roomsTable)
    .where(and(eq(roomsTable.propertyId, propertyId), eq(roomsTable.tenantId, tenantId), isNull(roomsTable.deletedAt)))
    .orderBy(asc(roomsTable.floor), asc(roomsTable.name)) as Room[];

  return ok(c, { rooms: results });
});

// ── POST /properties/:propertyId/rooms ───────────────────────────────────────

rooms.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const { name, type, floor, area_m2, notes } = parsed.data;
  const id = createId();

  await db.insert(roomsTable).values({
    id,
    tenantId,
    propertyId,
    name,
    type,
    floor,
    areaM2: area_m2 ?? null,
    notes: notes ?? null,
  });

  const [room] = await db
    .select(roomSelect)
    .from(roomsTable)
    .where(and(eq(roomsTable.id, id), eq(roomsTable.propertyId, propertyId), eq(roomsTable.tenantId, tenantId), isNull(roomsTable.deletedAt)))
    .limit(1) as Room[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
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
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const tenantId = c.get('tenantId') as string;


  const [room] = await db
    .select(roomSelect)
    .from(roomsTable)
    .where(
      and(
        eq(roomsTable.id, id),
        eq(roomsTable.propertyId, propertyId),
        eq(roomsTable.tenantId, tenantId),
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
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;


  const [old] = await db
    .select(roomSelect)
    .from(roomsTable)
    .where(
      and(
        eq(roomsTable.id, id),
        eq(roomsTable.propertyId, propertyId),
        eq(roomsTable.tenantId, tenantId),
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

  await db
    .update(roomsTable)
    .set(patch)
    .where(and(
      eq(roomsTable.id, id),
      eq(roomsTable.propertyId, propertyId),
      eq(roomsTable.tenantId, tenantId),
      isNull(roomsTable.deletedAt)
    ));

  const [updated] = await db
    .select(roomSelect)
    .from(roomsTable)
    .where(and(eq(roomsTable.id, id), eq(roomsTable.propertyId, propertyId), eq(roomsTable.tenantId, tenantId), isNull(roomsTable.deletedAt)))
    .limit(1) as Room[];

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'room', entityId: id, action: 'update',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old, newData: updated,
  });

  return ok(c, { room: updated });
});

// ── DELETE /properties/:propertyId/rooms/:id ─────────────────────────────────

rooms.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;


  const [old] = await db
    .select(roomSelect)
    .from(roomsTable)
    .where(
      and(
        eq(roomsTable.id, id),
        eq(roomsTable.propertyId, propertyId),
        eq(roomsTable.tenantId, tenantId),
        isNull(roomsTable.deletedAt)
      )
    )
    .limit(1) as Room[];

  if (!old) return err(c, 'Cômodo não encontrado', 'NOT_FOUND', 404);

  await db
    .update(roomsTable)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(
      eq(roomsTable.id, id),
      eq(roomsTable.propertyId, propertyId),
      eq(roomsTable.tenantId, tenantId),
      isNull(roomsTable.deletedAt)
    ));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'room', entityId: id, action: 'delete',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default rooms;
