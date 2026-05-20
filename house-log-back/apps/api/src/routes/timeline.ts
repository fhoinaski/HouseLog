import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, isNotNull, isNull, lt } from 'drizzle-orm';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { err, ok } from '../lib/response';
import { getDb } from '../db/client';
import {
  documentIngestionJobs,
  documents,
  handoverPackages,
  inventoryItems,
  properties,
  renovations,
  rooms,
  serviceOrders,
  serviceRequests,
  warranties,
} from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const timeline = new Hono<{ Bindings: Bindings; Variables: Variables }>();
timeline.use('*', authMiddleware);
timeline.use('*', resolveTenant);

const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(80),
  before: z.string().min(1).optional(),
});

type TimelineEventType =
  | 'property_created'
  | 'room_created'
  | 'document_uploaded'
  | 'warranty_created'
  | 'service_request_opened'
  | 'diagnostic_recorded'
  | 'service_order_created'
  | 'service_order_completed'
  | 'evidence_uploaded'
  | 'inventory_updated'
  | 'renovation_completed'
  | 'dossier_issued'
  | 'handover_accepted';

type TimelineEventMeta = Record<string, string | number | boolean | null>;

type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  at: string;
  title: string;
  description: string | null;
  entity_type: string;
  entity_id: string;
  severity: 'neutral' | 'success' | 'warning' | 'critical';
  meta?: TimelineEventMeta;
};

function makeEvent(input: TimelineEvent): TimelineEvent {
  return input;
}

function countMedia(raw: unknown): number {
  if (Array.isArray(raw)) return raw.filter((item) => typeof item === 'string' && item.trim().length > 0).length;
  if (typeof raw !== 'string' || raw.trim().length === 0) return 0;

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item.trim().length > 0).length : 0;
  } catch {
    return 0;
  }
}

function isBefore(date: string, before: string): boolean {
  return date < before;
}

timeline.get('/', async (c) => {
  const parsedQuery = timelineQuerySchema.safeParse({
    limit: c.req.query('limit'),
    before: c.req.query('before'),
  });

  if (!parsedQuery.success) {
    return err(c, 'Parametros invalidos', 'VALIDATION_ERROR', 400, parsedQuery.error.flatten());
  }

  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  const tenantRole = c.get('tenantRole');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!propertyId) return err(c, 'Imovel nao informado', 'INVALID_PROPERTY', 400);

  const before = parsedQuery.data.before ?? '9999-12-31T23:59:59.999Z';
  const limit = parsedQuery.data.limit;

  const [property] = await db
    .select({
      id: properties.id,
      name: properties.name,
      type: properties.type,
      createdAt: properties.createdAt,
    })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const canView = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, tenantRole);
  if (!canView) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [
    roomRows,
    documentRows,
    warrantyRows,
    requestRows,
    serviceRows,
    inventoryRows,
    handoverRows,
    renovationRows,
    diagnosticRows,
  ] = await Promise.all([
    db
      .select({ id: rooms.id, name: rooms.name, type: rooms.type, createdAt: rooms.createdAt })
      .from(rooms)
      .where(and(eq(rooms.tenantId, tenantId), eq(rooms.propertyId, propertyId), isNull(rooms.deletedAt), lt(rooms.createdAt, before)))
      .orderBy(desc(rooms.createdAt))
      .limit(limit),

    db
      .select({ id: documents.id, title: documents.title, type: documents.type, createdAt: documents.createdAt })
      .from(documents)
      .where(and(eq(documents.tenantId, tenantId), eq(documents.propertyId, propertyId), isNull(documents.deletedAt), lt(documents.createdAt, before)))
      .orderBy(desc(documents.createdAt))
      .limit(limit),

    db
      .select({ id: warranties.id, title: warranties.title, status: warranties.status, endDate: warranties.endDate, createdAt: warranties.createdAt })
      .from(warranties)
      .where(and(eq(warranties.tenantId, tenantId), eq(warranties.propertyId, propertyId), isNull(warranties.deletedAt), lt(warranties.createdAt, before)))
      .orderBy(desc(warranties.createdAt))
      .limit(limit),

    db
      .select({ id: serviceRequests.id, title: serviceRequests.title, status: serviceRequests.status, createdAt: serviceRequests.createdAt })
      .from(serviceRequests)
      .where(and(eq(serviceRequests.tenantId, tenantId), eq(serviceRequests.propertyId, propertyId), lt(serviceRequests.createdAt, before)))
      .orderBy(desc(serviceRequests.createdAt))
      .limit(limit),

    db
      .select({
        id: serviceOrders.id,
        title: serviceOrders.title,
        status: serviceOrders.status,
        priority: serviceOrders.priority,
        systemType: serviceOrders.systemType,
        beforePhotos: serviceOrders.beforePhotos,
        afterPhotos: serviceOrders.afterPhotos,
        createdAt: serviceOrders.createdAt,
        completedAt: serviceOrders.completedAt,
      })
      .from(serviceOrders)
      .where(and(eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt), lt(serviceOrders.createdAt, before)))
      .orderBy(desc(serviceOrders.createdAt))
      .limit(limit),

    db
      .select({ id: inventoryItems.id, name: inventoryItems.name, category: inventoryItems.category, createdAt: inventoryItems.createdAt })
      .from(inventoryItems)
      .where(and(eq(inventoryItems.tenantId, tenantId), eq(inventoryItems.propertyId, propertyId), isNull(inventoryItems.deletedAt), lt(inventoryItems.createdAt, before)))
      .orderBy(desc(inventoryItems.createdAt))
      .limit(limit),

    db
      .select({
        id: handoverPackages.id,
        title: handoverPackages.title,
        type: handoverPackages.type,
        status: handoverPackages.status,
        createdAt: handoverPackages.createdAt,
        issuedAt: handoverPackages.issuedAt,
        acceptedAt: handoverPackages.acceptedAt,
      })
      .from(handoverPackages)
      .where(and(eq(handoverPackages.tenantId, tenantId), eq(handoverPackages.propertyId, propertyId), isNull(handoverPackages.deletedAt), lt(handoverPackages.createdAt, before)))
      .orderBy(desc(handoverPackages.createdAt))
      .limit(limit),

    db
      .select({ id: renovations.id, title: renovations.title, category: renovations.category, status: renovations.status, completedAt: renovations.completedAt, createdAt: renovations.createdAt })
      .from(renovations)
      .where(and(eq(renovations.tenantId, tenantId), eq(renovations.propertyId, propertyId), isNull(renovations.deletedAt), lt(renovations.createdAt, before)))
      .orderBy(desc(renovations.createdAt))
      .limit(limit),

    db
      .select({ id: documentIngestionJobs.id, documentId: documentIngestionJobs.documentId, status: documentIngestionJobs.status, finishedAt: documentIngestionJobs.finishedAt, createdAt: documentIngestionJobs.createdAt })
      .from(documentIngestionJobs)
      .where(and(eq(documentIngestionJobs.tenantId, tenantId), eq(documentIngestionJobs.propertyId, propertyId), eq(documentIngestionJobs.status, 'completed'), isNotNull(documentIngestionJobs.finishedAt), lt(documentIngestionJobs.createdAt, before)))
      .orderBy(desc(documentIngestionJobs.createdAt))
      .limit(limit),
  ]);

  const events: TimelineEvent[] = [];

  if (isBefore(property.createdAt, before)) {
    events.push(makeEvent({
      id: `property:${property.id}:created`,
      type: 'property_created',
      at: property.createdAt,
      title: 'Imovel criado',
      description: property.name,
      entity_type: 'property',
      entity_id: property.id,
      severity: 'neutral',
      meta: { property_type: property.type },
    }));
  }

  for (const room of roomRows) {
    events.push(makeEvent({
      id: `room:${room.id}:created`,
      type: 'room_created',
      at: room.createdAt,
      title: 'Ambiente cadastrado',
      description: room.name,
      entity_type: 'room',
      entity_id: room.id,
      severity: 'neutral',
      meta: { room_type: room.type },
    }));
  }

  for (const document of documentRows) {
    events.push(makeEvent({
      id: `document:${document.id}:uploaded`,
      type: 'document_uploaded',
      at: document.createdAt,
      title: 'Documento enviado',
      description: document.title,
      entity_type: 'document',
      entity_id: document.id,
      severity: 'neutral',
      meta: { document_type: document.type },
    }));
  }

  for (const warranty of warrantyRows) {
    events.push(makeEvent({
      id: `warranty:${warranty.id}:created`,
      type: 'warranty_created',
      at: warranty.createdAt,
      title: 'Garantia cadastrada',
      description: warranty.title,
      entity_type: 'warranty',
      entity_id: warranty.id,
      severity: warranty.status === 'expired' ? 'warning' : 'success',
      meta: { status: warranty.status, end_date: warranty.endDate },
    }));
  }

  for (const request of requestRows) {
    events.push(makeEvent({
      id: `service_request:${request.id}:opened`,
      type: 'service_request_opened',
      at: request.createdAt,
      title: 'Chamado aberto',
      description: request.title,
      entity_type: 'service_request',
      entity_id: request.id,
      severity: request.status === 'OPEN' ? 'warning' : 'neutral',
      meta: { status: request.status },
    }));
  }

  for (const job of diagnosticRows) {
    const at = job.finishedAt ?? job.createdAt;
    events.push(makeEvent({
      id: `document_ingestion:${job.id}:completed`,
      type: 'diagnostic_recorded',
      at,
      title: 'Diagnostico registrado',
      description: 'Extracao tecnica de documento concluida',
      entity_type: 'document_ingestion',
      entity_id: job.id,
      severity: 'success',
      meta: { document_id: job.documentId },
    }));
  }

  for (const order of serviceRows) {
    events.push(makeEvent({
      id: `service_order:${order.id}:created`,
      type: 'service_order_created',
      at: order.createdAt,
      title: 'OS criada',
      description: order.title,
      entity_type: 'service_order',
      entity_id: order.id,
      severity: order.priority === 'urgent' ? 'critical' : 'neutral',
      meta: { status: order.status, priority: order.priority, system_type: order.systemType },
    }));

    if (order.completedAt && isBefore(order.completedAt, before)) {
      events.push(makeEvent({
        id: `service_order:${order.id}:completed`,
        type: 'service_order_completed',
        at: order.completedAt,
        title: 'OS concluida',
        description: order.title,
        entity_type: 'service_order',
        entity_id: order.id,
        severity: 'success',
        meta: { system_type: order.systemType },
      }));
    }

    const evidenceCount = countMedia(order.beforePhotos) + countMedia(order.afterPhotos);
    if (evidenceCount > 0) {
      const evidenceAt = order.completedAt ?? order.createdAt;
      if (isBefore(evidenceAt, before)) {
        events.push(makeEvent({
          id: `service_order:${order.id}:evidence`,
          type: 'evidence_uploaded',
          at: evidenceAt,
          title: 'Foto/evidencia enviada',
          description: order.title,
          entity_type: 'service_order',
          entity_id: order.id,
          severity: 'neutral',
          meta: { evidence_count: evidenceCount, system_type: order.systemType },
        }));
      }
    }
  }

  for (const item of inventoryRows) {
    events.push(makeEvent({
      id: `inventory_item:${item.id}:created`,
      type: 'inventory_updated',
      at: item.createdAt,
      title: 'Inventario atualizado',
      description: item.name,
      entity_type: 'inventory_item',
      entity_id: item.id,
      severity: 'neutral',
      meta: { category: item.category },
    }));
  }

  for (const renovation of renovationRows) {
    const at = renovation.completedAt ?? renovation.createdAt;
    if (renovation.status === 'completed' && isBefore(at, before)) {
      events.push(makeEvent({
        id: `renovation:${renovation.id}:completed`,
        type: 'renovation_completed',
        at,
        title: 'Reforma concluida',
        description: renovation.title,
        entity_type: 'renovation',
        entity_id: renovation.id,
        severity: 'success',
        meta: { category: renovation.category },
      }));
    }
  }

  for (const pkg of handoverRows) {
    if (pkg.issuedAt && isBefore(pkg.issuedAt, before)) {
      events.push(makeEvent({
        id: `handover_package:${pkg.id}:issued`,
        type: 'dossier_issued',
        at: pkg.issuedAt,
        title: 'Dossie emitido',
        description: pkg.title,
        entity_type: 'handover_package',
        entity_id: pkg.id,
        severity: 'success',
        meta: { package_type: pkg.type, status: pkg.status },
      }));
    }

    if (pkg.acceptedAt && isBefore(pkg.acceptedAt, before)) {
      events.push(makeEvent({
        id: `handover_package:${pkg.id}:accepted`,
        type: 'handover_accepted',
        at: pkg.acceptedAt,
        title: 'Aceite de handover',
        description: pkg.title,
        entity_type: 'handover_package',
        entity_id: pkg.id,
        severity: 'success',
        meta: { package_type: pkg.type },
      }));
    }
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id.localeCompare(b.id)));
  const data = events.slice(0, limit);
  const nextCursor = data.length === limit ? data[data.length - 1]?.at ?? null : null;

  return ok(c, {
    data,
    next_cursor: nextCursor,
    has_more: nextCursor !== null,
  });
});

export default timeline;
