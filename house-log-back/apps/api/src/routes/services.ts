import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import {
  canChangeServiceOrderStatus,
  canCloseServiceOrderWithEvidence,
  canCreateServiceOrder,
  canDeleteServiceOrder,
  canMutateServiceOrder,
  canUpdateServiceOrder,
  canUpdateServiceOrderChecklist,
  canUploadServiceEvidence,
  canViewServiceOrder,
} from '../lib/authorization';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import { validateUpload, buildR2Key, uploadToR2, getPublicUrl } from '../lib/r2';
import { sendEmail, emailOsStatusChanged, emailServiceAssigned } from '../lib/email';
import { getDb } from '../db/client';
import { properties, rooms, serviceOrders, users } from '../db/schema';
import type { Bindings, Variables, ServiceOrder } from '../lib/types';

const services = new Hono<{ Bindings: Bindings; Variables: Variables }>();

services.use('*', authMiddleware);

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  requested:   ['approved'],
  approved:    ['in_progress', 'requested'],
  in_progress: ['completed', 'approved'],
  completed:   ['verified', 'in_progress'],
  verified:    [],
};

const createSchema = z.object({
  title: z.string().min(1),
  system_type: z.enum(['electrical', 'plumbing', 'structural', 'waterproofing', 'painting', 'flooring', 'roofing', 'general']),
  description: z.string().optional(),
  room_id: z.string().optional(),
  priority: z.enum(['urgent', 'normal', 'preventive']).default('normal'),
  assigned_to: z.string().optional(),
  warranty_until: z.string().optional(),
  scheduled_at: z.string().optional(),
  checklist: z.array(z.object({ item: z.string(), done: z.boolean() })).optional(),
});

const SERVICE_ORDER_AUDIT_FIELD_NAMES: Record<string, string> = {
  title: 'title',
  description: 'description',
  systemType: 'system_type',
  roomId: 'room_id',
  priority: 'priority',
  assignedTo: 'assigned_to',
  warrantyUntil: 'warranty_until',
  scheduledAt: 'scheduled_at',
  checklist: 'checklist',
};

// ── GET /properties/:propertyId/services ─────────────────────────────────────

services.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canViewServiceOrder(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const status = c.req.query('status');
  const priority = c.req.query('priority');

  let query = db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
      requested_by_name: sql<string>`u1.name`,
      assigned_to_name: sql<string | null>`u2.name`,
      room_name: rooms.name,
    })
    .from(serviceOrders)
    .innerJoin(sql`${users} u1`, sql`u1.id = ${serviceOrders.requestedBy}`)
    .leftJoin(sql`${users} u2`, sql`u2.id = ${serviceOrders.assignedTo}`)
    .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
    .where(and(eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)));

  if (status) query = query.where(eq(serviceOrders.status, status as never));
  if (priority) query = query.where(eq(serviceOrders.priority, priority as never));
  if (cursor) query = query.where(sql`${serviceOrders.createdAt} < ${cursor}`);

  const results = await query
    .orderBy(sql`CASE ${serviceOrders.priority} WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`, desc(serviceOrders.createdAt))
    .limit(limit + 1) as Array<ServiceOrder & { requested_by_name: string; assigned_to_name: string | null; room_name: string | null }>;

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── POST /properties/:propertyId/services ────────────────────────────────────

services.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canCreateServiceOrder(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem permissão para abrir OS neste imóvel', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const id = nanoid();

  try {
    await db.insert(serviceOrders).values({
      id,
      propertyId,
      roomId: d.room_id ?? null,
      systemType: d.system_type,
      requestedBy: userId,
      assignedTo: d.assigned_to ?? null,
      title: d.title,
      description: d.description ?? null,
      priority: d.priority,
      // Assigned provider means direct execution workflow (no bidding).
      status: d.assigned_to ? 'approved' : 'requested',
      warrantyUntil: d.warranty_until ?? null,
      scheduledAt: d.scheduled_at ?? null,
      checklist: d.checklist ?? [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('FOREIGN KEY')) {
      return err(c, 'Cômodo ou prestador não encontrado', 'REFERENCE_NOT_FOUND', 422);
    }
    throw e;
  }

  const [order] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
    })
    .from(serviceOrders)
    .where(eq(serviceOrders.id, id))
    .limit(1) as Array<ServiceOrder>;

  // Notify assigned provider (non-blocking)
  void (async () => {
    try {
      if (!d.assigned_to || !c.env.RESEND_API_KEY) return;

      const [provider] = await db
        .select({ name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, d.assigned_to))
        .limit(1) as Array<{ name: string; email: string }>;

      const [property] = await db
        .select({ name: properties.name })
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1) as Array<{ name: string }>;

      if (!provider?.email) return;

      const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';
      await sendEmail(c.env.RESEND_API_KEY, {
        to: provider.email,
        subject: `Nova OS atribuída: ${d.title}`,
        html: emailServiceAssigned({
          providerName: provider.name,
          orderTitle: d.title,
          propertyName: property?.name ?? 'Imóvel',
          priorityLabel: d.priority,
          scheduledAt: d.scheduled_at,
          serviceUrl: `${appUrl}/provider/services/${id}`,
          appUrl,
        }),
      });
    } catch (e) {
      console.error('Assigned provider notification failed:', e);
    }
  })();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: 'service_order_created',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      service_order_id: id,
      system_type: order.system_type,
      priority: order.priority,
      status: order.status,
      requested_by: order.requested_by,
      actor_id: userId,
    },
  });

  return ok(c, { order }, 201);
});

// ── GET /properties/:propertyId/services/:id ─────────────────────────────────

services.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canViewServiceOrder(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [order] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
      requested_by_name: sql<string>`u1.name`,
      assigned_to_name: sql<string | null>`u2.name`,
      room_name: rooms.name,
    })
    .from(serviceOrders)
    .innerJoin(sql`${users} u1`, sql`u1.id = ${serviceOrders.requestedBy}`)
    .leftJoin(sql`${users} u2`, sql`u2.id = ${serviceOrders.assignedTo}`)
    .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1);

  if (!order) return err(c, 'Ordem de serviço não encontrada', 'NOT_FOUND', 404);

  return ok(c, { order });
});

// ── PUT /properties/:propertyId/services/:id ─────────────────────────────────

services.put('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canUpdateServiceOrder(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
    })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1) as Array<ServiceOrder>;

  if (!old) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const updateData: Partial<typeof serviceOrders.$inferInsert> = {};

  if (d.title !== undefined) updateData.title = d.title;
  if (d.description !== undefined) updateData.description = d.description ?? null;
  if (d.system_type !== undefined) updateData.systemType = d.system_type;
  if (d.room_id !== undefined) updateData.roomId = d.room_id ?? null;
  if (d.priority !== undefined) updateData.priority = d.priority;
  if (d.assigned_to !== undefined) updateData.assignedTo = d.assigned_to ?? null;
  if (d.warranty_until !== undefined) updateData.warrantyUntil = d.warranty_until ?? null;
  if (d.scheduled_at !== undefined) updateData.scheduledAt = d.scheduled_at ?? null;
  if (d.checklist !== undefined) updateData.checklist = d.checklist;

  if (Object.keys(updateData).length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await db.update(serviceOrders).set(updateData).where(eq(serviceOrders.id, id));

  const [updated] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
    })
    .from(serviceOrders)
    .where(eq(serviceOrders.id, id))
    .limit(1) as Array<ServiceOrder>;

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order',
    entityId: id,
    action: 'service_order_updated',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: { previous_status: old.status },
    newData: {
      property_id: propertyId,
      service_order_id: id,
      changed_fields: Object.keys(updateData).map((field) => SERVICE_ORDER_AUDIT_FIELD_NAMES[field] ?? field),
      status: updated.status,
      actor_id: userId,
    },
  });

  return ok(c, { order: updated });
});

// ── PATCH /properties/:propertyId/services/:id/status ────────────────────────

services.patch('/:id/status', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canChangeServiceOrderStatus(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json<{ status: string }>().catch(() => null);
  if (!body?.status) return err(c, 'Status inválido', 'INVALID_BODY');

  const [order] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
    })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1) as Array<ServiceOrder>;

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const allowed = STATUS_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(body.status)) {
    return err(
      c,
      `Transição inválida: ${order.status} → ${body.status}`,
      'INVALID_TRANSITION',
      422
    );
  }

  let evidenceCount: number | undefined;

  // Rule: completing requires at least 1 after photo
  if (body.status === 'completed') {
    const canCloseWithEvidence = await canCloseServiceOrderWithEvidence(c.env.DB, { propertyId, userId, role });
    if (!canCloseWithEvidence) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

    const afterPhotos = Array.isArray(order.after_photos)
      ? order.after_photos
      : JSON.parse((order.after_photos as string | null) || '[]') as string[];
    evidenceCount = afterPhotos.length;
    if (afterPhotos.length === 0) {
      return err(c, 'OS requer ao menos 1 foto "depois" para ser concluída', 'MISSING_AFTER_PHOTO', 422);
    }
  }

  await db
    .update(serviceOrders)
    .set({
      status: body.status as typeof serviceOrders.$inferInsert.status,
      ...(body.status === 'completed' ? { completedAt: sql`datetime('now')` } : {}),
    })
    .where(eq(serviceOrders.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: 'service_order_status_changed',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: { previous_status: order.status },
    newData: {
      property_id: propertyId,
      service_order_id: id,
      previous_status: order.status,
      next_status: body.status,
      actor_id: userId,
      ...(evidenceCount !== undefined ? { evidence_count: evidenceCount } : {}),
    },
  });

  const [updated] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
    })
    .from(serviceOrders)
    .where(eq(serviceOrders.id, id))
    .limit(1) as Array<ServiceOrder>;

  // Send email notification to requester (non-blocking)
  void (async () => {
    try {
      const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';
      const [requester] = await db
        .select({
          email: users.email,
          name: users.name,
          notification_prefs: users.notificationPrefs,
          property_name: properties.name,
        })
        .from(users)
        .innerJoin(properties, eq(properties.id, sql`${propertyId}`))
        .where(eq(users.id, order.requested_by))
        .limit(1) as Array<{ email: string; name: string; notification_prefs: string; property_name: string }>;

      if (requester && c.env.RESEND_API_KEY) {
        const prefs = JSON.parse(requester.notification_prefs || '{}') as Record<string, boolean>;
        if (prefs.os_status !== false) {
          await sendEmail(c.env.RESEND_API_KEY, {
            to: requester.email,
            subject: `OS "${order.title}" → ${body.status}`,
            html: emailOsStatusChanged({
              recipientName: requester.name,
              orderTitle: order.title,
              oldStatus: order.status,
              newStatus: body.status,
              propertyName: requester.property_name,
              appUrl,
              serviceUrl: `${appUrl}/properties/${propertyId}/services/${id}`,
            }),
          });
        }
      }
    } catch (e) {
      console.error('OS status email failed:', e);
    }
  })();

  return ok(c, { order: updated });
});

// ── POST /properties/:propertyId/services/:id/photos ─────────────────────────

services.post('/:id/photos', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canUploadServiceEvidence(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [order] = await db
    .select({
      id: serviceOrders.id,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
    })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1) as Array<{ id: string; before_photos: string[] | null; after_photos: string[] | null }>;

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const photoType = (formData.get('type') as string) === 'after' ? 'after' : 'before';
  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const validation = validateUpload(file.type, file.size);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'photos', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);

  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  const current = photoType === 'after'
    ? [...(order.after_photos ?? [])]
    : [...(order.before_photos ?? [])];
  current.push(fileUrl);

  await db
    .update(serviceOrders)
    .set(photoType === 'after' ? { afterPhotos: current } : { beforePhotos: current })
    .where(eq(serviceOrders.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order',
    entityId: id,
    action: 'service_order_evidence_uploaded',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      service_order_id: id,
      evidence_type: 'photo',
      photo_type: photoType,
      file_mime_type: file.type,
      file_size: file.size,
      actor_id: userId,
    },
  });

  return ok(c, { url: fileUrl, type: photoType });
});

// ── POST /properties/:propertyId/services/:id/video ──────────────────────────

services.post('/:id/video', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canUploadServiceEvidence(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [order] = await db
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1);

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  if (file.type !== 'video/mp4') return err(c, 'Apenas vídeos MP4 são aceitos', 'INVALID_FILE', 422);
  if (file.size > 50 * 1024 * 1024) return err(c, 'Vídeo excede 50MB', 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'videos', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, 'video/mp4');

  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  await db.update(serviceOrders).set({ videoUrl: fileUrl }).where(eq(serviceOrders.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order',
    entityId: id,
    action: 'service_order_evidence_uploaded',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      service_order_id: id,
      evidence_type: 'video',
      file_mime_type: file.type,
      file_size: file.size,
      actor_id: userId,
    },
  });

  return ok(c, { video_url: fileUrl });
});

// ── POST /properties/:propertyId/services/:id/audio ──────────────────────────

services.post('/:id/audio', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canUploadServiceEvidence(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [order] = await db
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1);

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const allowed = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm']);
  if (!allowed.has(file.type)) return err(c, 'Tipo de áudio não permitido', 'INVALID_FILE', 422);
  if (file.size > 20 * 1024 * 1024) return err(c, 'Áudio excede 20MB', 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'documents', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);

  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  await db.update(serviceOrders).set({ audioUrl: fileUrl }).where(eq(serviceOrders.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order',
    entityId: id,
    action: 'service_order_evidence_uploaded',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      service_order_id: id,
      evidence_type: 'audio',
      file_mime_type: file.type,
      file_size: file.size,
      actor_id: userId,
    },
  });

  return ok(c, { audio_url: fileUrl });
});

// ── DELETE /properties/:propertyId/services/:id ──────────────────────────────

services.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canDeleteServiceOrder(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [old] = await db
    .select({
      id: serviceOrders.id,
      property_id: serviceOrders.propertyId,
      room_id: serviceOrders.roomId,
      system_type: serviceOrders.systemType,
      requested_by: serviceOrders.requestedBy,
      assigned_to: serviceOrders.assignedTo,
      title: serviceOrders.title,
      description: serviceOrders.description,
      priority: serviceOrders.priority,
      status: serviceOrders.status,
      cost: serviceOrders.cost,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      video_url: serviceOrders.videoUrl,
      audio_url: serviceOrders.audioUrl,
      checklist: serviceOrders.checklist,
      warranty_until: serviceOrders.warrantyUntil,
      scheduled_at: serviceOrders.scheduledAt,
      completed_at: serviceOrders.completedAt,
      created_at: serviceOrders.createdAt,
      deleted_at: serviceOrders.deletedAt,
    })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1) as Array<ServiceOrder>;

  if (!old) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  await db.update(serviceOrders).set({ deletedAt: sql`datetime('now')` }).where(eq(serviceOrders.id, id));

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order',
    entityId: id,
    action: 'service_order_deleted',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: { previous_status: old.status },
    newData: {
      property_id: propertyId,
      service_order_id: id,
      previous_status: old.status,
      actor_id: userId,
    },
  });

  return ok(c, { success: true });
});

// ── PATCH /properties/:propertyId/services/:id/checklist ─────────────────────

services.patch('/:id/checklist', async (c) => {
  const db = getDb(c.env.DB);
  const { propertyId, id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canUpdateServiceOrderChecklist(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json<{ checklist: { item: string; done: boolean }[] }>().catch(() => null);
  if (!body?.checklist || !Array.isArray(body.checklist)) {
    return err(c, 'Checklist inválido', 'INVALID_BODY');
  }

  const [order] = await db
    .select({
      id: serviceOrders.id,
      checklist: serviceOrders.checklist,
    })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1) as Array<{ id: string; checklist: { item: string; done: boolean }[] | null }>;

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const sanitized = body.checklist.map((item) => ({
    item: String(item.item ?? '').slice(0, 200),
    done: Boolean(item.done),
  }));

  await db.update(serviceOrders).set({ checklist: sanitized }).where(eq(serviceOrders.id, id));

  const previousChecklist = Array.isArray(order.checklist) ? order.checklist : [];

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order',
    entityId: id,
    action: 'service_order_checklist_updated',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: {
      checklist_items_count: previousChecklist.length,
      completed_items_count: previousChecklist.filter((item) => item.done).length,
    },
    newData: {
      property_id: propertyId,
      service_order_id: id,
      checklist_items_count: sanitized.length,
      completed_items_count: sanitized.filter((item) => item.done).length,
      actor_id: userId,
    },
  });

  return ok(c, { checklist: sanitized });
});

export default services;
