import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';

type AuditLink = {
  id: string; service_order_id: string; property_id: string;
  created_by: string; token: string; scope: string;
  expires_at: string; accessed_at: string | null; accessor_ip: string | null;
  geo_lat: number | null; geo_lng: number | null;
  status: 'active' | 'used' | 'expired'; created_at: string;
};

const auditLinks = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── POST /properties/:propertyId/services/:serviceId/audit-link ──────────────
// Protected — requires auth

auditLinks.post('/', authMiddleware, async (c) => {
  const propertyId = c.req.param('propertyId');
  const serviceId = c.req.param('serviceId');
  const userId = c.get('userId');

  // Verify the OS exists and belongs to the property
  const order = await c.env.DB
    .prepare(
      'SELECT id FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL'
    )
    .bind(serviceId, propertyId)
    .first();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const body = await c.req.json<{
    scope?: { canUploadPhotos?: boolean; canUploadVideo?: boolean; requiredFields?: string[] };
    expires_in_hours?: number;
  }>().catch(() => ({}));

  const expiresInHours = Math.min(body.expires_in_hours ?? 48, 72);
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();

  const scope = {
    canUploadPhotos: body.scope?.canUploadPhotos ?? true,
    canUploadVideo: body.scope?.canUploadVideo ?? false,
    requiredFields: body.scope?.requiredFields ?? [],
  };

  const token = nanoid(32);
  const id = nanoid();

  await c.env.DB
    .prepare(
      `INSERT INTO audit_links
       (id, service_order_id, property_id, created_by, token, scope, expires_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`
    )
    .bind(id, serviceId, propertyId, userId, token, JSON.stringify(scope), expiresAt)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'audit_link', entityId: id, action: 'create',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: { token, service_order_id: serviceId, expires_at: expiresAt },
  });

  // Build the public URL for sharing
  const corsOrigin = c.env.CORS_ORIGIN ?? 'http://localhost:3000';
  const publicUrl = `${corsOrigin}/audit/${token}`;

  return ok(c, { token, url: publicUrl, expires_at: expiresAt, scope }, 201);
});

// ── GET /audit/:token — public, no auth ──────────────────────────────────────

auditLinks.get('/public/:token', async (c) => {
  const { token } = c.req.param();
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

  const link = await c.env.DB
    .prepare(
      `SELECT al.*, so.title as order_title, so.description as order_description,
              so.system_type, so.before_photos, p.name as property_name, p.address
       FROM audit_links al
       JOIN service_orders so ON so.id = al.service_order_id
       JOIN properties p ON p.id = al.property_id
       WHERE al.token = ?`
    )
    .bind(token)
    .first<AuditLink & {
      order_title: string; order_description: string | null;
      system_type: string; before_photos: string;
      property_name: string; address: string;
    }>();

  if (!link) return err(c, 'Link inválido', 'NOT_FOUND', 404);

  // Auto-expire check
  if (new Date(link.expires_at) < new Date()) {
    await c.env.DB
      .prepare("UPDATE audit_links SET status = 'expired' WHERE id = ?")
      .bind(link.id)
      .run();
    return err(c, 'Este link expirou', 'LINK_EXPIRED', 410);
  }

  if (link.status === 'expired') return err(c, 'Este link expirou', 'LINK_EXPIRED', 410);
  if (link.status === 'used')    return err(c, 'Este link já foi utilizado', 'LINK_USED', 410);

  // Record access
  await c.env.DB
    .prepare(
      `UPDATE audit_links SET accessed_at = datetime('now'), accessor_ip = ? WHERE id = ?`
    )
    .bind(ip, link.id)
    .run();

  return ok(c, {
    token,
    order_title: link.order_title,
    order_description: link.order_description,
    system_type: link.system_type,
    before_photos: JSON.parse(link.before_photos || '[]'),
    property_name: link.property_name,
    address: link.address,
    scope: JSON.parse(link.scope),
    expires_at: link.expires_at,
  });
});

// ── POST /audit/:token/submit — public, no auth ───────────────────────────────

auditLinks.post('/public/:token/submit', async (c) => {
  const { token } = c.req.param();
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

  const link = await c.env.DB
    .prepare(
      `SELECT al.*, so.after_photos FROM audit_links al
       JOIN service_orders so ON so.id = al.service_order_id
       WHERE al.token = ? AND al.status = 'active'`
    )
    .bind(token)
    .first<AuditLink & { after_photos: string }>();

  if (!link) return err(c, 'Link inválido ou expirado', 'INVALID_LINK', 410);
  if (new Date(link.expires_at) < new Date()) {
    await c.env.DB
      .prepare("UPDATE audit_links SET status = 'expired' WHERE id = ?")
      .bind(link.id)
      .run();
    return err(c, 'Link expirado', 'LINK_EXPIRED', 410);
  }

  const scope = JSON.parse(link.scope) as { canUploadPhotos: boolean; canUploadVideo: boolean; requiredFields: string[] };
  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const uploadedUrls: string[] = [];

  if (scope.canUploadPhotos) {
    const files = formData.getAll('photos') as File[];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 50 * 1024 * 1024) continue;

      const key = `${link.property_id}/photos/audit_${Date.now()}_${nanoid(8)}.jpg`;
      const buf = await file.arrayBuffer();
      await c.env.STORAGE.put(key, buf, { httpMetadata: { contentType: file.type } });
      uploadedUrls.push(getPublicUrl(key, c.env.R2_PUBLIC_URL ?? ''));
    }

    if (uploadedUrls.length > 0) {
      const existing = JSON.parse(link.after_photos || '[]') as string[];
      await c.env.DB
        .prepare('UPDATE service_orders SET after_photos = ? WHERE id = ?')
        .bind(JSON.stringify([...existing, ...uploadedUrls]), link.service_order_id)
        .run();
    }
  }

  const notes = formData.get('notes') as string | null;
  if (notes) {
    await c.env.DB
      .prepare("UPDATE service_orders SET description = COALESCE(description, '') || '\n[Nota auditoria]: ' || ? WHERE id = ?")
      .bind(notes, link.service_order_id)
      .run();
  }

  // Mark as used
  await c.env.DB
    .prepare("UPDATE audit_links SET status = 'used', accessor_ip = ? WHERE id = ?")
    .bind(ip, link.id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'audit_link', entityId: link.id, action: 'submit',
    actorId: null, actorIp: ip,
    newData: { uploaded_photos: uploadedUrls.length, notes: !!notes },
  });

  return ok(c, { success: true, photos_uploaded: uploadedUrls.length });
});

function getPublicUrl(key: string, baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${key}`;
}

export default auditLinks;
