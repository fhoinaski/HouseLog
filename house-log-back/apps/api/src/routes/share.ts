import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { getDb } from '../db/client';
import { properties, rooms, serviceOrders, serviceShareLinks, users } from '../db/schema';
import { writeAuditLog } from '../lib/audit';
import { sha256TokenHash } from '../lib/token-hash';
import type { Bindings, Variables } from '../lib/types';
import { createId } from '../lib/id';

const share = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── POST /properties/:propertyId/services/:serviceId/share-link ──────────────
// Always creates a fresh link, revoking any active link first.
// Token puro is emitted once in the response — never stored in the DB.
// Requires auth — only owners/managers can share.

share.post('/properties/:propertyId/services/:serviceId/share-link', authMiddleware, resolveTenant, async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const serviceId  = c.req.param('serviceId');
  const userId = c.get('userId');
  const role   = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => ({})) as {
    expires_hours?: number;
    provider_name?: string;
    provider_email?: string;
    provider_phone?: string;
    share_credentials?: boolean;
  };

  const expiresHours = Math.min(body.expires_hours ?? 72, 720); // max 30 days
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

  // Check service belongs to this property
  const [service] = await db
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(
      and(
        eq(serviceOrders.id, serviceId),
        eq(serviceOrders.tenantId, tenantId),
        eq(serviceOrders.propertyId, propertyId),
        eq(properties.tenantId, tenantId),
        isNull(serviceOrders.deletedAt),
        isNull(properties.deletedAt)
      )
    )
    .limit(1);
  if (!service) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  // Revoke any existing active link so only one is active at a time
  const [existing] = await db
    .select({ id: serviceShareLinks.id })
    .from(serviceShareLinks)
    .where(
      and(
        eq(serviceShareLinks.serviceId, serviceId),
        eq(serviceShareLinks.tenantId, tenantId),
        isNull(serviceShareLinks.deletedAt)
      )
    )
    .orderBy(desc(serviceShareLinks.createdAt))
    .limit(1) as Array<{ id: string }>;

  if (existing) {
    await db
      .update(serviceShareLinks)
      .set({ deletedAt: new Date().toISOString() })
      .where(and(eq(serviceShareLinks.id, existing.id), eq(serviceShareLinks.tenantId, tenantId)));
  }

  // Always create a fresh token — never stored in DB
  const linkId = createId();
  const token = nanoid(32);
  const tokenHash = await sha256TokenHash(token);
  await db.insert(serviceShareLinks).values({
    id: linkId,
    tenantId,
    serviceId,
    token: `hash-only:${linkId}`,
    tokenHash,
    createdBy: userId,
    expiresAt,
    providerName: body.provider_name ?? null,
    providerEmail: body.provider_email ?? null,
    providerPhone: body.provider_phone ?? null,
    shareCredentials: body.share_credentials ? 1 : 0,
  });

  const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'service_share_link', entityId: linkId,
    action: 'share_link_created',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      service_id: serviceId,
      property_id: propertyId,
      expires_at: expiresAt,
    },
  });

  return ok(c, {
    url: `${appUrl}/share/service/${token}`,
    expires_at: expiresAt,
  }, 201);
});

// ── GET /public/share/service/:token ─────────────────────────────────────────
// No auth — public endpoint for external providers.

share.get('/public/share/service/:token', async (c) => {
  const db = getDb(c.env.DB);
  const rawToken = c.req.param('token');
  if (!rawToken || rawToken.length < 8) return err(c, 'Token inválido', 'INVALID_TOKEN', 400);

  const tokenHash = await sha256TokenHash(rawToken);

  const [link] = await db
    .select({
      id: serviceShareLinks.id,
      tenant_id: serviceShareLinks.tenantId,
      service_id: serviceShareLinks.serviceId,
      property_id: serviceOrders.propertyId,
      expires_at: serviceShareLinks.expiresAt,
      deleted_at: serviceShareLinks.deletedAt,
      provider_name: serviceShareLinks.providerName,
      provider_accepted_at: serviceShareLinks.providerAcceptedAt,
      provider_started_at: serviceShareLinks.providerStartedAt,
      provider_done_at: serviceShareLinks.providerDoneAt,
      notes_from_provider: serviceShareLinks.notesFromProvider,
      share_credentials: serviceShareLinks.shareCredentials,
      title: serviceOrders.title,
      description: serviceOrders.description,
      status: serviceOrders.status,
      priority: serviceOrders.priority,
      system_type: serviceOrders.systemType,
      scheduled_at: serviceOrders.scheduledAt,
      cost: serviceOrders.cost,
      checklist: serviceOrders.checklist,
      before_photos: serviceOrders.beforePhotos,
      after_photos: serviceOrders.afterPhotos,
      warranty_until: serviceOrders.warrantyUntil,
      completed_at: serviceOrders.completedAt,
      property_name: properties.name,
      property_address: properties.address,
      property_city: properties.city,
      property_type: properties.type,
      requested_by_name: users.name,
      room_name: rooms.name,
    })
    .from(serviceShareLinks)
    .innerJoin(serviceOrders, eq(serviceOrders.id, serviceShareLinks.serviceId))
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .innerJoin(users, eq(users.id, serviceOrders.requestedBy))
    .leftJoin(rooms, and(eq(rooms.id, serviceOrders.roomId), eq(rooms.tenantId, serviceOrders.tenantId), eq(rooms.propertyId, serviceOrders.propertyId)))
    .where(
      and(
        // Hash lookup for new records; fallback to plaintext for legacy records without hash
        sql`(${serviceShareLinks.tokenHash} = ${tokenHash} OR (${serviceShareLinks.tokenHash} IS NULL AND ${serviceShareLinks.token} = ${rawToken}))`,
        eq(serviceShareLinks.tenantId, serviceOrders.tenantId),
        eq(serviceShareLinks.tenantId, properties.tenantId),
        isNull(serviceOrders.deletedAt)
      )
    )
    .limit(1) as Array<Record<string, unknown>>;

  if (!link) return err(c, 'Link não encontrado', 'NOT_FOUND', 404);
  if (link.deleted_at) return err(c, 'Link revogado', 'GONE', 410);
  if (new Date(String(link.expires_at)) < new Date()) return err(c, 'Link expirado', 'LINK_EXPIRED', 410);

  await writeAuditLog(c.env.DB, {
    tenantId: String(link.tenant_id),
    propertyId: String(link.property_id),
    entityType: 'service_share_link',
    entityId: String(link.id),
    action: 'share_link_public_viewed',
    actorId: null,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      service_id: String(link.service_id),
      source: 'public_share_link',
    },
  });

  return ok(c, {
    service: {
      title: link.title,
      description: link.description,
      status: link.status,
      priority: link.priority,
      system_type: link.system_type,
      scheduled_at: link.scheduled_at,
      cost: link.cost,
      checklist: link.checklist ? JSON.parse(link.checklist as string) : [],
      before_photos: parseStringArray(link.before_photos),
      after_photos: parseStringArray(link.after_photos),
      warranty_until: link.warranty_until,
      completed_at: link.completed_at,
      room_name: link.room_name,
      requested_by_name: link.requested_by_name,
    },
    property: {
      name: link.property_name,
      address: link.property_address,
      city: link.property_city,
      type: link.property_type,
    },
    link: {
      expires_at: link.expires_at,
      provider_name: link.provider_name,
      provider_accepted_at: link.provider_accepted_at,
      provider_started_at: link.provider_started_at,
      provider_done_at: link.provider_done_at,
      notes_from_provider: link.notes_from_provider,
      share_credentials: false,
    },
    credentials: [],
  });
});

// ── PATCH /public/share/service/:token/status ─────────────────────────────────
// External provider updates their status on the OS.

const providerStatusSchema = z.object({
  action: z.enum(['accept', 'start', 'done']),
  provider_name: z.string().optional(),
  notes: z.string().optional(),
});

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

share.patch('/public/share/service/:token/status', async (c) => {
  const db = getDb(c.env.DB);
  const rawToken = c.req.param('token');
  if (!rawToken || rawToken.length < 8) return err(c, 'Token inválido', 'INVALID_TOKEN', 400);

  const tokenHash = await sha256TokenHash(rawToken);

  const [link] = await db
    .select({
      id: serviceShareLinks.id,
      tenant_id: serviceShareLinks.tenantId,
      service_id: serviceShareLinks.serviceId,
      property_id: serviceOrders.propertyId,
      provider_accepted_at: serviceShareLinks.providerAcceptedAt,
      expires_at: serviceShareLinks.expiresAt,
      deleted_at: serviceShareLinks.deletedAt,
    })
    .from(serviceShareLinks)
    .innerJoin(serviceOrders, eq(serviceOrders.id, serviceShareLinks.serviceId))
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(
      and(
        sql`(${serviceShareLinks.tokenHash} = ${tokenHash} OR (${serviceShareLinks.tokenHash} IS NULL AND ${serviceShareLinks.token} = ${rawToken}))`,
        eq(serviceShareLinks.tenantId, serviceOrders.tenantId),
        eq(serviceShareLinks.tenantId, properties.tenantId),
        isNull(serviceOrders.deletedAt),
        isNull(properties.deletedAt)
      )
    )
    .limit(1) as Array<{ id: string; tenant_id: string; service_id: string; property_id: string; provider_accepted_at: string | null; expires_at: string; deleted_at: string | null }>;

  if (!link) return err(c, 'Link não encontrado', 'NOT_FOUND', 404);
  if (link.deleted_at) return err(c, 'Link revogado', 'GONE', 410);
  if (new Date(link.expires_at) < new Date()) return err(c, 'Link expirado', 'LINK_EXPIRED', 410);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = providerStatusSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);

  const { action, provider_name, notes } = parsed.data;
  const now = new Date().toISOString();
  const linkUpdate: {
    providerAcceptedAt?: string;
    providerStartedAt?: string;
    providerDoneAt?: string;
    providerName?: string;
    notesFromProvider?: string;
  } = {};

  if (action === 'accept') {
    linkUpdate.providerAcceptedAt = now;
    if (provider_name) linkUpdate.providerName = provider_name;
    if (notes) linkUpdate.notesFromProvider = notes;
    // Also advance service status to approved if still requested
    await db
      .update(serviceOrders)
      .set({ status: 'approved' })
      .where(and(eq(serviceOrders.id, link.service_id), eq(serviceOrders.tenantId, link.tenant_id), eq(serviceOrders.status, 'requested')));
  } else if (action === 'start') {
    linkUpdate.providerStartedAt = now;
    if (notes) linkUpdate.notesFromProvider = notes;
    await db
      .update(serviceOrders)
      .set({ status: 'in_progress' })
      .where(and(eq(serviceOrders.id, link.service_id), eq(serviceOrders.tenantId, link.tenant_id), inArray(serviceOrders.status, ['requested', 'approved'])));
  } else if (action === 'done') {
    linkUpdate.providerDoneAt = now;
    if (notes) linkUpdate.notesFromProvider = notes;
    await db
      .update(serviceOrders)
      .set({ status: 'completed', completedAt: now })
      .where(and(eq(serviceOrders.id, link.service_id), eq(serviceOrders.tenantId, link.tenant_id), sql`${serviceOrders.status} != 'verified'`));
  }

  if (Object.keys(linkUpdate).length > 0) {
    await db.update(serviceShareLinks).set(linkUpdate).where(and(eq(serviceShareLinks.id, link.id), eq(serviceShareLinks.tenantId, link.tenant_id)));
  }

  await writeAuditLog(c.env.DB, {
    tenantId: link.tenant_id,
    propertyId: link.property_id,
    entityType: 'service_share_link',
    entityId: link.id,
    action: 'share_link_public_status_updated',
    actorId: null,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      service_id: link.service_id,
      action,
      provider_name: provider_name ?? null,
      notes_provided: !!notes,
    },
  });

  return ok(c, { action, updated_at: now });
});

export default share;
