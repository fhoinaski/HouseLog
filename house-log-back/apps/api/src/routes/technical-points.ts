import { Hono } from 'hono';
import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { resolveTechnicalSystemPermissions } from '../lib/technical-systems-permissions';
import { badRequest, conflict, created, forbidden, notFound, ok } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/client';
import {
  properties,
  propertyCollaborators,
  rooms,
  technicalPoints,
  technicalSystems,
} from '../db/schema';
import type { Bindings, Role, Variables } from '../lib/types';
import {
  createTechnicalPointSchema,
  technicalPointFilterSchema,
  updateTechnicalPointSchema,
  type TechnicalPointRiskLevel,
  type TechnicalPointType,
} from '@houselog/contracts';

type PropertyAccessContext = {
  propertyId: string;
  tenantId: string;
  canView: boolean;
  canManage: boolean;
};

type TechnicalPointRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  technical_system_id: string | null;
  room_id: string | null;
  name: string;
  type: TechnicalPointType;
  description: string | null;
  position_x: number | null;
  position_y: number | null;
  floor: number;
  reference_image_url: string | null;
  risk_level: TechnicalPointRiskLevel;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

const technicalPointsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

technicalPointsRoute.use('*', authMiddleware);

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' ? value : null;
}

async function resolvePropertyAccess(
  db: ReturnType<typeof getDb>,
  propertyId: string,
  userId: string,
  role: Role
): Promise<PropertyAccessContext | null> {
  const [property] = await db
    .select({
      id: properties.id,
      tenantId: properties.tenantId,
      ownerId: properties.ownerId,
      managerId: properties.managerId,
    })
    .from(properties)
    .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) return null;

  const [collaborator] = property.tenantId
    ? await db
        .select({ role: propertyCollaborators.role })
        .from(propertyCollaborators)
        .where(
          and(
            eq(propertyCollaborators.propertyId, propertyId),
            eq(propertyCollaborators.tenantId, property.tenantId),
            eq(propertyCollaborators.userId, userId)
          )
        )
        .limit(1)
    : [];

  const permissions = resolveTechnicalSystemPermissions({
    userId,
    role,
    property,
    collaboratorRole: collaborator?.role ?? null,
  });

  return {
    propertyId: property.id,
    tenantId: property.tenantId ?? '',
    canView: permissions.canView,
    canManage: permissions.canManage,
  };
}

async function getAccessOrResponse(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  propertyId: string
) {
  const db = getDb(c.env.DB);
  const access = await resolvePropertyAccess(db, propertyId, c.get('userId'), c.get('userRole'));

  if (!access) return { db, response: notFound(c, 'Imovel nao encontrado.') };
  if (!access.tenantId) return { db, response: conflict(c, 'Imovel sem tenant ativo para pontos tecnicos.') };
  if (!access.canView) return { db, response: forbidden(c, 'Acesso negado ao imovel.') };

  return { db, access };
}

function selectTechnicalPoints() {
  return {
    id: technicalPoints.id,
    tenant_id: technicalPoints.tenantId,
    property_id: technicalPoints.propertyId,
    technical_system_id: technicalPoints.technicalSystemId,
    room_id: technicalPoints.roomId,
    name: technicalPoints.name,
    type: technicalPoints.type,
    description: technicalPoints.description,
    position_x: technicalPoints.positionX,
    position_y: technicalPoints.positionY,
    floor: technicalPoints.floor,
    reference_image_url: technicalPoints.referenceImageUrl,
    risk_level: technicalPoints.riskLevel,
    created_at: technicalPoints.createdAt,
    updated_at: technicalPoints.updatedAt,
    deleted_at: technicalPoints.deletedAt,
  };
}

async function validateTechnicalSystemLink(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  propertyId: string,
  systemId: string | null
): Promise<boolean> {
  if (!systemId) return true;
  const [system] = await db
    .select({ id: technicalSystems.id })
    .from(technicalSystems)
    .where(
      and(
        eq(technicalSystems.id, systemId),
        eq(technicalSystems.tenantId, tenantId),
        eq(technicalSystems.propertyId, propertyId),
        isNull(technicalSystems.deletedAt)
      )
    )
    .limit(1);
  return !!system;
}

async function validateRoomLink(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  propertyId: string,
  roomId: string | null
): Promise<boolean> {
  if (!roomId) return true;
  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(
      and(
        eq(rooms.id, roomId),
        eq(rooms.tenantId, tenantId),
        eq(rooms.propertyId, propertyId),
        isNull(rooms.deletedAt)
      )
    )
    .limit(1);
  return !!room;
}

technicalPointsRoute.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  const filters = technicalPointFilterSchema.safeParse({
    technicalSystemId: c.req.query('technicalSystemId'),
    roomId: c.req.query('roomId'),
    type: c.req.query('type'),
    riskLevel: c.req.query('riskLevel'),
  });
  if (!filters.success) return badRequest(c, 'Filtros invalidos.', filters.error.flatten());

  const conditions = [
    eq(technicalPoints.tenantId, access.tenantId),
    eq(technicalPoints.propertyId, access.propertyId),
    isNull(technicalPoints.deletedAt),
  ];

  if (filters.data.technicalSystemId) conditions.push(eq(technicalPoints.technicalSystemId, filters.data.technicalSystemId));
  if (filters.data.roomId) conditions.push(eq(technicalPoints.roomId, filters.data.roomId));
  if (filters.data.type) conditions.push(eq(technicalPoints.type, filters.data.type));
  if (filters.data.riskLevel) conditions.push(eq(technicalPoints.riskLevel, filters.data.riskLevel));

  const points = await db
    .select(selectTechnicalPoints())
    .from(technicalPoints)
    .where(and(...conditions))
    .orderBy(asc(technicalPoints.floor), asc(technicalPoints.type), asc(technicalPoints.name)) as TechnicalPointRow[];

  return ok(c, { points });
});

technicalPointsRoute.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  if (!access.canManage) return forbidden(c, 'Acesso negado para gerenciar pontos tecnicos.');

  const body = await c.req.json().catch(() => null);
  if (!body) return badRequest(c, 'Body invalido.');

  const parsed = createTechnicalPointSchema.safeParse(body);
  if (!parsed.success) return badRequest(c, 'Dados invalidos.', parsed.error.flatten());
  const data = parsed.data;

  const technicalSystemId = optionalText(data.technical_system_id);
  const roomId = optionalText(data.room_id);
  if (!(await validateTechnicalSystemLink(db, access.tenantId, access.propertyId, technicalSystemId))) {
    return badRequest(c, 'Sistema tecnico nao pertence a este imovel.');
  }
  if (!(await validateRoomLink(db, access.tenantId, access.propertyId, roomId))) {
    return badRequest(c, 'Ambiente nao pertence a este imovel.');
  }

  const id = nanoid();
  await db.insert(technicalPoints).values({
    id,
    tenantId: access.tenantId,
    propertyId: access.propertyId,
    technicalSystemId,
    roomId,
    name: data.name.trim(),
    type: data.type,
    description: optionalText(data.description),
    positionX: optionalNumber(data.position_x),
    positionY: optionalNumber(data.position_y),
    floor: data.floor,
    referenceImageUrl: optionalText(data.reference_image_url),
    riskLevel: data.risk_level,
  });

  const [point] = await db
    .select(selectTechnicalPoints())
    .from(technicalPoints)
    .where(and(eq(technicalPoints.id, id), eq(technicalPoints.tenantId, access.tenantId)))
    .limit(1) as TechnicalPointRow[];

  await writeAuditLog(c.env.DB, {
    entityType: 'technical_point',
    entityId: id,
    action: 'create',
    actorId: c.get('userId'),
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: point,
  });

  return created(c, { point });
});

technicalPointsRoute.patch('/:pointId', async (c) => {
  const propertyId = c.req.param('propertyId');
  const pointId = c.req.param('pointId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  if (!pointId) return badRequest(c, 'pointId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  if (!access.canManage) return forbidden(c, 'Acesso negado para gerenciar pontos tecnicos.');

  const [old] = await db
    .select(selectTechnicalPoints())
    .from(technicalPoints)
    .where(
      and(
        eq(technicalPoints.id, pointId),
        eq(technicalPoints.tenantId, access.tenantId),
        eq(technicalPoints.propertyId, access.propertyId),
        isNull(technicalPoints.deletedAt)
      )
    )
    .limit(1) as TechnicalPointRow[];

  if (!old) return notFound(c, 'Ponto tecnico nao encontrado.');

  const body = await c.req.json().catch(() => null);
  if (!body) return badRequest(c, 'Body invalido.');

  const parsed = updateTechnicalPointSchema.safeParse(body);
  if (!parsed.success) return badRequest(c, 'Dados invalidos.', parsed.error.flatten());
  const data = parsed.data;

  const patch: Partial<typeof technicalPoints.$inferInsert> = {};
  if (data.technical_system_id !== undefined) {
    const technicalSystemId = optionalText(data.technical_system_id);
    if (!(await validateTechnicalSystemLink(db, access.tenantId, access.propertyId, technicalSystemId))) {
      return badRequest(c, 'Sistema tecnico nao pertence a este imovel.');
    }
    patch.technicalSystemId = technicalSystemId;
  }
  if (data.room_id !== undefined) {
    const roomId = optionalText(data.room_id);
    if (!(await validateRoomLink(db, access.tenantId, access.propertyId, roomId))) {
      return badRequest(c, 'Ambiente nao pertence a este imovel.');
    }
    patch.roomId = roomId;
  }
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.type !== undefined) patch.type = data.type;
  if (data.description !== undefined) patch.description = optionalText(data.description);
  if (data.position_x !== undefined) patch.positionX = optionalNumber(data.position_x);
  if (data.position_y !== undefined) patch.positionY = optionalNumber(data.position_y);
  if (data.floor !== undefined) patch.floor = data.floor;
  if (data.reference_image_url !== undefined) patch.referenceImageUrl = optionalText(data.reference_image_url);
  if (data.risk_level !== undefined) patch.riskLevel = data.risk_level;

  if (Object.keys(patch).length === 0) return badRequest(c, 'Nenhum campo para atualizar.');
  patch.updatedAt = new Date().toISOString();

  await db
    .update(technicalPoints)
    .set(patch)
    .where(
      and(
        eq(technicalPoints.id, pointId),
        eq(technicalPoints.tenantId, access.tenantId),
        eq(technicalPoints.propertyId, access.propertyId)
      )
    );

  const [point] = await db
    .select(selectTechnicalPoints())
    .from(technicalPoints)
    .where(eq(technicalPoints.id, pointId))
    .limit(1) as TechnicalPointRow[];

  await writeAuditLog(c.env.DB, {
    entityType: 'technical_point',
    entityId: pointId,
    action: 'update',
    actorId: c.get('userId'),
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: point,
  });

  return ok(c, { point });
});

technicalPointsRoute.delete('/:pointId', async (c) => {
  const propertyId = c.req.param('propertyId');
  const pointId = c.req.param('pointId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  if (!pointId) return badRequest(c, 'pointId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  if (!access.canManage) return forbidden(c, 'Acesso negado para gerenciar pontos tecnicos.');

  const [old] = await db
    .select(selectTechnicalPoints())
    .from(technicalPoints)
    .where(
      and(
        eq(technicalPoints.id, pointId),
        eq(technicalPoints.tenantId, access.tenantId),
        eq(technicalPoints.propertyId, access.propertyId),
        isNull(technicalPoints.deletedAt)
      )
    )
    .limit(1) as TechnicalPointRow[];

  if (!old) return notFound(c, 'Ponto tecnico nao encontrado.');

  await db
    .update(technicalPoints)
    .set({ deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(technicalPoints.id, pointId),
        eq(technicalPoints.tenantId, access.tenantId),
        eq(technicalPoints.propertyId, access.propertyId)
      )
    );

  await writeAuditLog(c.env.DB, {
    entityType: 'technical_point',
    entityId: pointId,
    action: 'delete',
    actorId: c.get('userId'),
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default technicalPointsRoute;
