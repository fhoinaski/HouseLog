import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Context } from 'hono';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { badRequest, conflict, created, forbidden, notFound, ok } from '../lib/response';
import { resolveTechnicalSystemPermissions } from '../lib/technical-systems-permissions';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/client';
import {
  properties,
  propertyCollaborators,
  technicalSystems,
} from '../db/schema';
import type { Bindings, Role, Variables } from '../lib/types';
import {
  createTechnicalSystemSchema,
  updateTechnicalSystemSchema,
  type TechnicalSystemStatus,
  type TechnicalSystemType,
} from '@houselog/contracts';

type PropertyAccessContext = {
  propertyId: string;
  tenantId: string;
  canView: boolean;
  canManage: boolean;
};

type TechnicalSystemRow = {
  id: string;
  tenant_id: string;
  property_id: string;
  name: string;
  type: TechnicalSystemType;
  description: string | null;
  location_summary: string | null;
  responsible_provider_id: string | null;
  installation_date: string | null;
  last_inspection_at: string | null;
  status: TechnicalSystemStatus;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
};

const technicalSystemsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

technicalSystemsRoute.use('*', authMiddleware);

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
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
        .select({
          role: propertyCollaborators.role,
        })
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

async function validateResponsibleProvider(
  db: ReturnType<typeof getDb>,
  propertyId: string,
  tenantId: string,
  providerId: string | null
): Promise<boolean> {
  if (!providerId) return true;

  const [provider] = await db
    .select({ id: propertyCollaborators.id })
    .from(propertyCollaborators)
    .where(
      and(
        eq(propertyCollaborators.propertyId, propertyId),
        eq(propertyCollaborators.tenantId, tenantId),
        eq(propertyCollaborators.userId, providerId),
        eq(propertyCollaborators.role, 'provider')
      )
    )
    .limit(1);

  return !!provider;
}

function selectTechnicalSystems() {
  return {
    id: technicalSystems.id,
    tenant_id: technicalSystems.tenantId,
    property_id: technicalSystems.propertyId,
    name: technicalSystems.name,
    type: technicalSystems.type,
    description: technicalSystems.description,
    location_summary: technicalSystems.locationSummary,
    responsible_provider_id: technicalSystems.responsibleProviderId,
    installation_date: technicalSystems.installationDate,
    last_inspection_at: technicalSystems.lastInspectionAt,
    status: technicalSystems.status,
    created_at: technicalSystems.createdAt,
    updated_at: technicalSystems.updatedAt,
    deleted_at: technicalSystems.deletedAt,
  };
}

async function getAccessOrResponse(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  propertyId: string
) {
  const db = getDb(c.env.DB);
  const access = await resolvePropertyAccess(db, propertyId, c.get('userId'), c.get('userRole'));

  if (!access) return { db, response: notFound(c, 'Imovel nao encontrado.') };
  if (!access.tenantId) return { db, response: conflict(c, 'Imovel sem tenant ativo para sistemas tecnicos.') };
  if (!access.canView) return { db, response: forbidden(c, 'Acesso negado ao imovel.') };

  return { db, access };
}

technicalSystemsRoute.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  const systems = await db
    .select(selectTechnicalSystems())
    .from(technicalSystems)
    .where(
      and(
        eq(technicalSystems.tenantId, access.tenantId),
        eq(technicalSystems.propertyId, access.propertyId),
        isNull(technicalSystems.deletedAt)
      )
    )
    .orderBy(asc(technicalSystems.type), asc(technicalSystems.name)) as TechnicalSystemRow[];

  return ok(c, { systems });
});

technicalSystemsRoute.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  if (!access.canManage) return forbidden(c, 'Acesso negado para gerenciar sistemas tecnicos.');

  const body = await c.req.json().catch(() => null);
  if (!body) return badRequest(c, 'Body invalido.');

  const parsed = createTechnicalSystemSchema.safeParse(body);
  if (!parsed.success) return badRequest(c, 'Dados invalidos.', parsed.error.flatten());

  const data = parsed.data;
  const responsibleProviderId = optionalText(data.responsible_provider_id);
  const providerIsValid = await validateResponsibleProvider(
    db,
    access.propertyId,
    access.tenantId,
    responsibleProviderId
  );
  if (!providerIsValid) return badRequest(c, 'Prestador responsavel nao pertence a este imovel.');

  const id = nanoid();

  await db.insert(technicalSystems).values({
    id,
    tenantId: access.tenantId,
    propertyId: access.propertyId,
    name: data.name.trim(),
    type: data.type,
    description: optionalText(data.description),
    locationSummary: optionalText(data.location_summary),
    responsibleProviderId,
    installationDate: optionalText(data.installation_date),
    lastInspectionAt: optionalText(data.last_inspection_at),
    status: data.status,
  });

  const [system] = await db
    .select(selectTechnicalSystems())
    .from(technicalSystems)
    .where(
      and(
        eq(technicalSystems.id, id),
        eq(technicalSystems.tenantId, access.tenantId),
        eq(technicalSystems.propertyId, access.propertyId)
      )
    )
    .limit(1) as TechnicalSystemRow[];

  await writeAuditLog(c.env.DB, {
    entityType: 'technical_system',
    entityId: id,
    action: 'create',
    actorId: c.get('userId'),
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: system,
  });

  return created(c, { system });
});

technicalSystemsRoute.patch('/:systemId', async (c) => {
  const propertyId = c.req.param('propertyId');
  const systemId = c.req.param('systemId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  if (!systemId) return badRequest(c, 'systemId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  if (!access.canManage) return forbidden(c, 'Acesso negado para gerenciar sistemas tecnicos.');

  const [old] = await db
    .select(selectTechnicalSystems())
    .from(technicalSystems)
    .where(
      and(
        eq(technicalSystems.id, systemId),
        eq(technicalSystems.tenantId, access.tenantId),
        eq(technicalSystems.propertyId, access.propertyId),
        isNull(technicalSystems.deletedAt)
      )
    )
    .limit(1) as TechnicalSystemRow[];

  if (!old) return notFound(c, 'Sistema tecnico nao encontrado.');

  const body = await c.req.json().catch(() => null);
  if (!body) return badRequest(c, 'Body invalido.');

  const parsed = updateTechnicalSystemSchema.safeParse(body);
  if (!parsed.success) return badRequest(c, 'Dados invalidos.', parsed.error.flatten());

  const data = parsed.data;
  const patch: Partial<typeof technicalSystems.$inferInsert> = {};

  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.type !== undefined) patch.type = data.type;
  if (data.description !== undefined) patch.description = optionalText(data.description);
  if (data.location_summary !== undefined) patch.locationSummary = optionalText(data.location_summary);
  if (data.responsible_provider_id !== undefined) {
    const responsibleProviderId = optionalText(data.responsible_provider_id);
    const providerIsValid = await validateResponsibleProvider(
      db,
      access.propertyId,
      access.tenantId,
      responsibleProviderId
    );
    if (!providerIsValid) return badRequest(c, 'Prestador responsavel nao pertence a este imovel.');
    patch.responsibleProviderId = responsibleProviderId;
  }
  if (data.installation_date !== undefined) patch.installationDate = optionalText(data.installation_date);
  if (data.last_inspection_at !== undefined) patch.lastInspectionAt = optionalText(data.last_inspection_at);
  if (data.status !== undefined) patch.status = data.status;

  if (Object.keys(patch).length === 0) return badRequest(c, 'Nenhum campo para atualizar.');
  patch.updatedAt = new Date().toISOString();

  await db
    .update(technicalSystems)
    .set(patch)
    .where(
      and(
        eq(technicalSystems.id, systemId),
        eq(technicalSystems.tenantId, access.tenantId),
        eq(technicalSystems.propertyId, access.propertyId)
      )
    );

  const [system] = await db
    .select(selectTechnicalSystems())
    .from(technicalSystems)
    .where(eq(technicalSystems.id, systemId))
    .limit(1) as TechnicalSystemRow[];

  await writeAuditLog(c.env.DB, {
    entityType: 'technical_system',
    entityId: systemId,
    action: 'update',
    actorId: c.get('userId'),
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
    newData: system,
  });

  return ok(c, { system });
});

technicalSystemsRoute.delete('/:systemId', async (c) => {
  const propertyId = c.req.param('propertyId');
  const systemId = c.req.param('systemId');
  if (!propertyId) return badRequest(c, 'propertyId obrigatorio.');
  if (!systemId) return badRequest(c, 'systemId obrigatorio.');
  const context = await getAccessOrResponse(c, propertyId);
  if ('response' in context) return context.response;
  const { db, access } = context;

  if (!access.canManage) return forbidden(c, 'Acesso negado para gerenciar sistemas tecnicos.');

  const [old] = await db
    .select(selectTechnicalSystems())
    .from(technicalSystems)
    .where(
      and(
        eq(technicalSystems.id, systemId),
        eq(technicalSystems.tenantId, access.tenantId),
        eq(technicalSystems.propertyId, access.propertyId),
        isNull(technicalSystems.deletedAt)
      )
    )
    .limit(1) as TechnicalSystemRow[];

  if (!old) return notFound(c, 'Sistema tecnico nao encontrado.');

  await db
    .update(technicalSystems)
    .set({
      deletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(technicalSystems.id, systemId),
        eq(technicalSystems.tenantId, access.tenantId),
        eq(technicalSystems.propertyId, access.propertyId)
      )
    );

  await writeAuditLog(c.env.DB, {
    entityType: 'technical_system',
    entityId: systemId,
    action: 'delete',
    actorId: c.get('userId'),
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old,
  });

  return ok(c, { success: true });
});

export default technicalSystemsRoute;
