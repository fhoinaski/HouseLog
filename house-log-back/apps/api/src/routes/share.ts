import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { getDb } from '../db/client';
import { properties, propertyAccessCredentials, rooms, serviceOrders, serviceShareLinks, users } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const share = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── POST /properties/:propertyId/services/:serviceId/share-link ──────────────
// Creates (or returns existing valid) share link for a service order.
// Requires auth — only owners/managers can share.

share.post('/properties/:propertyId/services/:serviceId/share-link', authMiddleware, async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId');
  const serviceId  = c.req.param('serviceId');
  const userId = c.get('userId');
  const role   = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
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
    .where(and(eq(serviceOrders.id, serviceId), eq(serviceOrders.propertyId, propertyId), isNull(serviceOrders.deletedAt)))
    .limit(1);
  if (!service) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  // Reuse existing valid token if one exists
  const [existing] = await db
    .select({ token: serviceShareLinks.token })
    .from(serviceShareLinks)
    .where(
      and(
        eq(serviceShareLinks.serviceId, serviceId),
        gt(serviceShareLinks.expiresAt, sql`datetime('now')`),
        isNull(serviceShareLinks.deletedAt)
      )
    )
    .orderBy(desc(serviceShareLinks.createdAt))
    .limit(1) as Array<{ token: string }>;

  let token: string;
  if (existing) {
    token = existing.token;
    // Update provider info if provided
    if (body.provider_name || body.provider_email) {
      await db
        .update(serviceShareLinks)
        .set({
          providerName: body.provider_name ?? null,
          providerEmail: body.provider_email ?? null,
          providerPhone: body.provider_phone ?? null,
          shareCredentials: body.share_credentials ? 1 : 0,
          expiresAt,
        })
        .where(eq(serviceShareLinks.token, token));
    }
  } else {
    token = nanoid(32);
    await db.insert(serviceShareLinks).values({
      id: nanoid(),
      serviceId,
      token,
      createdBy: userId,
      expiresAt,
      providerName: body.provider_name ?? null,
      providerEmail: body.provider_email ?? null,
      providerPhone: body.provider_phone ?? null,
      shareCredentials: body.share_credentials ? 1 : 0,
    });
  }

  const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';

  return ok(c, {
    token,
    url: `${appUrl}/share/service/${token}`,
    expires_at: expiresAt,
  }, 201);
});

// ── GET /public/share/service/:token ─────────────────────────────────────────
// No auth — public endpoint for external providers.

share.get('/public/share/service/:token', async (c) => {
  const db = getDb(c.env.DB);
  const token = c.req.param('token');

  const [link] = await db
    .select({
      id: serviceShareLinks.id,
      service_id: serviceShareLinks.serviceId,
      expires_at: serviceShareLinks.expiresAt,
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
    .leftJoin(rooms, eq(rooms.id, serviceOrders.roomId))
    .where(
      and(
        eq(serviceShareLinks.token, token),
        gt(serviceShareLinks.expiresAt, sql`datetime('now')`),
        isNull(serviceShareLinks.deletedAt),
        isNull(serviceOrders.deletedAt)
      )
    )
    .limit(1) as Array<Record<string, unknown>>;

  if (!link) return err(c, 'Link inválido ou expirado', 'NOT_FOUND', 404);

  // Optionally include credentials marked for sharing
  let sharedCredentials: unknown[] = [];
  if (link.share_credentials) {
    const [serviceProperty] = await db
      .select({ propertyId: serviceOrders.propertyId })
      .from(serviceOrders)
      .where(eq(serviceOrders.id, String(link.service_id)))
      .limit(1);

    if (serviceProperty) {
      const creds = await db
        .select({
          category: propertyAccessCredentials.category,
          label: propertyAccessCredentials.label,
          username: propertyAccessCredentials.username,
          secret: propertyAccessCredentials.secret,
          notes: propertyAccessCredentials.notes,
        })
        .from(propertyAccessCredentials)
        .where(
          and(
            eq(propertyAccessCredentials.propertyId, serviceProperty.propertyId),
            eq(propertyAccessCredentials.shareWithOs, 1),
            isNull(propertyAccessCredentials.deletedAt)
          )
        );
      sharedCredentials = creds;
    }
  }

  return ok(c, {
    service: {
      id: link.service_id,
      title: link.title,
      description: link.description,
      status: link.status,
      priority: link.priority,
      system_type: link.system_type,
      scheduled_at: link.scheduled_at,
      cost: link.cost,
      checklist: link.checklist ? JSON.parse(link.checklist as string) : [],
      before_photos: link.before_photos ? JSON.parse(link.before_photos as string) : [],
      after_photos: link.after_photos ? JSON.parse(link.after_photos as string) : [],
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
      token,
      expires_at: link.expires_at,
      provider_name: link.provider_name,
      provider_accepted_at: link.provider_accepted_at,
      provider_started_at: link.provider_started_at,
      provider_done_at: link.provider_done_at,
      notes_from_provider: link.notes_from_provider,
      share_credentials: link.share_credentials === 1,
    },
    credentials: sharedCredentials,
  });
});

// ── PATCH /public/share/service/:token/status ─────────────────────────────────
// External provider updates their status on the OS.

const providerStatusSchema = z.object({
  action: z.enum(['accept', 'start', 'done']),
  provider_name: z.string().optional(),
  notes: z.string().optional(),
});

share.patch('/public/share/service/:token/status', async (c) => {
  const db = getDb(c.env.DB);
  const token = c.req.param('token');

  const [link] = await db
    .select({
      id: serviceShareLinks.id,
      service_id: serviceShareLinks.serviceId,
      provider_accepted_at: serviceShareLinks.providerAcceptedAt,
    })
    .from(serviceShareLinks)
    .where(
      and(
        eq(serviceShareLinks.token, token),
        gt(serviceShareLinks.expiresAt, sql`datetime('now')`),
        isNull(serviceShareLinks.deletedAt)
      )
    )
    .limit(1) as Array<{ id: string; service_id: string; provider_accepted_at: string | null }>;

  if (!link) return err(c, 'Link inválido ou expirado', 'NOT_FOUND', 404);

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
      .where(and(eq(serviceOrders.id, link.service_id), eq(serviceOrders.status, 'requested')));
  } else if (action === 'start') {
    linkUpdate.providerStartedAt = now;
    if (notes) linkUpdate.notesFromProvider = notes;
    await db
      .update(serviceOrders)
      .set({ status: 'in_progress' })
      .where(and(eq(serviceOrders.id, link.service_id), inArray(serviceOrders.status, ['requested', 'approved'])));
  } else if (action === 'done') {
    linkUpdate.providerDoneAt = now;
    if (notes) linkUpdate.notesFromProvider = notes;
    await db
      .update(serviceOrders)
      .set({ status: 'completed', completedAt: now })
      .where(and(eq(serviceOrders.id, link.service_id), sql`${serviceOrders.status} != 'verified'`));
  }

  if (Object.keys(linkUpdate).length > 0) {
    await db.update(serviceShareLinks).set(linkUpdate).where(eq(serviceShareLinks.id, link.id));
  }

  return ok(c, { action, updated_at: now });
});

export default share;
