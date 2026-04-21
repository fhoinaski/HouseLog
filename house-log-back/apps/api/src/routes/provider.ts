import { Hono } from 'hono';
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { ok, err, paginate } from '../lib/response';
import { writeAuditLog } from '../lib/audit';
import {
  canAccessProviderPortal,
  canUploadProviderInvoice,
  canViewAssignedProviderService,
  canViewProviderOpportunity,
} from '../lib/authorization';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/client';
import { documents, properties, rooms, serviceBids, serviceOrders, users } from '../db/schema';
import { normalizeProviderCategories } from '../lib/provider-categories';
import type { Bindings, Variables, ServiceOrder } from '../lib/types';

const provider = new Hono<{ Bindings: Bindings; Variables: Variables }>();
provider.use('*', authMiddleware);

// GET /provider/services
provider.get('/services', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await canAccessProviderPortal(c.env.DB, { userId, role }))) {
    return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);
  }

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const status = c.req.query('status');

  const filters = [eq(serviceOrders.assignedTo, userId), isNull(serviceOrders.deletedAt)];
  if (status) filters.push(eq(serviceOrders.status, status as typeof serviceOrders.$inferSelect.status));
  if (cursor) filters.push(lt(serviceOrders.createdAt, cursor));

  const results = await db
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
      requested_by_name: users.name,
      room_name: rooms.name,
      property_name: properties.name,
      property_address: properties.address,
    })
    .from(serviceOrders)
    .innerJoin(users, eq(users.id, serviceOrders.requestedBy))
    .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(and(...filters))
    .orderBy(
      sql`CASE ${serviceOrders.priority} WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`,
      desc(serviceOrders.createdAt)
    )
    .limit(limit + 1) as Array<ServiceOrder & {
    requested_by_name: string; room_name: string | null;
    property_name: string; property_address: string;
  }>;

  const visibleResults = results.filter((row) => canViewAssignedProviderService({
    userId,
    role,
    assignedProviderId: row.assigned_to,
    deletedAt: row.deleted_at,
  }));

  return ok(c, paginate(visibleResults, limit, 'created_at'));
});

// GET /provider/opportunities
provider.get('/opportunities', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await canAccessProviderPortal(c.env.DB, { userId, role }))) {
    return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);
  }

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const systemType = c.req.query('system_type');

  const [me] = await db
    .select({ provider_categories: users.providerCategories })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1) as Array<{ provider_categories: string[] | null }>;

  const categories = normalizeProviderCategories(me?.provider_categories ?? []);

  const filters = [
    eq(serviceOrders.status, 'requested'),
    isNull(serviceOrders.assignedTo),
    isNull(serviceOrders.deletedAt),
  ];

  if (systemType) {
    filters.push(eq(serviceOrders.systemType, systemType as typeof serviceOrders.$inferSelect.systemType));
  }

  if (categories.length > 0 && !systemType) {
    filters.push(sql`${serviceOrders.systemType} IN ${categories}`);
  }

  if (cursor) filters.push(lt(serviceOrders.createdAt, cursor));

  const results = await db
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
      requested_by_name: users.name,
      room_name: rooms.name,
      property_name: properties.name,
      property_address: properties.address,
    })
    .from(serviceOrders)
    .innerJoin(users, eq(users.id, serviceOrders.requestedBy))
    .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(and(...filters))
    .orderBy(
      sql`CASE ${serviceOrders.priority} WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END`,
      desc(serviceOrders.createdAt)
    )
    .limit(limit + 1) as Array<ServiceOrder & {
    requested_by_name: string;
    room_name: string | null;
    property_name: string;
    property_address: string;
  }>;

  const visibleResults = results.filter((row) => canViewProviderOpportunity({
    userId,
    role,
    serviceOrderStatus: row.status,
    assignedProviderId: row.assigned_to,
    deletedAt: row.deleted_at,
    serviceOrderSystemType: row.system_type,
    providerCategories: categories,
    requestedSystemType: systemType,
  }));

  const serviceIds = visibleResults.map((r) => r.id);
  const myBids = serviceIds.length
    ? await db
      .select({
        id: serviceBids.id,
        service_id: serviceBids.serviceId,
        amount: serviceBids.amount,
        status: serviceBids.status,
        created_at: serviceBids.createdAt,
      })
      .from(serviceBids)
      .where(and(sql`${serviceBids.serviceId} IN ${serviceIds}`, eq(serviceBids.providerId, userId)))
      .orderBy(desc(serviceBids.createdAt))
    : [];

  const bidByService = new Map<string, { id: string; amount: number; status: string; created_at: string }>();
  for (const bid of myBids) {
    if (!bidByService.has(bid.service_id)) {
      bidByService.set(bid.service_id, {
        id: bid.id,
        amount: bid.amount,
        status: bid.status,
        created_at: bid.created_at,
      });
    }
  }

  const enriched = visibleResults.map((row) => ({
    ...row,
    my_bid: bidByService.get(row.id) ?? null,
  }));

  return ok(c, paginate(enriched, limit, 'created_at'));
});

// GET /provider/opportunities/:id
provider.get('/opportunities/:id', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  const id = c.req.param('id')!;
  if (!(await canAccessProviderPortal(c.env.DB, { userId, role }))) {
    return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);
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
      requested_by_name: users.name,
      room_name: rooms.name,
      property_name: properties.name,
      property_address: properties.address,
    })
    .from(serviceOrders)
    .innerJoin(users, eq(users.id, serviceOrders.requestedBy))
    .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(and(eq(serviceOrders.id, id), eq(serviceOrders.status, 'requested'), isNull(serviceOrders.assignedTo), isNull(serviceOrders.deletedAt)))
    .limit(1);

  if (!order) return err(c, 'Oportunidade não encontrada', 'NOT_FOUND', 404);

  if (!canViewProviderOpportunity({
    userId,
    role,
    serviceOrderStatus: order.status,
    assignedProviderId: order.assigned_to,
    deletedAt: order.deleted_at,
  })) {
    return err(c, 'Oportunidade não encontrada', 'NOT_FOUND', 404);
  }

  const myBids = await db
    .select({
      id: serviceBids.id,
      service_id: serviceBids.serviceId,
      provider_id: serviceBids.providerId,
      amount: serviceBids.amount,
      notes: serviceBids.notes,
      status: serviceBids.status,
      created_at: serviceBids.createdAt,
      updated_at: serviceBids.updatedAt,
    })
    .from(serviceBids)
    .where(and(eq(serviceBids.serviceId, id), eq(serviceBids.providerId, userId)))
    .orderBy(desc(serviceBids.createdAt));

  return ok(c, { order, my_bids: myBids });
});

// GET /provider/services/:id
provider.get('/services/:id', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  const id = c.req.param('id')!;
  if (!(await canAccessProviderPortal(c.env.DB, { userId, role }))) {
    return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);
  }

  const whereClause = role === 'admin'
    ? and(eq(serviceOrders.id, id), isNull(serviceOrders.deletedAt))
    : and(eq(serviceOrders.id, id), eq(serviceOrders.assignedTo, userId), isNull(serviceOrders.deletedAt));

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
      requested_by_name: users.name,
      room_name: rooms.name,
      property_name: properties.name,
      property_address: properties.address,
    })
    .from(serviceOrders)
    .innerJoin(users, eq(users.id, serviceOrders.requestedBy))
    .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(whereClause)
    .limit(1);

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  if (!canViewAssignedProviderService({
    userId,
    role,
    assignedProviderId: order.assigned_to,
    deletedAt: order.deleted_at,
  })) {
    return err(c, 'OS não encontrada', 'NOT_FOUND', 404);
  }

  // Fetch bids for this order submitted by this provider
  const myBids = await db
    .select()
    .from(serviceBids)
    .where(and(eq(serviceBids.serviceId, id), eq(serviceBids.providerId, userId)))
    .orderBy(desc(serviceBids.createdAt));

  return ok(c, { order, my_bids: myBids });
});

// GET /provider/stats
provider.get('/stats', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!(await canAccessProviderPortal(c.env.DB, { userId, role }))) {
    return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);
  }

  const statusCounts = await db
    .select({ status: serviceOrders.status, count: sql<number>`COUNT(*)` })
    .from(serviceOrders)
    .where(and(eq(serviceOrders.assignedTo, userId), isNull(serviceOrders.deletedAt)))
    .groupBy(serviceOrders.status) as Array<{ status: string; count: number }>;

  const stats = statusCounts.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {} as Record<string, number>);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  const recentBids = await db
    .select({
      id: serviceBids.id,
      service_id: serviceBids.serviceId,
      provider_id: serviceBids.providerId,
      amount: serviceBids.amount,
      notes: serviceBids.notes,
      status: serviceBids.status,
      created_at: serviceBids.createdAt,
      updated_at: serviceBids.updatedAt,
      service_title: serviceOrders.title,
      property_name: properties.name,
    })
    .from(serviceBids)
    .innerJoin(serviceOrders, eq(serviceOrders.id, serviceBids.serviceId))
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(eq(serviceBids.providerId, userId))
    .orderBy(desc(serviceBids.createdAt))
    .limit(5);

  return ok(c, { stats, total, recent_bids: recentBids });
});

// POST /provider/services/:id/invoice — provider uploads nota fiscal
provider.post('/services/:id/invoice', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  const id = c.req.param('id')!;
  if (!(await canAccessProviderPortal(c.env.DB, { userId, role }))) {
    return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);
  }

  const whereClause = role === 'admin'
    ? and(eq(serviceOrders.id, id), isNull(serviceOrders.deletedAt))
    : and(eq(serviceOrders.id, id), eq(serviceOrders.assignedTo, userId), isNull(serviceOrders.deletedAt));

  const [order] = await db
    .select({ id: serviceOrders.id, property_id: serviceOrders.propertyId, assigned_to: serviceOrders.assignedTo, deleted_at: serviceOrders.deletedAt })
    .from(serviceOrders)
    .where(whereClause)
    .limit(1) as Array<{ id: string; property_id: string; assigned_to: string | null; deleted_at: string | null }>;

  if (!order) return err(c, 'OS não encontrada ou sem acesso', 'NOT_FOUND', 404);

  if (!canUploadProviderInvoice({
    userId,
    role,
    assignedProviderId: order.assigned_to,
    deletedAt: order.deleted_at,
  })) {
    return err(c, 'OS não encontrada ou sem acesso', 'NOT_FOUND', 404);
  }

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) return err(c, 'Tipo de arquivo não permitido', 'INVALID_FILE', 422);
  if (file.size > 10 * 1024 * 1024) return err(c, 'Arquivo excede 10MB', 'INVALID_FILE', 422);

  const { buildR2Key, uploadToR2, getPublicUrl } = await import('../lib/r2');
  const key = buildR2Key({ propertyId: order.property_id, category: 'invoices', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);
  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  // Create a document record linked to this service
  const { nanoid } = await import('nanoid');
  const docId = nanoid();
  await db.insert(documents).values({
    id: docId,
    propertyId: order.property_id,
    serviceId: id,
    type: 'invoice',
    title: `Nota Fiscal - ${id.slice(0, 8).toUpperCase()}`,
    fileUrl,
    fileSize: file.size,
    uploadedBy: userId,
  });

  await writeAuditLog(c.env.DB, {
    entityType: 'document',
    entityId: docId,
    action: 'document_uploaded',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: order.property_id,
      service_order_id: id,
      document_id: docId,
      type: 'invoice',
      title: `Nota Fiscal - ${id.slice(0, 8).toUpperCase()}`,
      file_mime_type: file.type,
      file_size: file.size,
      upload_source: 'provider_invoice',
      actor_id: userId,
      actor_role: role,
    },
  });

  return ok(c, { invoice_url: fileUrl, document_id: docId });
});

export default provider;
