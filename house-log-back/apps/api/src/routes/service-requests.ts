import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { canCreateServiceRequest } from '../lib/authorization';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';
import { getDb } from '../db/client';
import { serviceRequests } from '../db/schema';
import { buildR2Key, getPublicUrl } from '../lib/r2';
import { buildR2S3PublicObjectUrl, generateR2PresignedPutUrl } from '../lib/r2-presigned';

const serviceRequestsRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

serviceRequestsRoute.use('*', authMiddleware, requireRole('owner'));

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

function assertAllowedMimeType(kind: MediaKind, mimeType: string): boolean {
  const allowed = MIME_BY_KIND[kind];
  return allowed ? allowed.has(mimeType.toLowerCase()) : false;
}

function mapKindToCategory(kind: MediaKind): 'photos' | 'videos' | 'documents' {
  if (kind === 'photo') return 'photos';
  if (kind === 'video') return 'videos';
  return 'documents';
}

function buildFileUrl(c: { env: Bindings }, objectKey: string): string {
  if (c.env.R2_PUBLIC_URL) {
    return getPublicUrl(objectKey, c.env.R2_PUBLIC_URL);
  }

  if (c.env.R2_ACCOUNT_ID && c.env.R2_BUCKET_NAME) {
    return buildR2S3PublicObjectUrl(c.env.R2_ACCOUNT_ID, c.env.R2_BUCKET_NAME, objectKey);
  }

  return objectKey;
}

serviceRequestsRoute.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const ownerId = c.get('userId');
  const role = c.get('userRole');

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

  const canCreateRequest = await canCreateServiceRequest(c.env.DB, { propertyId, userId: ownerId, role });
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

  const requestId = nanoid();

  for (const file of parsed.data.media) {
    if (!assertAllowedMimeType(file.kind, file.mimeType)) {
      return err(c, `Tipo MIME nao permitido para ${file.kind}: ${file.mimeType}`, 'INVALID_MEDIA', 422);
    }
  }

  const uploadTargets = await Promise.all(
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

      return {
        key,
        kind: file.kind,
        mimeType: file.mimeType,
        uploadUrl,
        fileUrl: buildFileUrl(c, key),
      };
    })
  );

  await db.insert(serviceRequests).values({
    id: requestId,
    propertyId,
    requestedBy: ownerId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    mediaUrls: uploadTargets.map((target) => target.fileUrl),
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
    .where(eq(serviceRequests.id, requestId))
    .limit(1);

  return ok(
    c,
    {
      service_request: created,
      upload_targets: uploadTargets,
    },
    201
  );
});

export default serviceRequestsRoute;
