import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { canDeleteDocument, canRequestDocumentOCR, canUploadDocument } from '../lib/authorization';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { validatePrivateUpload, buildR2Key, uploadToR2, extractR2KeyFromPublicUrl } from '../lib/r2';
import { getDb } from '../db/client';
import { documents as documentsTable, documentIngestionJobs as ingestionJobsTable, properties, serviceOrders, users } from '../db/schema';
import { documentCreateSchema, CreateDocumentIngestionJobInputSchema } from '@houselog/contracts';
import type { Bindings, Variables } from '../lib/types';

type Document = {
  id: string; property_id: string; service_id: string | null;
  type: string; title: string; file_url: string; file_size: number | null;
  ocr_data: Record<string, unknown> | null; vendor_cnpj: string | null; amount: number | null;
  issue_date: string | null; expiry_date: string | null;
  uploaded_by: string; created_at: string; deleted_at: string | null;
};

const documents = new Hono<{ Bindings: Bindings; Variables: Variables }>();
documents.use('*', authMiddleware);
documents.use('*', resolveTenant);

const metaSchema = documentCreateSchema;

function buildDocumentDownloadUrl(propertyId: string, documentId: string): string {
  return `/api/v1/properties/${propertyId}/documents/${documentId}/download`;
}

function mapDocumentForResponse<T extends Document>(doc: T): T {
  return { ...doc, file_url: buildDocumentDownloadUrl(doc.property_id, doc.id) };
}

async function ensureTenantProperty(db: ReturnType<typeof getDb>, tenantId: string, propertyId: string): Promise<boolean> {
  const [property] = await db
    .select({ id: properties.id })
    .from(properties)
    .where(and(eq(properties.id, propertyId), eq(properties.tenantId, tenantId), isNull(properties.deletedAt)))
    .limit(1);
  return Boolean(property);
}

async function ensureTenantServiceOrder(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  propertyId: string,
  serviceOrderId?: string | null
): Promise<boolean> {
  if (!serviceOrderId) return true;
  const [order] = await db
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .where(
      and(
        eq(serviceOrders.id, serviceOrderId),
        eq(serviceOrders.tenantId, tenantId),
        eq(serviceOrders.propertyId, propertyId),
        isNull(serviceOrders.deletedAt)
      )
    )
    .limit(1);
  return Boolean(order);
}

// ── GET /properties/:propertyId/documents ────────────────────────────────────

documents.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const type = c.req.query('type');

  const filters = [eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)];
  if (type && type !== 'undefined') filters.push(eq(documentsTable.type, type as typeof documentsTable.$inferSelect.type));
  if (cursor) filters.push(lt(documentsTable.createdAt, cursor));

  const results = await db
    .select({
      id: documentsTable.id,
      property_id: documentsTable.propertyId,
      service_id: documentsTable.serviceId,
      type: documentsTable.type,
      title: documentsTable.title,
      file_url: documentsTable.fileUrl,
      file_size: documentsTable.fileSize,
      ocr_data: documentsTable.ocrData,
      vendor_cnpj: documentsTable.vendorCnpj,
      amount: documentsTable.amount,
      issue_date: documentsTable.issueDate,
      expiry_date: documentsTable.expiryDate,
      uploaded_by: documentsTable.uploadedBy,
      created_at: documentsTable.createdAt,
      deleted_at: documentsTable.deletedAt,
      uploader_name: users.name,
    })
    .from(documentsTable)
    .innerJoin(users, eq(users.id, documentsTable.uploadedBy))
    .where(and(...filters))
    .orderBy(desc(documentsTable.createdAt))
    .limit(limit + 1) as Array<Document & { uploader_name: string }>;

  return ok(c, paginate(results.map(mapDocumentForResponse), limit, 'created_at'));
});

// ── POST /properties/:propertyId/documents — multipart upload ────────────────

documents.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await canUploadDocument(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo obrigatório', 'MISSING_FILE');

  const validation = validatePrivateUpload(file.type, file.size, file.name);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const rawMeta = formData.get('meta') as string | null;
  const metaJson = rawMeta ? JSON.parse(rawMeta) : {};
  const parsed = metaSchema.safeParse(metaJson);
  if (!parsed.success) {
    return err(c, 'Metadados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const meta = parsed.data;
  const serviceOrderAllowed = await ensureTenantServiceOrder(db, tenantId, propertyId, meta.service_id);
  if (!serviceOrderAllowed) return err(c, 'OS nao encontrada neste imovel', 'SERVICE_ORDER_NOT_FOUND', 404);

  const key = buildR2Key({ propertyId, category: 'documents', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);

  const id = nanoid();
  await db.insert(documentsTable).values({
    id,
    tenantId,
    propertyId,
    serviceId: meta.service_id ?? null,
    type: meta.type,
    title: meta.title,
    fileUrl: key,
    fileSize: file.size,
    vendorCnpj: meta.vendor_cnpj ?? null,
    amount: meta.amount ?? null,
    issueDate: meta.issue_date ?? null,
    expiryDate: meta.expiry_date ?? null,
    uploadedBy: userId,
  });

  const [doc] = await db
    .select({
      id: documentsTable.id,
      property_id: documentsTable.propertyId,
      service_id: documentsTable.serviceId,
      type: documentsTable.type,
      title: documentsTable.title,
      file_url: documentsTable.fileUrl,
      file_size: documentsTable.fileSize,
      ocr_data: documentsTable.ocrData,
      vendor_cnpj: documentsTable.vendorCnpj,
      amount: documentsTable.amount,
      issue_date: documentsTable.issueDate,
      expiry_date: documentsTable.expiryDate,
      uploaded_by: documentsTable.uploadedBy,
      created_at: documentsTable.createdAt,
      deleted_at: documentsTable.deletedAt,
    })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId)))
    .limit(1) as Document[];

  if (!doc) return err(c, 'Documento nao encontrado apos upload', 'DOCUMENT_UPLOAD_READ_FAILED', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document', entityId: id, action: 'document_uploaded',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      document_id: id,
      type: doc.type,
      title: doc.title,
      file_mime_type: file.type,
      file_size: doc.file_size,
      actor_id: userId,
    },
  });

  return ok(c, { document: mapDocumentForResponse(doc) }, 201);
});

// ── GET /properties/:propertyId/documents/:id ────────────────────────────────

documents.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [doc] = await db
    .select({
      id: documentsTable.id,
      property_id: documentsTable.propertyId,
      service_id: documentsTable.serviceId,
      type: documentsTable.type,
      title: documentsTable.title,
      file_url: documentsTable.fileUrl,
      file_size: documentsTable.fileSize,
      ocr_data: documentsTable.ocrData,
      vendor_cnpj: documentsTable.vendorCnpj,
      amount: documentsTable.amount,
      issue_date: documentsTable.issueDate,
      expiry_date: documentsTable.expiryDate,
      uploaded_by: documentsTable.uploadedBy,
      created_at: documentsTable.createdAt,
      deleted_at: documentsTable.deletedAt,
      uploader_name: users.name,
    })
    .from(documentsTable)
    .innerJoin(users, eq(users.id, documentsTable.uploadedBy))
    .where(and(eq(documentsTable.id, id), eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)))
    .limit(1);

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);
  if (!(await ensureTenantServiceOrder(db, tenantId, propertyId, doc.service_id))) {
    return err(c, 'Documento nao encontrado', 'NOT_FOUND', 404);
  }
  return ok(c, { document: mapDocumentForResponse(doc) });
});

// ── DELETE /properties/:propertyId/documents/:id ─────────────────────────────

documents.get('/:id/download', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [doc] = await db
    .select({
      id: documentsTable.id,
      file_url: documentsTable.fileUrl,
      title: documentsTable.title,
      service_id: documentsTable.serviceId,
    })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)))
    .limit(1);

  if (!doc) return err(c, 'Documento nao encontrado', 'NOT_FOUND', 404);
  if (!(await ensureTenantServiceOrder(db, tenantId, propertyId, doc.service_id))) {
    return err(c, 'Documento nao encontrado', 'NOT_FOUND', 404);
  }

  const key = extractR2KeyFromPublicUrl(doc.file_url, c.env.R2_PUBLIC_URL);
  const object = await c.env.STORAGE.get(key);
  if (!object) return err(c, 'Arquivo nao encontrado', 'STORAGE_ERROR', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'private, max-age=60');
  headers.set('content-disposition', `inline; filename="${doc.title.replace(/"/g, '')}"`);

  return new Response(object.body, { headers });
});

documents.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await canDeleteDocument(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [doc] = await db
    .select({
      id: documentsTable.id,
      property_id: documentsTable.propertyId,
      service_id: documentsTable.serviceId,
      type: documentsTable.type,
      title: documentsTable.title,
      file_url: documentsTable.fileUrl,
      file_size: documentsTable.fileSize,
      ocr_data: documentsTable.ocrData,
      vendor_cnpj: documentsTable.vendorCnpj,
      amount: documentsTable.amount,
      issue_date: documentsTable.issueDate,
      expiry_date: documentsTable.expiryDate,
      uploaded_by: documentsTable.uploadedBy,
      created_at: documentsTable.createdAt,
      deleted_at: documentsTable.deletedAt,
    })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)))
    .limit(1) as Document[];

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);
  if (!(await ensureTenantServiceOrder(db, tenantId, propertyId, doc.service_id))) {
    return err(c, 'Documento nao encontrado', 'NOT_FOUND', 404);
  }

  await db
    .update(documentsTable)
    .set({ deletedAt: new Date().toISOString() })
    .where(and(eq(documentsTable.id, id), eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document', entityId: id, action: 'document_deleted',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: {
      property_id: propertyId,
      document_id: id,
      type: doc.type,
      title: doc.title,
      actor_id: userId,
    },
  });

  return ok(c, { success: true });
});

// ── POST /properties/:propertyId/documents/:id/ocr ───────────────────────────

documents.post('/:id/ocr', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');
  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await canRequestDocumentOCR(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [doc] = await db
    .select({
      id: documentsTable.id,
      property_id: documentsTable.propertyId,
      service_id: documentsTable.serviceId,
      type: documentsTable.type,
      title: documentsTable.title,
      file_url: documentsTable.fileUrl,
      file_size: documentsTable.fileSize,
      ocr_data: documentsTable.ocrData,
      vendor_cnpj: documentsTable.vendorCnpj,
      amount: documentsTable.amount,
      issue_date: documentsTable.issueDate,
      expiry_date: documentsTable.expiryDate,
      uploaded_by: documentsTable.uploadedBy,
      created_at: documentsTable.createdAt,
      deleted_at: documentsTable.deletedAt,
    })
    .from(documentsTable)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)))
    .limit(1) as Document[];

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);
  if (!(await ensureTenantServiceOrder(db, tenantId, propertyId, doc.service_id))) {
    return err(c, 'Documento nao encontrado', 'NOT_FOUND', 404);
  }
  if (doc.type !== 'invoice') return err(c, 'OCR disponível apenas para notas fiscais', 'INVALID_TYPE', 422);

  // Fetch the file from R2 to send to Workers AI
  const key = extractR2KeyFromPublicUrl(doc.file_url, c.env.R2_PUBLIC_URL);
  const r2Object = await c.env.STORAGE.get(key);
  if (!r2Object) return err(c, 'Arquivo não encontrado no storage', 'STORAGE_ERROR', 404);

  const fileBytes = await r2Object.arrayBuffer();

  // Workers AI — LLaVA for image OCR / text extraction
  // For PDFs we'd need a different approach; here we handle image invoices
  let ocrResult: Record<string, unknown> = {};
  try {
    const aiResponse = await (c.env.AI as Ai).run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: [...new Uint8Array(fileBytes)],
      prompt: `Extraia as seguintes informações desta nota fiscal em JSON:
        {"vendor_name": "", "vendor_cnpj": "", "amount": 0, "issue_date": "YYYY-MM-DD",
         "items": [{"description": "", "quantity": 0, "unit_price": 0}], "taxes": 0}
        Responda SOMENTE com o JSON, sem texto adicional.`,
      max_tokens: 512,
    } as Parameters<Ai['run']>[1]);

    const responseText = (aiResponse as { response: string }).response ?? '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) ocrResult = JSON.parse(jsonMatch[0]);
  } catch {
    // AI inference failed — return empty result rather than error
    ocrResult = { error: 'OCR não pôde ser processado automaticamente' };
  }

  // Patch the document with OCR data and extracted fields
  const patch: Partial<typeof documentsTable.$inferInsert> = {
    ocrData: ocrResult,
  };

  if (ocrResult.vendor_cnpj) patch.vendorCnpj = String(ocrResult.vendor_cnpj);
  if (ocrResult.amount) patch.amount = Number(ocrResult.amount);
  if (ocrResult.issue_date) patch.issueDate = String(ocrResult.issue_date);

  await db
    .update(documentsTable)
    .set(patch)
    .where(and(eq(documentsTable.id, id), eq(documentsTable.tenantId, tenantId), eq(documentsTable.propertyId, propertyId)));

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document', entityId: id, action: 'document_ocr_requested',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      document_id: id,
      ocr_provider: 'workers_ai_llava',
      requested_by: userId,
      request_source: 'api',
    },
  });

  return ok(c, { ocr_data: ocrResult });
});

// ── POST /properties/:propertyId/documents/:id/ingestion-jobs ────────────────

documents.post('/:id/ingestion-jobs', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  let rawBody: unknown = {};
  try { rawBody = await c.req.json(); } catch { rawBody = {}; }
  const parsed = CreateDocumentIngestionJobInputSchema.safeParse(rawBody);
  if (!parsed.success) return err(c, 'Body invalido', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(and(
      eq(documentsTable.id, documentId),
      eq(documentsTable.tenantId, tenantId),
      eq(documentsTable.propertyId, propertyId),
      isNull(documentsTable.deletedAt),
    ))
    .limit(1);

  if (!doc) return err(c, 'Documento nao encontrado', 'NOT_FOUND', 404);

  const [existingJob] = await db
    .select({ id: ingestionJobsTable.id })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.documentId, documentId),
      eq(ingestionJobsTable.tenantId, tenantId),
      or(
        eq(ingestionJobsTable.status, 'queued'),
        eq(ingestionJobsTable.status, 'processing'),
        eq(ingestionJobsTable.status, 'needs_review'),
      ),
    ))
    .limit(1);

  if (existingJob) return err(c, 'Ja existe job ativo para este documento', 'ACTIVE_JOB_EXISTS', 409);

  const jobId = nanoid();
  await db.insert(ingestionJobsTable).values({
    id: jobId,
    tenantId,
    propertyId,
    documentId,
    status: 'queued',
    provider: parsed.data.provider ?? 'none',
    modelName: parsed.data.modelName ?? null,
    attempts: 0,
  });

  const [job] = await db
    .select({
      id: ingestionJobsTable.id,
      documentId: ingestionJobsTable.documentId,
      propertyId: ingestionJobsTable.propertyId,
      status: ingestionJobsTable.status,
      provider: ingestionJobsTable.provider,
      modelName: ingestionJobsTable.modelName,
      attempts: ingestionJobsTable.attempts,
      lastError: ingestionJobsTable.lastError,
      startedAt: ingestionJobsTable.startedAt,
      finishedAt: ingestionJobsTable.finishedAt,
      createdAt: ingestionJobsTable.createdAt,
      updatedAt: ingestionJobsTable.updatedAt,
    })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
    ))
    .limit(1);

  if (!job) return err(c, 'Job nao encontrado apos criacao', 'JOB_CREATE_READ_FAILED', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document_ingestion_job',
    entityId: jobId,
    action: 'document_ingestion_job_created',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      document_id: documentId,
      job_id: jobId,
      provider: job.provider,
      model_name: job.modelName,
    },
  });

  return ok(c, { job }, 201);
});

export default documents;
