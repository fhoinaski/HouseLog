import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { writeAuditLog } from '../lib/audit';
import { canAccessProperty, canCreateServiceOrder, canCreateServiceRequest } from '../lib/authorization';
import { authMiddleware, resolveTenant } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';
import { getDb } from '../db/client';
import { bids, properties, rooms, serviceOrders, serviceRequests, users } from '../db/schema';
import { buildR2Key, extractR2KeyFromPublicUrl } from '../lib/r2';
import { generateR2PresignedPutUrl } from '../lib/r2-presigned';
import { serviceOrderCreateSchema } from '@houselog/contracts';
import { createId } from '../lib/id';

const serviceRequestsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

serviceRequestsRoute.use('*', authMiddleware);
serviceRequestsRoute.use('*', resolveTenant);

const mediaKindSchema = z.enum(['photo', 'video', 'audio']);

type MediaKind = z.infer<typeof mediaKindSchema>;

const createServiceRequestSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio').max(160),
  description: z.string().max(3000).optional(),
  media: z
    .array(
      z.object({
        filename: z.string().min(1).max(260),
        mimeType: z.string().min(3).max(120),
        size: z.number().int().positive().max(100 * 1024 * 1024),
        kind: mediaKindSchema,
      })
    )
    .max(10)
    .default([]),
});

const MIME_BY_KIND: Record<MediaKind, Set<string>> = {
  photo: new Set(['image/jpeg', 'image/png', 'image/webp']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
  audio: new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4']),
};

// Authenticated endpoint URL for a specific media item inside a service request.
function mediaEndpoint(propertyId: string, requestId: string, index: number): string {
  return `/api/v1/properties/${propertyId}/service-requests/${requestId}/media/${index}`;
}

// Transforms a stored media_urls array (R2 keys or legacy public URLs) into
// authenticated endpoint URLs so clients never receive raw R2 keys/public URLs.
function toMediaEndpoints(propertyId: string, requestId: string, stored: string[] | null): string[] {
  return (stored ?? []).map((_, i) => mediaEndpoint(propertyId, requestId, i));
}

async function isRoomInTenantProperty(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  propertyId: string,
  roomId?: string | null
): Promise<boolean> {
  if (!roomId) return true;

  const [room] = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(
      eq(rooms.id, roomId),
      eq(rooms.tenantId, tenantId),
      eq(rooms.propertyId, propertyId),
      isNull(rooms.deletedAt)
    ))
    .limit(1);

  return Boolean(room);
}

serviceRequestsRoute.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  if (!propertyId) {
    return err(c, 'Imovel nao informado', 'INVALID_PROPERTY', 422);
  }

  const hasAccess = await canAccessProperty(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) {
    return err(c, 'Sem acesso aos orcamentos deste imovel', 'FORBIDDEN', 403);
  }

  const db = getDb(c.env.DB);
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
  const cursor = c.req.query('cursor');

  const filters = [
    eq(serviceRequests.propertyId, propertyId),
    eq(serviceRequests.tenantId, tenantId),
    eq(properties.tenantId, tenantId),
    isNull(properties.deletedAt),
  ];

  if (cursor) {
    filters.push(sql`${serviceRequests.createdAt} < ${cursor}`);
  }

  const rows = await db
    .select({
      id: serviceRequests.id,
      property_id: serviceRequests.propertyId,
      requested_by: serviceRequests.requestedBy,
      title: serviceRequests.title,
      description: serviceRequests.description,
      media_urls: serviceRequests.mediaUrls,
      status: serviceRequests.status,
      created_at: serviceRequests.createdAt,
      updated_at: serviceRequests.updatedAt,
      proposals_count: sql<number>`count(${bids.id})`,
      pending_proposals_count: sql<number>`sum(case when ${bids.status} = 'PENDING' then 1 else 0 end)`,
      accepted_proposals_count: sql<number>`sum(case when ${bids.status} = 'ACCEPTED' then 1 else 0 end)`,
      best_amount: sql<number | null>`min(${bids.amount})`,
    })
    .from(serviceRequests)
    .innerJoin(properties, and(eq(properties.id, serviceRequests.propertyId), eq(properties.tenantId, tenantId)))
    .leftJoin(bids, and(eq(bids.serviceRequestId, serviceRequests.id), eq(bids.tenantId, tenantId)))
    .where(and(...filters))
    .groupBy(serviceRequests.id)
    .orderBy(desc(serviceRequests.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
    ...row,
    proposals_count: Number(row.proposals_count ?? 0),
    pending_proposals_count: Number(row.pending_proposals_count ?? 0),
    accepted_proposals_count: Number(row.accepted_proposals_count ?? 0),
    best_amount: row.best_amount === null ? null : Number(row.best_amount),
    // Replace stored keys/URLs with authenticated endpoint URLs.
    media_urls: toMediaEndpoints(propertyId, row.id, row.media_urls as string[] | null),
  }));
  const last = data.at(-1);

  return ok(c, {
    data,
    next_cursor: hasMore && last ? last.created_at : null,
    has_more: hasMore,
  });
});

const convertToServiceSchema = serviceOrderCreateSchema
  .omit({ assigned_to: true })
  .extend({
    description: z.string().max(3000).optional(),
  });

serviceRequestsRoute.get('/:serviceRequestId', async (c) => {
  const propertyId = c.req.param('propertyId');
  const serviceRequestId = c.req.param('serviceRequestId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  if (!propertyId || !serviceRequestId) {
    return err(c, 'Parametros obrigatorios ausentes', 'INVALID_PARAMS', 422);
  }

  const hasAccess = await canAccessProperty(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) {
    return err(c, 'Sem acesso a este orcamento', 'FORBIDDEN', 403);
  }

  const db = getDb(c.env.DB);

  const [requestRow] = await db
    .select({
      id: serviceRequests.id,
      property_id: serviceRequests.propertyId,
      requested_by: serviceRequests.requestedBy,
      title: serviceRequests.title,
      description: serviceRequests.description,
      media_urls: serviceRequests.mediaUrls,
      status: serviceRequests.status,
      created_at: serviceRequests.createdAt,
      updated_at: serviceRequests.updatedAt,
    })
    .from(serviceRequests)
    .innerJoin(properties, and(eq(properties.id, serviceRequests.propertyId), eq(properties.tenantId, tenantId)))
    .where(
      and(
        eq(serviceRequests.id, serviceRequestId),
        eq(serviceRequests.propertyId, propertyId),
        eq(serviceRequests.tenantId, tenantId),
        isNull(properties.deletedAt)
      )
    )
    .limit(1);

  if (!requestRow) {
    return err(c, 'Solicitacao de orcamento nao encontrada', 'SERVICE_REQUEST_NOT_FOUND', 404);
  }

  const proposalRows = await db
    .select({
      id: bids.id,
      service_request_id: bids.serviceRequestId,
      provider_id: bids.providerId,
      provider_name: users.name,
      provider_email: users.email,
      provider_phone: users.phone,
      amount: bids.amount,
      scope: bids.scope,
      status: bids.status,
      created_at: bids.createdAt,
      updated_at: bids.updatedAt,
    })
    .from(bids)
    .innerJoin(users, eq(users.id, bids.providerId))
    .where(and(eq(bids.serviceRequestId, serviceRequestId), eq(bids.tenantId, tenantId)))
    .orderBy(sql`CASE ${bids.status} WHEN 'ACCEPTED' THEN 0 WHEN 'PENDING' THEN 1 ELSE 2 END`, bids.amount);

  return ok(c, {
    service_request: {
      ...requestRow,
      media_urls: toMediaEndpoints(propertyId, requestRow.id, requestRow.media_urls as string[] | null),
    },
    bids: proposalRows,
  });
});

serviceRequestsRoute.post('/:serviceRequestId/convert-to-service', async (c) => {
  const propertyId = c.req.param('propertyId');
  const serviceRequestId = c.req.param('serviceRequestId');
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  if (!propertyId || !serviceRequestId) {
    return err(c, 'Parametros obrigatorios ausentes', 'INVALID_PARAMS', 422);
  }

  const hasAccess = await canCreateServiceOrder(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) {
    return err(c, 'Sem permissao para criar servico neste imovel', 'FORBIDDEN', 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = convertToServiceSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const db = getDb(c.env.DB);

  const [requestRow] = await db
    .select({
      id: serviceRequests.id,
      propertyId: serviceRequests.propertyId,
      title: serviceRequests.title,
      description: serviceRequests.description,
      status: serviceRequests.status,
    })
    .from(serviceRequests)
    .innerJoin(properties, eq(properties.id, serviceRequests.propertyId))
    .where(
      and(
        eq(serviceRequests.id, serviceRequestId),
        eq(serviceRequests.propertyId, propertyId),
        eq(serviceRequests.tenantId, tenantId),
        isNull(properties.deletedAt)
      )
    )
    .limit(1);

  if (!requestRow) {
    return err(c, 'Solicitacao de orcamento nao encontrada', 'SERVICE_REQUEST_NOT_FOUND', 404);
  }

  const [acceptedBid] = await db
    .select({
      id: bids.id,
      providerId: bids.providerId,
      amount: bids.amount,
      scope: bids.scope,
      status: bids.status,
    })
    .from(bids)
    .where(and(eq(bids.serviceRequestId, serviceRequestId), eq(bids.tenantId, tenantId), eq(bids.status, 'ACCEPTED')))
    .limit(1);

  if (!acceptedBid) {
    return err(c, 'Aceite uma proposta antes de converter em servico', 'ACCEPTED_BID_REQUIRED', 409);
  }

  const input = parsed.data;
  const roomAllowed = await isRoomInTenantProperty(db, tenantId, propertyId, input.room_id);
  if (!roomAllowed) return err(c, 'Comodo nao encontrado neste imovel', 'REFERENCE_NOT_FOUND', 422);

  const serviceId = createId();
  const descriptionParts = [
    input.description?.trim() || requestRow.description,
    acceptedBid.scope ? `Escopo aprovado:\n${acceptedBid.scope}` : null,
  ].filter((part): part is string => Boolean(part));

  try {
    await db.insert(serviceOrders).values({
      id: serviceId,
      tenantId,
      propertyId,
      roomId: input.room_id ?? null,
      systemType: input.system_type,
      requestedBy: userId,
      assignedTo: acceptedBid.providerId,
      title: input.title || requestRow.title,
      description: descriptionParts.length > 0 ? descriptionParts.join('\n\n') : null,
      priority: input.priority,
      status: 'approved',
      cost: acceptedBid.amount,
      warrantyUntil: input.warranty_until ?? null,
      scheduledAt: input.scheduled_at ?? null,
      checklist: input.checklist ?? [],
    });

    await db
      .update(serviceRequests)
      .set({ status: 'CLOSED', updatedAt: new Date().toISOString() })
      .where(and(eq(serviceRequests.id, serviceRequestId), eq(serviceRequests.tenantId, tenantId), eq(serviceRequests.propertyId, propertyId)));

    await writeAuditLog(c.env.DB, {
      tenantId,
      propertyId,
      entityType: 'service_request',
      entityId: serviceRequestId,
      action: 'convert_to_service',
      actorId: userId,
      actorIp: c.req.header('CF-Connecting-IP'),
      newData: { service_order_id: serviceId, bid_id: acceptedBid.id },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('FOREIGN KEY')) {
      return err(c, 'Comodo ou prestador nao encontrado', 'REFERENCE_NOT_FOUND', 422);
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
    .where(and(eq(serviceOrders.id, serviceId), eq(serviceOrders.tenantId, tenantId), eq(serviceOrders.propertyId, propertyId)))
    .limit(1);

  return ok(c, { order }, 201);
});

function assertAllowedMimeType(kind: MediaKind, mimeType: string): boolean {
  const allowed = MIME_BY_KIND[kind];
  return allowed ? allowed.has(mimeType.toLowerCase()) : false;
}

function mapKindToCategory(kind: MediaKind): 'photos' | 'videos' | 'documents' {
  if (kind === 'photo') return 'photos';
  if (kind === 'video') return 'videos';
  return 'documents';
}

// ── GET /:serviceRequestId/media/:mediaIndex ──────────────────────────────────
// Authenticated serving of service-request media. Validates tenant + property
// ownership before streaming the R2 object.

serviceRequestsRoute.get('/:serviceRequestId/media/:mediaIndex', async (c) => {
  const propertyId = c.req.param('propertyId');
  const serviceRequestId = c.req.param('serviceRequestId');
  const tenantId = c.get('tenantId') as string;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const rawIndex = c.req.param('mediaIndex');
  const mediaIndex = Number(rawIndex);

  if (!propertyId || !serviceRequestId || isNaN(mediaIndex) || mediaIndex < 0) {
    return err(c, 'Parametros invalidos', 'INVALID_PARAMS', 422);
  }

  const hasAccess = await canAccessProperty(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const db = getDb(c.env.DB);

  const [request] = await db
    .select({ mediaUrls: serviceRequests.mediaUrls })
    .from(serviceRequests)
    .where(
      and(
        eq(serviceRequests.id, serviceRequestId),
        eq(serviceRequests.propertyId, propertyId),
        eq(serviceRequests.tenantId, tenantId)
      )
    )
    .limit(1);

  if (!request) return err(c, 'Solicitacao nao encontrada', 'NOT_FOUND', 404);

  const urls = (request.mediaUrls as string[] | null) ?? [];
  if (mediaIndex >= urls.length) return err(c, 'Midia nao encontrada', 'NOT_FOUND', 404);

  const stored = urls[mediaIndex];
  if (!stored) return err(c, 'Midia nao encontrada', 'NOT_FOUND', 404);
  const key = extractR2KeyFromPublicUrl(stored, c.env.R2_PUBLIC_URL);

  const object = await c.env.STORAGE.get(key);
  if (!object) return err(c, 'Arquivo nao encontrado', 'NOT_FOUND', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=60');

  return new Response(object.body, { headers });
});

// ── POST / ────────────────────────────────────────────────────────────────────

serviceRequestsRoute.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const ownerId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId') as string;

  if (!propertyId) {
    return err(c, 'Imovel nao informado', 'INVALID_PROPERTY', 422);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invalido', 'INVALID_BODY');

  const parsed = createServiceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados invalidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const db = getDb(c.env.DB);

  const canCreateRequest = await canCreateServiceRequest(c.env.DB, {
    propertyId,
    userId: ownerId,
    role,
    tenantId,
    tenantRole: c.get('tenantRole'),
  });
  if (!canCreateRequest) {
    return err(c, 'Sem permissao para este imovel', 'FORBIDDEN', 403);
  }

  if (
    !c.env.R2_ACCOUNT_ID ||
    !c.env.R2_BUCKET_NAME ||
    !c.env.R2_ACCESS_KEY_ID ||
    !c.env.R2_SECRET_ACCESS_KEY
  ) {
    return err(c, 'Configuracao de upload R2 ausente', 'MISSING_R2_PRESIGN_CONFIG', 500);
  }

  const requestId = createId();

  for (const file of parsed.data.media) {
    if (!assertAllowedMimeType(file.kind, file.mimeType)) {
      return err(c, `Tipo MIME nao permitido para ${file.kind}: ${file.mimeType}`, 'INVALID_MEDIA', 422);
    }
  }

  // Build keys and presigned PUT URLs for each media item.
  const mediaItems = await Promise.all(
    parsed.data.media.map(async (file, index) => {
      const key = buildR2Key({
        propertyId,
        category: mapKindToCategory(file.kind),
        filename: `${requestId}-${index + 1}-${file.filename}`,
      });

      const uploadUrl = await generateR2PresignedPutUrl({
        accountId: c.env.R2_ACCOUNT_ID as string,
        bucketName: c.env.R2_BUCKET_NAME as string,
        accessKeyId: c.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: c.env.R2_SECRET_ACCESS_KEY as string,
        objectKey: key,
        expiresInSeconds: 900,
      });

      return { key, kind: file.kind, mimeType: file.mimeType, uploadUrl };
    })
  );

  await db.insert(serviceRequests).values({
    id: requestId,
    tenantId,
    propertyId,
    requestedBy: ownerId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    // Store R2 keys (not public URLs) — served via authenticated endpoint.
    mediaUrls: mediaItems.map((m) => m.key),
    status: 'OPEN',
  });

  const [created] = await db
    .select({
      id: serviceRequests.id,
      title: serviceRequests.title,
      description: serviceRequests.description,
      status: serviceRequests.status,
      mediaUrls: serviceRequests.mediaUrls,
      createdAt: serviceRequests.createdAt,
    })
    .from(serviceRequests)
    .where(and(
      eq(serviceRequests.id, requestId),
      eq(serviceRequests.tenantId, tenantId),
      eq(serviceRequests.propertyId, propertyId)
    ))
    .limit(1);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'service_request',
    entityId: requestId,
    action: 'create',
    actorId: ownerId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: { title: parsed.data.title, status: 'OPEN', media_count: mediaItems.length },
  });

  return ok(
    c,
    {
      service_request: {
        ...created,
        // Return endpoint URLs, never raw R2 keys, in the response.
        mediaUrls: mediaItems.map((_, i) => mediaEndpoint(propertyId, requestId, i)),
      },
      // upload_targets: client uses uploadUrl to PUT the file directly to R2.
      // mediaUrl / fileUrl (alias for backward compat) are the authenticated
      // endpoints to fetch the file after upload — never a raw R2 public URL.
      upload_targets: mediaItems.map((m, i) => ({
        kind: m.kind,
        mimeType: m.mimeType,
        uploadUrl: m.uploadUrl,
        mediaUrl: mediaEndpoint(propertyId, requestId, i),
        fileUrl: mediaEndpoint(propertyId, requestId, i),
      })),
    },
    201
  );
});

export default serviceRequestsRoute;
