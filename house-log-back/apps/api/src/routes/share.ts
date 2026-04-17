import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';

const share = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── POST /properties/:propertyId/services/:serviceId/share-link ──────────────
// Creates (or returns existing valid) share link for a service order.
// Requires auth — only owners/managers can share.

share.post('/properties/:propertyId/services/:serviceId/share-link', authMiddleware, async (c) => {
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
  const service = await c.env.DB
    .prepare(`SELECT id FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL`)
    .bind(serviceId, propertyId)
    .first();
  if (!service) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  // Reuse existing valid token if one exists
  const existing = await c.env.DB
    .prepare(
      `SELECT token FROM service_share_links
       WHERE service_id = ? AND expires_at > datetime('now') AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .bind(serviceId)
    .first<{ token: string }>();

  let token: string;
  if (existing) {
    token = existing.token;
    // Update provider info if provided
    if (body.provider_name || body.provider_email) {
      await c.env.DB
        .prepare(
          `UPDATE service_share_links
           SET provider_name = ?, provider_email = ?, provider_phone = ?,
               share_credentials = ?, expires_at = ?
           WHERE token = ?`
        )
        .bind(
          body.provider_name ?? null,
          body.provider_email ?? null,
          body.provider_phone ?? null,
          body.share_credentials ? 1 : 0,
          expiresAt,
          token
        )
        .run();
    }
  } else {
    token = nanoid(32);
    await c.env.DB
      .prepare(
        `INSERT INTO service_share_links
           (id, service_id, token, created_by, expires_at,
            provider_name, provider_email, provider_phone, share_credentials)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        nanoid(), serviceId, token, userId, expiresAt,
        body.provider_name ?? null,
        body.provider_email ?? null,
        body.provider_phone ?? null,
        body.share_credentials ? 1 : 0
      )
      .run();
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
  const token = c.req.param('token');

  const link = await c.env.DB
    .prepare(
      `SELECT sl.*, so.title, so.description, so.status, so.priority, so.system_type,
              so.scheduled_at, so.cost, so.checklist, so.before_photos, so.after_photos,
              so.warranty_until, so.completed_at,
              p.name as property_name, p.address as property_address, p.city as property_city,
              p.type as property_type,
              u.name as requested_by_name,
              r.name as room_name
       FROM service_share_links sl
       JOIN service_orders so ON so.id = sl.service_id
       JOIN properties p ON p.id = so.property_id
       JOIN users u ON u.id = so.requested_by
       LEFT JOIN rooms r ON r.id = so.room_id
       WHERE sl.token = ?
         AND sl.expires_at > datetime('now')
         AND sl.deleted_at IS NULL
         AND so.deleted_at IS NULL`
    )
    .bind(token)
    .first<Record<string, unknown>>();

  if (!link) return err(c, 'Link inválido ou expirado', 'NOT_FOUND', 404);

  // Optionally include credentials marked for sharing
  let sharedCredentials: unknown[] = [];
  if (link.share_credentials) {
    const { results } = await c.env.DB
      .prepare(
        `SELECT category, label, username, secret, notes
         FROM property_access_credentials
         WHERE property_id = (
           SELECT property_id FROM service_orders WHERE id = ?
         )
         AND share_with_os = 1 AND deleted_at IS NULL`
      )
      .bind(link.service_id)
      .all();
    sharedCredentials = results;
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
  const token = c.req.param('token');

  const link = await c.env.DB
    .prepare(
      `SELECT sl.id, sl.service_id, sl.provider_accepted_at
       FROM service_share_links sl
       WHERE sl.token = ? AND sl.expires_at > datetime('now') AND sl.deleted_at IS NULL`
    )
    .bind(token)
    .first<{ id: string; service_id: string; provider_accepted_at: string | null }>();

  if (!link) return err(c, 'Link inválido ou expirado', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = providerStatusSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422);

  const { action, provider_name, notes } = parsed.data;
  const now = new Date().toISOString();

  const linkFields: string[] = [];
  const linkVals: unknown[] = [];

  if (action === 'accept') {
    linkFields.push('provider_accepted_at = ?');
    linkVals.push(now);
    if (provider_name) { linkFields.push('provider_name = ?'); linkVals.push(provider_name); }
    if (notes) { linkFields.push('notes_from_provider = ?'); linkVals.push(notes); }
    // Also advance service status to approved if still requested
    await c.env.DB
      .prepare(`UPDATE service_orders SET status = 'approved' WHERE id = ? AND status = 'requested'`)
      .bind(link.service_id)
      .run();
  } else if (action === 'start') {
    linkFields.push('provider_started_at = ?');
    linkVals.push(now);
    if (notes) { linkFields.push('notes_from_provider = ?'); linkVals.push(notes); }
    await c.env.DB
      .prepare(`UPDATE service_orders SET status = 'in_progress' WHERE id = ? AND status IN ('requested','approved')`)
      .bind(link.service_id)
      .run();
  } else if (action === 'done') {
    linkFields.push('provider_done_at = ?');
    linkVals.push(now);
    if (notes) { linkFields.push('notes_from_provider = ?'); linkVals.push(notes); }
    await c.env.DB
      .prepare(`UPDATE service_orders SET status = 'completed', completed_at = ? WHERE id = ? AND status != 'verified'`)
      .bind(now, link.service_id)
      .run();
  }

  if (linkFields.length > 0) {
    linkVals.push(link.id);
    await c.env.DB
      .prepare(`UPDATE service_share_links SET ${linkFields.join(', ')} WHERE id = ?`)
      .bind(...linkVals)
      .run();
  }

  return ok(c, { action, updated_at: now });
});

export default share;
