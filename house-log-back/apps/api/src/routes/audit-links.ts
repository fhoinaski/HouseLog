import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { and, eq, sql } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { sha256TokenHash } from '../lib/token-hash';
import { ok, err } from '../lib/response';
import { canCreateAuditLink } from '../lib/authorization';
import { authMiddleware, resolveTenant } from '../middleware/auth';
import { getDb } from '../db/client';
import { auditLinks as auditLinksTable, properties, serviceOrders } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';
import { validatePrivateUpload } from '../lib/r2';

type AuditScope = { canUploadPhotos: boolean; canUploadVideo: boolean; requiredFields: string[] };

const auditLinks = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ── POST /properties/:propertyId/services/:serviceId/audit-link ──────────────
// Protected — requires auth

auditLinks.post('/', authMiddleware, resolveTenant, async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const serviceId = c.req.param('serviceId')!;
  const userId = c.get('userId');
  const userRole = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);

  const canCreateLink = await canCreateAuditLink(c.env.DB, { propertyId, userId, role: userRole });
  if (!canCreateLink) return err(c, 'Permissão insuficiente', 'FORBIDDEN', 403);

  // Verify the OS exists and belongs to the property
  const [order] = await db
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(
      and(
        eq(serviceOrders.id, serviceId),
        eq(serviceOrders.tenantId, tenantId),
        eq(serviceOrders.propertyId, propertyId),
        eq(properties.tenantId, tenantId),
        sql`${serviceOrders.deletedAt} IS NULL`
      )
    )
    .limit(1);

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const body = await c.req
    .json<{
      scope?: { canUploadPhotos?: boolean; canUploadVideo?: boolean; requiredFields?: string[] };
      expires_in_hours?: number;
    }>()
    .catch(() => ({} as {
      scope?: { canUploadPhotos?: boolean; canUploadVideo?: boolean; requiredFields?: string[] };
      expires_in_hours?: number;
    }));

  const expiresInHours = Math.min(body.expires_in_hours ?? 48, 72);
  const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString();

  const scope = {
    canUploadPhotos: body.scope?.canUploadPhotos ?? true,
    canUploadVideo: body.scope?.canUploadVideo ?? false,
    requiredFields: body.scope?.requiredFields ?? [],
  };

  const id = nanoid();
  const token = nanoid(32);
  const tokenHash = await sha256TokenHash(token);

  await db.insert(auditLinksTable).values({
    id,
    tenantId,
    serviceOrderId: serviceId,
    propertyId,
    createdBy: userId,
    token: `hash-only:${id}`,
    tokenHash,
    scope,
    expiresAt,
    status: 'active',
  });

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'audit_link', entityId: id, action: 'audit_link_created',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      service_order_id: serviceId,
      scope,
      expires_at: expiresAt,
    },
  });

  const publicUrl = `${c.env.APP_URL}/audit/${token}`;

  return ok(c, { url: publicUrl, expires_at: expiresAt, scope }, 201);
});

// ── GET /audit/:token — public, no auth ──────────────────────────────────────

auditLinks.get('/public/:token', async (c) => {
  const db = getDb(c.env.DB);
  const rawToken = c.req.param('token')!;
  if (!rawToken || rawToken.length < 8) return err(c, 'Token inválido', 'INVALID_TOKEN', 400);
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

  const tokenHash = await sha256TokenHash(rawToken);

  const [link] = await db
    .select({
      id: auditLinksTable.id,
      service_order_id: auditLinksTable.serviceOrderId,
      property_id: auditLinksTable.propertyId,
      created_by: auditLinksTable.createdBy,
      scope: auditLinksTable.scope,
      expires_at: auditLinksTable.expiresAt,
      accessed_at: auditLinksTable.accessedAt,
      accessor_ip: auditLinksTable.accessorIp,
      geo_lat: auditLinksTable.geoLat,
      geo_lng: auditLinksTable.geoLng,
      status: auditLinksTable.status,
      created_at: auditLinksTable.createdAt,
      link_tenant_id: auditLinksTable.tenantId,
      order_tenant_id: serviceOrders.tenantId,
      property_tenant_id: properties.tenantId,
      order_title: serviceOrders.title,
      order_description: serviceOrders.description,
      system_type: serviceOrders.systemType,
      before_photos: serviceOrders.beforePhotos,
      property_name: properties.name,
      address: properties.address,
    })
    .from(auditLinksTable)
    .innerJoin(serviceOrders, eq(serviceOrders.id, auditLinksTable.serviceOrderId))
    .innerJoin(properties, eq(properties.id, auditLinksTable.propertyId))
    .where(
      and(
        eq(auditLinksTable.tokenHash, tokenHash),
        eq(auditLinksTable.tenantId, serviceOrders.tenantId),
        eq(auditLinksTable.tenantId, properties.tenantId),
        eq(auditLinksTable.propertyId, serviceOrders.propertyId),
        sql`${serviceOrders.deletedAt} IS NULL`,
        sql`${properties.deletedAt} IS NULL`
      )
    )
    .limit(1);

  if (!link) return err(c, 'Link não encontrado', 'NOT_FOUND', 404);

  if (new Date(link.expires_at) < new Date()) {
    await db.update(auditLinksTable).set({ status: 'expired' }).where(eq(auditLinksTable.id, link.id));
    return err(c, 'Este link expirou', 'LINK_EXPIRED', 410);
  }

  if (link.status === 'expired') return err(c, 'Este link expirou', 'LINK_EXPIRED', 410);
  if (link.status === 'used')    return err(c, 'Este link já foi utilizado', 'LINK_USED', 410);

  // Record access
  await db
    .update(auditLinksTable)
    .set({ accessedAt: new Date().toISOString(), accessorIp: ip })
    .where(eq(auditLinksTable.id, link.id));

  return ok(c, {
    order_title: link.order_title,
    order_description: link.order_description,
    system_type: link.system_type,
    before_photos: link.before_photos ?? [],
    property_name: link.property_name,
    address: link.address,
    scope: link.scope ?? {},
    expires_at: link.expires_at,
  });
});

// ── POST /audit/:token/submit — public, no auth ───────────────────────────────

auditLinks.post('/public/:token/submit', async (c) => {
  const db = getDb(c.env.DB);
  const rawToken = c.req.param('token')!;
  if (!rawToken || rawToken.length < 8) return err(c, 'Token inválido', 'INVALID_TOKEN', 400);
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';

  const tokenHash = await sha256TokenHash(rawToken);

  const [link] = await db
    .select({
      id: auditLinksTable.id,
      service_order_id: auditLinksTable.serviceOrderId,
      property_id: auditLinksTable.propertyId,
      created_by: auditLinksTable.createdBy,
      scope: auditLinksTable.scope,
      expires_at: auditLinksTable.expiresAt,
      accessed_at: auditLinksTable.accessedAt,
      accessor_ip: auditLinksTable.accessorIp,
      geo_lat: auditLinksTable.geoLat,
      geo_lng: auditLinksTable.geoLng,
      status: auditLinksTable.status,
      created_at: auditLinksTable.createdAt,
      tenant_id: auditLinksTable.tenantId,
      after_photos: serviceOrders.afterPhotos,
    })
    .from(auditLinksTable)
    .innerJoin(serviceOrders, eq(serviceOrders.id, auditLinksTable.serviceOrderId))
    .innerJoin(properties, eq(properties.id, auditLinksTable.propertyId))
    .where(
      and(
        eq(auditLinksTable.tokenHash, tokenHash),
        eq(auditLinksTable.tenantId, serviceOrders.tenantId),
        eq(auditLinksTable.tenantId, properties.tenantId),
        eq(auditLinksTable.propertyId, serviceOrders.propertyId),
        sql`${serviceOrders.deletedAt} IS NULL`,
        sql`${properties.deletedAt} IS NULL`
      )
    )
    .limit(1);

  if (!link?.tenant_id) return err(c, 'Link não encontrado', 'NOT_FOUND', 404);
  const linkTenantId = link.tenant_id;
  if (link.status === 'used')   return err(c, 'Este link já foi utilizado', 'LINK_USED', 410);
  if (link.status === 'expired') return err(c, 'Este link expirou', 'LINK_EXPIRED', 410);
  if (new Date(link.expires_at) < new Date()) {
    await db.update(auditLinksTable).set({ status: 'expired' }).where(eq(auditLinksTable.id, link.id));
    return err(c, 'Este link expirou', 'LINK_EXPIRED', 410);
  }

  const scope = (link.scope ?? { canUploadPhotos: true, canUploadVideo: false, requiredFields: [] }) as AuditScope;
  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const uploadedUrls: string[] = [];

  if (scope.canUploadPhotos) {
    const files = formData.getAll('photos');
    for (const entry of files) {
      if (typeof entry === 'string') continue;
      const file = entry as File;
      const validation = validatePrivateUpload(file.type, file.size, file.name);
      if (!validation.ok) continue;

      const key = `${link.property_id}/photos/audit_${Date.now()}_${nanoid(8)}.jpg`;
      const buf = await file.arrayBuffer();
      await c.env.STORAGE.put(key, buf, { httpMetadata: { contentType: file.type } });
      uploadedUrls.push(key);
    }

    if (uploadedUrls.length > 0) {
      const existing = link.after_photos ?? [];
      await db
        .update(serviceOrders)
        .set({ afterPhotos: [...existing, ...uploadedUrls] })
        .where(and(eq(serviceOrders.id, link.service_order_id), eq(serviceOrders.tenantId, linkTenantId), eq(serviceOrders.propertyId, link.property_id)));
    }
  }

  const notes = formData.get('notes') as string | null;
  if (notes) {
    await db.run(
      sql`UPDATE service_orders
          SET description = COALESCE(description, '') || '\n[Nota auditoria]: ' || ${notes}
          WHERE id = ${link.service_order_id}
            AND tenant_id = ${linkTenantId}
            AND property_id = ${link.property_id}`
    );
  }

  // Mark as used
  await db
    .update(auditLinksTable)
    .set({ status: 'used', accessorIp: ip })
    .where(eq(auditLinksTable.id, link.id));

  await writeAuditLog(c.env.DB, {
    tenantId: link.tenant_id,
    propertyId: link.property_id,
    entityType: 'audit_link', entityId: link.id, action: 'submit',
    actorId: null, actorIp: ip,
    newData: { uploaded_photos: uploadedUrls.length, notes: !!notes },
  });

  return ok(c, { success: true, photos_uploaded: uploadedUrls.length });
});

export default auditLinks;
