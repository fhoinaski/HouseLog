import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { canDeleteDocument, canRequestDocumentIngestion, canRequestDocumentOCR, canUploadDocument } from '../lib/authorization';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess, resolveTenant } from '../middleware/auth';
import { validatePrivateUpload, buildR2Key, uploadToR2, extractR2KeyFromPublicUrl } from '../lib/r2';
import { getDb } from '../db/client';
import { documents as documentsTable, documentIngestionJobs as ingestionJobsTable, documentExtractions as extractionsTable, documentExtractionReviews as extractionReviewsTable, documentExtractionCandidates as extractionCandidatesTable, inventoryItems, maintenanceSchedules, properties, serviceOrders, technicalSystems, users, warranties } from '../db/schema';
import { documentCreateSchema, CreateDocumentIngestionJobInputSchema, GenerateDocumentExtractionCandidatesInputSchema, ListDocumentExtractionCandidatesQuerySchema, ListDocumentIngestionJobsQuerySchema, ReviewDocumentExtractionCandidateInputSchema, ReviewDocumentExtractionInputSchema } from '@houselog/contracts';
import {
  buildDocumentExtractionCandidates,
  buildDocumentExtractionCandidatesAuditData,
  buildDocumentExtractionCandidateAppliedAuditData,
  buildDocumentExtractionCandidateApplyPatch,
  buildDocumentExtractionCandidateReviewAuditData,
  buildDocumentExtractionCandidateReviewPatch,
  buildDocumentExtractionReviewAuditData,
  buildDocumentExtractionReviewJobPatch,
  buildDocumentIngestionQueueFailurePatch,
  buildDocumentIngestionSummary,
  buildInventoryItemFromCandidatePayload,
  buildMaintenanceScheduleFromCandidatePayload,
  buildTechnicalSystemFromCandidatePayload,
  buildWarrantyFromCandidatePayload,
  canApplyDocumentExtractionCandidate,
  canGenerateDocumentExtractionCandidates,
  canReviewDocumentExtractionCandidate,
  enqueueDocumentIngestionJob,
  getDocumentExtractionDetail,
  getDocumentIngestionJobDetail,
  listDocumentExtractionCandidatesForExtraction,
  listDocumentIngestionJobsForDocument,
  mapAppliedInventoryItemToResponse,
  mapAppliedMaintenanceScheduleToResponse,
  mapAppliedTechnicalSystemToResponse,
  mapAppliedWarrantyToResponse,
  mapDocumentExtractionCandidateToContract,
  mapJobToContract,
  mapReviewToContract,
} from '../lib/document-ingestion-tenant';
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

  const permission = await canDeleteDocument(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!permission.allowed) {
    const message = permission.code === 'NOT_FOUND' ? 'Documento não encontrado' : 'Sem acesso';
    return err(c, message, permission.code, permission.status);
  }

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

// ── Document ingestion jobs ──────────────────────────────────────────────────

documents.get('/:id/ingestion-summary', async (c) => {
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

  const jobs = await db
    .select({
      status: ingestionJobsTable.status,
      createdAt: ingestionJobsTable.createdAt,
    })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ));

  const extractions = await db
    .select({ id: extractionsTable.id })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
    ));

  const reviews = await db
    .select({ status: extractionReviewsTable.status })
    .from(extractionReviewsTable)
    .where(and(
      eq(extractionReviewsTable.tenantId, tenantId),
      eq(extractionReviewsTable.propertyId, propertyId),
      eq(extractionReviewsTable.documentId, documentId),
    ));

  const candidates = await db
    .select({ status: extractionCandidatesTable.status })
    .from(extractionCandidatesTable)
    .where(and(
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
    ));

  return ok(c, {
    summary: buildDocumentIngestionSummary({
      jobs,
      extractions,
      reviews,
      candidates,
    }),
  });
});

documents.get('/:id/ingestion-jobs', async (c) => {
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

  const query = ListDocumentIngestionJobsQuerySchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams.entries())
  );
  if (!query.success) return err(c, 'Query invalida', 'VALIDATION_ERROR', 422, query.error.flatten());

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

  const filters = [
    eq(ingestionJobsTable.tenantId, tenantId),
    eq(ingestionJobsTable.propertyId, propertyId),
    eq(ingestionJobsTable.documentId, documentId),
  ];

  if (query.data.status) filters.push(eq(ingestionJobsTable.status, query.data.status));
  if (query.data.cursor) filters.push(lt(ingestionJobsTable.createdAt, query.data.cursor));

  const jobs = await db
    .select({
      id: ingestionJobsTable.id,
      tenantId: ingestionJobsTable.tenantId,
      propertyId: ingestionJobsTable.propertyId,
      documentId: ingestionJobsTable.documentId,
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
    .where(and(...filters))
    .orderBy(desc(ingestionJobsTable.createdAt))
    .limit(query.data.limit + 1);

  return ok(c, listDocumentIngestionJobsForDocument({
    jobs,
    tenantId,
    propertyId,
    documentId,
    status: query.data.status,
    cursor: query.data.cursor,
    limit: query.data.limit,
  }));
});

documents.post('/:id/ingestion-jobs', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const canIngest = await canRequestDocumentIngestion(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!canIngest) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

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
      eq(ingestionJobsTable.propertyId, propertyId),
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
      tenantId: ingestionJobsTable.tenantId,
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
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
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

  try {
    await enqueueDocumentIngestionJob(c.env.DOCUMENT_INGESTION_QUEUE, {
      tenantId,
      propertyId,
      documentId,
      jobId,
    });
  } catch (queueError) {
    await db
      .update(ingestionJobsTable)
      .set(buildDocumentIngestionQueueFailurePatch(queueError, new Date().toISOString()))
      .where(and(
        eq(ingestionJobsTable.id, jobId),
        eq(ingestionJobsTable.tenantId, tenantId),
        eq(ingestionJobsTable.propertyId, propertyId),
        eq(ingestionJobsTable.documentId, documentId),
      ));

    return err(c, 'Falha ao enfileirar job de ingestao', 'INGESTION_QUEUE_FAILED', 500);
  }

  return ok(c, { job: mapJobToContract(job) }, 201);
});

// ── GET /properties/:propertyId/documents/:id/ingestion-jobs/:jobId ──────────

documents.get('/:id/ingestion-jobs/:jobId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const jobId = c.req.param('jobId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

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

  const [job] = await db
    .select({
      id: ingestionJobsTable.id,
      tenantId: ingestionJobsTable.tenantId,
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
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ))
    .limit(1);

  if (!job) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  const rawExtractions = await db
    .select({
      id: extractionsTable.id,
      documentId: extractionsTable.documentId,
      jobId: extractionsTable.jobId,
      rawText: extractionsTable.rawText,
      rawJson: extractionsTable.rawJson,
      normalizedJson: extractionsTable.normalizedJson,
      confidenceScore: extractionsTable.confidenceScore,
      schemaVersion: extractionsTable.schemaVersion,
      modelName: extractionsTable.modelName,
      createdAt: extractionsTable.createdAt,
    })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.jobId, jobId),
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
    ))
    .orderBy(desc(extractionsTable.createdAt));

  const detail = getDocumentIngestionJobDetail({
    job,
    extractions: rawExtractions,
    tenantId,
    propertyId,
    documentId,
  });

  if (!detail) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  return ok(c, detail);
});

// ── GET /properties/:propertyId/documents/:id/ingestion-jobs/:jobId/extractions/:extractionId

documents.get('/:id/ingestion-jobs/:jobId/extractions/:extractionId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const jobId = c.req.param('jobId')!;
  const extractionId = c.req.param('extractionId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

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

  const [job] = await db
    .select({ id: ingestionJobsTable.id })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ))
    .limit(1);

  if (!job) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  const [extraction] = await db
    .select({
      id: extractionsTable.id,
      tenantId: extractionsTable.tenantId,
      propertyId: extractionsTable.propertyId,
      documentId: extractionsTable.documentId,
      jobId: extractionsTable.jobId,
      rawText: extractionsTable.rawText,
      rawJson: extractionsTable.rawJson,
      normalizedJson: extractionsTable.normalizedJson,
      confidenceScore: extractionsTable.confidenceScore,
      schemaVersion: extractionsTable.schemaVersion,
      modelName: extractionsTable.modelName,
      createdAt: extractionsTable.createdAt,
    })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.id, extractionId),
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
      eq(extractionsTable.jobId, jobId),
    ))
    .limit(1);

  if (!extraction) return err(c, 'Extraction nao encontrada', 'NOT_FOUND', 404);

  const [review] = await db
    .select({
      id: extractionReviewsTable.id,
      tenantId: extractionReviewsTable.tenantId,
      propertyId: extractionReviewsTable.propertyId,
      documentId: extractionReviewsTable.documentId,
      extractionId: extractionReviewsTable.extractionId,
      status: extractionReviewsTable.status,
      reviewedBy: extractionReviewsTable.reviewedBy,
      reviewedAt: extractionReviewsTable.reviewedAt,
      notes: extractionReviewsTable.notes,
      createdAt: extractionReviewsTable.createdAt,
      updatedAt: extractionReviewsTable.updatedAt,
    })
    .from(extractionReviewsTable)
    .where(and(
      eq(extractionReviewsTable.tenantId, tenantId),
      eq(extractionReviewsTable.propertyId, propertyId),
      eq(extractionReviewsTable.documentId, documentId),
      eq(extractionReviewsTable.extractionId, extractionId),
    ))
    .limit(1);

  const detail = getDocumentExtractionDetail({
    extraction,
    review: review ?? null,
    tenantId,
    propertyId,
    documentId,
    jobId,
  });

  if (!detail) return err(c, 'Extraction nao encontrada', 'NOT_FOUND', 404);

  return ok(c, { extraction: detail });
});

documents.post('/:id/ingestion-jobs/:jobId/extractions/:extractionId/candidates/generate', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const jobId = c.req.param('jobId')!;
  const extractionId = c.req.param('extractionId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  let rawBody: unknown = {};
  try { rawBody = await c.req.json(); } catch { rawBody = {}; }
  const parsed = GenerateDocumentExtractionCandidatesInputSchema.safeParse(rawBody);
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

  const [job] = await db
    .select({ id: ingestionJobsTable.id })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ))
    .limit(1);
  if (!job) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  const [extraction] = await db
    .select({
      id: extractionsTable.id,
      tenantId: extractionsTable.tenantId,
      propertyId: extractionsTable.propertyId,
      documentId: extractionsTable.documentId,
      jobId: extractionsTable.jobId,
      normalizedJson: extractionsTable.normalizedJson,
      confidenceScore: extractionsTable.confidenceScore,
    })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.id, extractionId),
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
      eq(extractionsTable.jobId, jobId),
    ))
    .limit(1);
  if (!extraction) return err(c, 'Extraction nao encontrada', 'NOT_FOUND', 404);

  const [review] = await db
    .select({ status: extractionReviewsTable.status })
    .from(extractionReviewsTable)
    .where(and(
      eq(extractionReviewsTable.tenantId, tenantId),
      eq(extractionReviewsTable.propertyId, propertyId),
      eq(extractionReviewsTable.documentId, documentId),
      eq(extractionReviewsTable.extractionId, extractionId),
    ))
    .limit(1);

  const existingCandidates = await db
    .select({ id: extractionCandidatesTable.id })
    .from(extractionCandidatesTable)
    .where(and(
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
    ))
    .limit(1);

  const decision = canGenerateDocumentExtractionCandidates({
    activeTenantId: tenantId,
    extractionTenantId: extraction.tenantId,
    extractionPropertyId: extraction.propertyId,
    extractionDocumentId: extraction.documentId,
    extractionJobId: extraction.jobId,
    requestedPropertyId: propertyId,
    requestedDocumentId: documentId,
    requestedJobId: jobId,
    normalizedJson: extraction.normalizedJson,
    reviewStatus: review?.status ?? null,
    existingCandidateCount: existingCandidates.length,
  });
  if (!decision.allowed) {
    const messages: Record<typeof decision.code, string> = {
      TENANT_REQUIRED: 'Tenant ativo obrigatorio',
      NOT_FOUND: 'Extraction nao encontrada',
      NORMALIZED_JSON_REQUIRED: 'Extraction sem normalizedJson aprovado',
      INVALID_NORMALIZED_JSON: 'normalizedJson invalido',
      EXTRACTION_REVIEW_NOT_APPROVED: 'Extraction ainda nao aprovada para gerar candidates',
      CANDIDATES_ALREADY_EXIST: 'Candidates ja existem para esta extraction',
    };
    return err(c, messages[decision.code], decision.code, decision.status);
  }

  const normalizedJson = extraction.normalizedJson;
  if (!normalizedJson) return err(c, 'Extraction sem normalizedJson aprovado', 'NORMALIZED_JSON_REQUIRED', 409);

  const now = new Date().toISOString();
  const candidatesToInsert = buildDocumentExtractionCandidates({
    tenantId,
    propertyId,
    documentId,
    jobId,
    extractionId,
    normalizedJson,
    extractionConfidenceScore: extraction.confidenceScore,
    now,
    idFactory: nanoid,
  });
  if (candidatesToInsert.length > 0) {
    await db.insert(extractionCandidatesTable).values(candidatesToInsert);
  }

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document_extraction_candidate',
    entityId: extractionId,
    action: 'document_extraction_candidates_generated',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: buildDocumentExtractionCandidatesAuditData({
      propertyId,
      documentId,
      jobId,
      extractionId,
      candidates: candidatesToInsert,
    }),
  });

  const candidates = await db
    .select({
      id: extractionCandidatesTable.id,
      tenantId: extractionCandidatesTable.tenantId,
      propertyId: extractionCandidatesTable.propertyId,
      documentId: extractionCandidatesTable.documentId,
      jobId: extractionCandidatesTable.jobId,
      extractionId: extractionCandidatesTable.extractionId,
      candidateType: extractionCandidatesTable.candidateType,
      status: extractionCandidatesTable.status,
      targetEntityType: extractionCandidatesTable.targetEntityType,
      targetEntityId: extractionCandidatesTable.targetEntityId,
      sourcePath: extractionCandidatesTable.sourcePath,
      payloadJson: extractionCandidatesTable.payloadJson,
      confidenceScore: extractionCandidatesTable.confidenceScore,
      reviewNotes: extractionCandidatesTable.reviewNotes,
      createdAt: extractionCandidatesTable.createdAt,
      updatedAt: extractionCandidatesTable.updatedAt,
      appliedAt: extractionCandidatesTable.appliedAt,
      appliedBy: extractionCandidatesTable.appliedBy,
    })
    .from(extractionCandidatesTable)
    .where(and(
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
    ))
    .orderBy(extractionCandidatesTable.createdAt);

  return ok(c, { candidates: candidates.map(mapDocumentExtractionCandidateToContract) }, 201);
});

documents.get('/:id/ingestion-jobs/:jobId/extractions/:extractionId/candidates', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const jobId = c.req.param('jobId')!;
  const extractionId = c.req.param('extractionId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const query = ListDocumentExtractionCandidatesQuerySchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams.entries())
  );
  if (!query.success) return err(c, 'Query invalida', 'VALIDATION_ERROR', 422, query.error.flatten());

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

  const [job] = await db
    .select({ id: ingestionJobsTable.id })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ))
    .limit(1);
  if (!job) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  const [extraction] = await db
    .select({ id: extractionsTable.id })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.id, extractionId),
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
      eq(extractionsTable.jobId, jobId),
    ))
    .limit(1);
  if (!extraction) return err(c, 'Extraction nao encontrada', 'NOT_FOUND', 404);

  const filters = [
    eq(extractionCandidatesTable.tenantId, tenantId),
    eq(extractionCandidatesTable.propertyId, propertyId),
    eq(extractionCandidatesTable.documentId, documentId),
    eq(extractionCandidatesTable.jobId, jobId),
    eq(extractionCandidatesTable.extractionId, extractionId),
  ];
  if (query.data.status) filters.push(eq(extractionCandidatesTable.status, query.data.status));
  if (query.data.candidateType) filters.push(eq(extractionCandidatesTable.candidateType, query.data.candidateType));
  if (query.data.cursor) filters.push(lt(extractionCandidatesTable.createdAt, query.data.cursor));

  const candidates = await db
    .select({
      id: extractionCandidatesTable.id,
      tenantId: extractionCandidatesTable.tenantId,
      propertyId: extractionCandidatesTable.propertyId,
      documentId: extractionCandidatesTable.documentId,
      jobId: extractionCandidatesTable.jobId,
      extractionId: extractionCandidatesTable.extractionId,
      candidateType: extractionCandidatesTable.candidateType,
      status: extractionCandidatesTable.status,
      targetEntityType: extractionCandidatesTable.targetEntityType,
      targetEntityId: extractionCandidatesTable.targetEntityId,
      sourcePath: extractionCandidatesTable.sourcePath,
      payloadJson: extractionCandidatesTable.payloadJson,
      confidenceScore: extractionCandidatesTable.confidenceScore,
      reviewNotes: extractionCandidatesTable.reviewNotes,
      createdAt: extractionCandidatesTable.createdAt,
      updatedAt: extractionCandidatesTable.updatedAt,
      appliedAt: extractionCandidatesTable.appliedAt,
      appliedBy: extractionCandidatesTable.appliedBy,
    })
    .from(extractionCandidatesTable)
    .where(and(...filters))
    .orderBy(desc(extractionCandidatesTable.createdAt), desc(extractionCandidatesTable.id))
    .limit(query.data.limit + 1);

  const page = listDocumentExtractionCandidatesForExtraction({
    candidates,
    tenantId,
    propertyId,
    documentId,
    jobId,
    extractionId,
    status: query.data.status,
    candidateType: query.data.candidateType,
    cursor: query.data.cursor,
    limit: query.data.limit,
  });

  return ok(c, {
    candidates: page.data,
    next_cursor: page.next_cursor,
    has_more: page.has_more,
  });
});

documents.post('/:id/ingestion-jobs/:jobId/extractions/:extractionId/candidates/:candidateId/apply', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const jobId = c.req.param('jobId')!;
  const extractionId = c.req.param('extractionId')!;
  const candidateId = c.req.param('candidateId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

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

  const [job] = await db
    .select({ id: ingestionJobsTable.id })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ))
    .limit(1);
  if (!job) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  const [extraction] = await db
    .select({ id: extractionsTable.id })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.id, extractionId),
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
      eq(extractionsTable.jobId, jobId),
    ))
    .limit(1);
  if (!extraction) return err(c, 'Extraction nao encontrada', 'NOT_FOUND', 404);

  const [candidateBefore] = await db
    .select({
      id: extractionCandidatesTable.id,
      tenantId: extractionCandidatesTable.tenantId,
      propertyId: extractionCandidatesTable.propertyId,
      documentId: extractionCandidatesTable.documentId,
      jobId: extractionCandidatesTable.jobId,
      extractionId: extractionCandidatesTable.extractionId,
      candidateType: extractionCandidatesTable.candidateType,
      status: extractionCandidatesTable.status,
      targetEntityType: extractionCandidatesTable.targetEntityType,
      targetEntityId: extractionCandidatesTable.targetEntityId,
      sourcePath: extractionCandidatesTable.sourcePath,
      payloadJson: extractionCandidatesTable.payloadJson,
      confidenceScore: extractionCandidatesTable.confidenceScore,
      reviewNotes: extractionCandidatesTable.reviewNotes,
      createdAt: extractionCandidatesTable.createdAt,
      updatedAt: extractionCandidatesTable.updatedAt,
      appliedAt: extractionCandidatesTable.appliedAt,
      appliedBy: extractionCandidatesTable.appliedBy,
    })
    .from(extractionCandidatesTable)
    .where(and(
      eq(extractionCandidatesTable.id, candidateId),
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
    ))
    .limit(1);
  if (!candidateBefore) return err(c, 'Candidate nao encontrado', 'NOT_FOUND', 404);

  const applyDecision = canApplyDocumentExtractionCandidate(candidateBefore);
  if (!applyDecision.allowed) {
    const messages: Record<typeof applyDecision.code, string> = {
      TENANT_REQUIRED: 'Tenant ativo obrigatorio',
      NOT_FOUND: 'Candidate nao encontrado',
      CANDIDATE_NOT_APPROVED: 'Candidate precisa estar aprovado antes da aplicacao',
      CANDIDATE_ALREADY_APPLIED: 'Candidate ja aplicado',
      UNSUPPORTED_CANDIDATE_TYPE: 'Tipo de candidate ainda nao suportado para aplicacao',
      INVALID_CANDIDATE_TARGET: 'Target do candidate incompativel',
      INVALID_TECHNICAL_SYSTEM_PAYLOAD: 'Payload de sistema tecnico invalido',
      INVALID_WARRANTY_PAYLOAD: 'Payload de garantia invalido',
      INVALID_INVENTORY_ITEM_PAYLOAD: 'Payload de item de inventario invalido',
      WARRANTY_END_DATE_REQUIRED: 'Garantia extraida sem data final',
      INVALID_MAINTENANCE_RECOMMENDATION_PAYLOAD: 'Payload de recomendacao de manutencao invalido',
    };
    return err(c, messages[applyDecision.code], applyDecision.code, applyDecision.status);
  }

  const now = new Date().toISOString();
  const targetEntityId = nanoid();
  let responseEntity:
    | { technicalSystem: ReturnType<typeof mapAppliedTechnicalSystemToResponse> }
    | { warranty: ReturnType<typeof mapAppliedWarrantyToResponse> }
    | { inventoryItem: ReturnType<typeof mapAppliedInventoryItemToResponse> }
    | { maintenanceSchedule: ReturnType<typeof mapAppliedMaintenanceScheduleToResponse> };

  if (applyDecision.targetEntityType === 'technical_system') {
    const technicalSystemInsert = buildTechnicalSystemFromCandidatePayload({
      technicalSystemId: targetEntityId,
      tenantId,
      propertyId,
      payloadJson: candidateBefore.payloadJson,
      now,
    });

    await db.insert(technicalSystems).values(technicalSystemInsert);

    const [technicalSystem] = await db
      .select({
        id: technicalSystems.id,
        propertyId: technicalSystems.propertyId,
        name: technicalSystems.name,
        type: technicalSystems.type,
        description: technicalSystems.description,
        locationSummary: technicalSystems.locationSummary,
        installationDate: technicalSystems.installationDate,
        status: technicalSystems.status,
        createdAt: technicalSystems.createdAt,
        updatedAt: technicalSystems.updatedAt,
      })
      .from(technicalSystems)
      .where(and(
        eq(technicalSystems.id, targetEntityId),
        eq(technicalSystems.tenantId, tenantId),
        eq(technicalSystems.propertyId, propertyId),
        isNull(technicalSystems.deletedAt),
      ))
      .limit(1);
    if (!technicalSystem) return err(c, 'Sistema tecnico nao encontrado apos aplicacao', 'TECHNICAL_SYSTEM_APPLY_READ_FAILED', 500);

    responseEntity = { technicalSystem: mapAppliedTechnicalSystemToResponse(technicalSystem) };
  } else if (applyDecision.targetEntityType === 'warranty') {
    const warrantyInsert = buildWarrantyFromCandidatePayload({
      warrantyId: targetEntityId,
      tenantId,
      propertyId,
      documentId,
      createdBy: userId,
      payloadJson: candidateBefore.payloadJson,
      now,
    });

    await db.insert(warranties).values(warrantyInsert);

    const [warranty] = await db
      .select({
        id: warranties.id,
        propertyId: warranties.propertyId,
        documentId: warranties.documentId,
        title: warranties.title,
        description: warranties.description,
        providerName: warranties.providerName,
        warrantyType: warranties.warrantyType,
        startDate: warranties.startDate,
        endDate: warranties.endDate,
        status: warranties.status,
        coverage: warranties.coverage,
        exclusions: warranties.exclusions,
        createdBy: warranties.createdBy,
        createdAt: warranties.createdAt,
        updatedAt: warranties.updatedAt,
      })
      .from(warranties)
      .where(and(
        eq(warranties.id, targetEntityId),
        eq(warranties.tenantId, tenantId),
        eq(warranties.propertyId, propertyId),
        eq(warranties.documentId, documentId),
        isNull(warranties.deletedAt),
      ))
      .limit(1);
    if (!warranty) return err(c, 'Garantia nao encontrada apos aplicacao', 'WARRANTY_APPLY_READ_FAILED', 500);

    responseEntity = { warranty: mapAppliedWarrantyToResponse(warranty) };
  } else if (applyDecision.targetEntityType === 'inventory_item') {
    const inventoryItemInsert = buildInventoryItemFromCandidatePayload({
      inventoryItemId: targetEntityId,
      tenantId,
      propertyId,
      payloadJson: candidateBefore.payloadJson,
      now,
    });

    await db.insert(inventoryItems).values(inventoryItemInsert);

    const [inventoryItem] = await db
      .select({
        id: inventoryItems.id,
        propertyId: inventoryItems.propertyId,
        category: inventoryItems.category,
        name: inventoryItems.name,
        brand: inventoryItems.brand,
        model: inventoryItems.model,
        supplier: inventoryItems.supplier,
        quantity: inventoryItems.quantity,
        unit: inventoryItems.unit,
        purchaseDate: inventoryItems.purchaseDate,
        warrantyUntil: inventoryItems.warrantyUntil,
        createdAt: inventoryItems.createdAt,
      })
      .from(inventoryItems)
      .where(and(
        eq(inventoryItems.id, targetEntityId),
        eq(inventoryItems.tenantId, tenantId),
        eq(inventoryItems.propertyId, propertyId),
        isNull(inventoryItems.deletedAt),
      ))
      .limit(1);
    if (!inventoryItem) return err(c, 'Item de inventario nao encontrado apos aplicacao', 'INVENTORY_ITEM_APPLY_READ_FAILED', 500);

    responseEntity = { inventoryItem: mapAppliedInventoryItemToResponse(inventoryItem) };
  } else if (applyDecision.targetEntityType === 'maintenance_schedule') {
    const maintenanceScheduleInsert = buildMaintenanceScheduleFromCandidatePayload({
      maintenanceScheduleId: targetEntityId,
      tenantId,
      propertyId,
      payloadJson: candidateBefore.payloadJson,
      now,
    });

    await db.insert(maintenanceSchedules).values(maintenanceScheduleInsert);

    const [maintenanceSchedule] = await db
      .select({
        id: maintenanceSchedules.id,
        propertyId: maintenanceSchedules.propertyId,
        systemType: maintenanceSchedules.systemType,
        title: maintenanceSchedules.title,
        description: maintenanceSchedules.description,
        frequency: maintenanceSchedules.frequency,
        lastDone: maintenanceSchedules.lastDone,
        nextDue: maintenanceSchedules.nextDue,
        responsible: maintenanceSchedules.responsible,
        autoCreateOs: maintenanceSchedules.autoCreateOs,
        notes: maintenanceSchedules.notes,
        createdAt: maintenanceSchedules.createdAt,
      })
      .from(maintenanceSchedules)
      .where(and(
        eq(maintenanceSchedules.id, targetEntityId),
        eq(maintenanceSchedules.tenantId, tenantId),
        eq(maintenanceSchedules.propertyId, propertyId),
        isNull(maintenanceSchedules.deletedAt),
      ))
      .limit(1);
    if (!maintenanceSchedule) return err(c, 'Agenda de manutencao nao encontrada apos aplicacao', 'MAINTENANCE_SCHEDULE_APPLY_READ_FAILED', 500);

    responseEntity = { maintenanceSchedule: mapAppliedMaintenanceScheduleToResponse(maintenanceSchedule) };
  } else {
    return err(c, 'Tipo de candidate ainda nao suportado para aplicacao', 'UNSUPPORTED_CANDIDATE_TYPE', 422);
  }

  await db
    .update(extractionCandidatesTable)
    .set(buildDocumentExtractionCandidateApplyPatch({
      targetEntityId,
      appliedBy: userId,
      now,
    }))
    .where(and(
      eq(extractionCandidatesTable.id, candidateId),
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
      eq(extractionCandidatesTable.candidateType, candidateBefore.candidateType),
      eq(extractionCandidatesTable.targetEntityType, applyDecision.targetEntityType),
      eq(extractionCandidatesTable.status, 'approved'),
      isNull(extractionCandidatesTable.targetEntityId),
      isNull(extractionCandidatesTable.appliedAt),
      isNull(extractionCandidatesTable.appliedBy),
    ));

  const [candidate] = await db
    .select({
      id: extractionCandidatesTable.id,
      tenantId: extractionCandidatesTable.tenantId,
      propertyId: extractionCandidatesTable.propertyId,
      documentId: extractionCandidatesTable.documentId,
      jobId: extractionCandidatesTable.jobId,
      extractionId: extractionCandidatesTable.extractionId,
      candidateType: extractionCandidatesTable.candidateType,
      status: extractionCandidatesTable.status,
      targetEntityType: extractionCandidatesTable.targetEntityType,
      targetEntityId: extractionCandidatesTable.targetEntityId,
      sourcePath: extractionCandidatesTable.sourcePath,
      payloadJson: extractionCandidatesTable.payloadJson,
      confidenceScore: extractionCandidatesTable.confidenceScore,
      reviewNotes: extractionCandidatesTable.reviewNotes,
      createdAt: extractionCandidatesTable.createdAt,
      updatedAt: extractionCandidatesTable.updatedAt,
      appliedAt: extractionCandidatesTable.appliedAt,
      appliedBy: extractionCandidatesTable.appliedBy,
    })
    .from(extractionCandidatesTable)
    .where(and(
      eq(extractionCandidatesTable.id, candidateId),
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
    ))
    .limit(1);
  if (!candidate) return err(c, 'Candidate nao encontrado apos aplicacao', 'CANDIDATE_APPLY_WRITE_FAILED', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document_extraction_candidate',
    entityId: candidateId,
    action: 'document_extraction_candidate_applied',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: buildDocumentExtractionCandidateAppliedAuditData({
      tenantId,
      propertyId,
      documentId,
      jobId,
      extractionId,
      candidateId,
      targetEntityType: applyDecision.targetEntityType,
      targetEntityId,
    }),
  });

  return ok(c, {
    candidate: mapDocumentExtractionCandidateToContract(candidate),
    ...responseEntity,
  }, 201);
});

// ── PATCH /properties/:propertyId/documents/:id/ingestion-jobs/:jobId/extractions/:extractionId/review

documents.patch('/:id/ingestion-jobs/:jobId/extractions/:extractionId/review', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const jobId = c.req.param('jobId')!;
  const extractionId = c.req.param('extractionId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  let rawBody: unknown = {};
  try { rawBody = await c.req.json(); } catch { rawBody = {}; }
  const parsed = ReviewDocumentExtractionInputSchema.safeParse(rawBody);
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

  const [job] = await db
    .select({ id: ingestionJobsTable.id })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ))
    .limit(1);

  if (!job) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  const [extraction] = await db
    .select({ id: extractionsTable.id })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.id, extractionId),
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
      eq(extractionsTable.jobId, jobId),
    ))
    .limit(1);

  if (!extraction) return err(c, 'Extraction nao encontrada', 'NOT_FOUND', 404);

  const now = new Date().toISOString();
  const [existingReview] = await db
    .select({ id: extractionReviewsTable.id })
    .from(extractionReviewsTable)
    .where(and(
      eq(extractionReviewsTable.tenantId, tenantId),
      eq(extractionReviewsTable.propertyId, propertyId),
      eq(extractionReviewsTable.documentId, documentId),
      eq(extractionReviewsTable.extractionId, extractionId),
    ))
    .limit(1);

  const reviewId = existingReview?.id ?? nanoid();
  const reviewPatch = {
    status: parsed.data.status,
    notes: parsed.data.notes ?? null,
    reviewedBy: userId,
    reviewedAt: now,
    updatedAt: now,
  };

  if (existingReview) {
    await db
      .update(extractionReviewsTable)
      .set(reviewPatch)
      .where(and(
        eq(extractionReviewsTable.id, reviewId),
        eq(extractionReviewsTable.tenantId, tenantId),
        eq(extractionReviewsTable.propertyId, propertyId),
        eq(extractionReviewsTable.documentId, documentId),
        eq(extractionReviewsTable.extractionId, extractionId),
      ));
  } else {
    await db.insert(extractionReviewsTable).values({
      id: reviewId,
      tenantId,
      propertyId,
      documentId,
      extractionId,
      ...reviewPatch,
      createdAt: now,
    });
  }

  await db
    .update(ingestionJobsTable)
    .set(buildDocumentExtractionReviewJobPatch({ status: parsed.data.status, now }))
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ));

  const [review] = await db
    .select({
      id: extractionReviewsTable.id,
      tenantId: extractionReviewsTable.tenantId,
      propertyId: extractionReviewsTable.propertyId,
      documentId: extractionReviewsTable.documentId,
      extractionId: extractionReviewsTable.extractionId,
      status: extractionReviewsTable.status,
      reviewedBy: extractionReviewsTable.reviewedBy,
      reviewedAt: extractionReviewsTable.reviewedAt,
      notes: extractionReviewsTable.notes,
      createdAt: extractionReviewsTable.createdAt,
      updatedAt: extractionReviewsTable.updatedAt,
    })
    .from(extractionReviewsTable)
    .where(and(
      eq(extractionReviewsTable.id, reviewId),
      eq(extractionReviewsTable.tenantId, tenantId),
      eq(extractionReviewsTable.propertyId, propertyId),
      eq(extractionReviewsTable.documentId, documentId),
      eq(extractionReviewsTable.extractionId, extractionId),
    ))
    .limit(1);

  if (!review) return err(c, 'Review nao encontrada apos gravacao', 'REVIEW_WRITE_FAILED', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document_extraction_review',
    entityId: reviewId,
    action: 'document_extraction_reviewed',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: buildDocumentExtractionReviewAuditData({
      tenantId,
      propertyId,
      documentId,
      jobId,
      extractionId,
      reviewId,
      status: parsed.data.status,
    }),
  });

  return ok(c, { review: mapReviewToContract(review) });
});

// â”€â”€ PATCH /properties/:propertyId/documents/:id/ingestion-jobs/:jobId/extractions/:extractionId/candidates/:candidateId

documents.patch('/:id/ingestion-jobs/:jobId/extractions/:extractionId/candidates/:candidateId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const documentId = c.req.param('id')!;
  const jobId = c.req.param('jobId')!;
  const extractionId = c.req.param('extractionId')!;
  const candidateId = c.req.param('candidateId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');
  const tenantId = c.get('tenantId');

  if (!tenantId) return err(c, 'Tenant ativo obrigatorio', 'TENANT_REQUIRED', 400);
  if (!(await ensureTenantProperty(db, tenantId, propertyId))) return err(c, 'Imovel nao encontrado', 'NOT_FOUND', 404);

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role, tenantId, c.get('tenantRole'));
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  let rawBody: unknown = {};
  try { rawBody = await c.req.json(); } catch { rawBody = {}; }
  const parsed = ReviewDocumentExtractionCandidateInputSchema.safeParse(rawBody);
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

  const [job] = await db
    .select({ id: ingestionJobsTable.id })
    .from(ingestionJobsTable)
    .where(and(
      eq(ingestionJobsTable.id, jobId),
      eq(ingestionJobsTable.tenantId, tenantId),
      eq(ingestionJobsTable.propertyId, propertyId),
      eq(ingestionJobsTable.documentId, documentId),
    ))
    .limit(1);

  if (!job) return err(c, 'Job nao encontrado', 'NOT_FOUND', 404);

  const [extraction] = await db
    .select({ id: extractionsTable.id })
    .from(extractionsTable)
    .where(and(
      eq(extractionsTable.id, extractionId),
      eq(extractionsTable.tenantId, tenantId),
      eq(extractionsTable.propertyId, propertyId),
      eq(extractionsTable.documentId, documentId),
      eq(extractionsTable.jobId, jobId),
    ))
    .limit(1);

  if (!extraction) return err(c, 'Extraction nao encontrada', 'NOT_FOUND', 404);

  const [candidateBefore] = await db
    .select({
      id: extractionCandidatesTable.id,
      tenantId: extractionCandidatesTable.tenantId,
      propertyId: extractionCandidatesTable.propertyId,
      documentId: extractionCandidatesTable.documentId,
      jobId: extractionCandidatesTable.jobId,
      extractionId: extractionCandidatesTable.extractionId,
      status: extractionCandidatesTable.status,
    })
    .from(extractionCandidatesTable)
    .where(and(
      eq(extractionCandidatesTable.id, candidateId),
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
    ))
    .limit(1);

  if (!candidateBefore) return err(c, 'Candidate nao encontrado', 'NOT_FOUND', 404);

  const reviewDecision = canReviewDocumentExtractionCandidate({
    activeTenantId: tenantId,
    candidateTenantId: candidateBefore.tenantId,
    candidatePropertyId: candidateBefore.propertyId,
    candidateDocumentId: candidateBefore.documentId,
    candidateJobId: candidateBefore.jobId,
    candidateExtractionId: candidateBefore.extractionId,
    requestedPropertyId: propertyId,
    requestedDocumentId: documentId,
    requestedJobId: jobId,
    requestedExtractionId: extractionId,
    candidateStatus: candidateBefore.status,
  });

  if (!reviewDecision.allowed) {
    return err(c, 'Candidate nao pode ser revisado', reviewDecision.code, reviewDecision.status);
  }

  const now = new Date().toISOString();
  await db
    .update(extractionCandidatesTable)
    .set(buildDocumentExtractionCandidateReviewPatch({
      status: parsed.data.status,
      reviewNotes: parsed.data.reviewNotes,
      now,
    }))
    .where(and(
      eq(extractionCandidatesTable.id, candidateId),
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
    ));

  const [candidate] = await db
    .select({
      id: extractionCandidatesTable.id,
      tenantId: extractionCandidatesTable.tenantId,
      propertyId: extractionCandidatesTable.propertyId,
      documentId: extractionCandidatesTable.documentId,
      jobId: extractionCandidatesTable.jobId,
      extractionId: extractionCandidatesTable.extractionId,
      candidateType: extractionCandidatesTable.candidateType,
      status: extractionCandidatesTable.status,
      targetEntityType: extractionCandidatesTable.targetEntityType,
      targetEntityId: extractionCandidatesTable.targetEntityId,
      sourcePath: extractionCandidatesTable.sourcePath,
      payloadJson: extractionCandidatesTable.payloadJson,
      confidenceScore: extractionCandidatesTable.confidenceScore,
      reviewNotes: extractionCandidatesTable.reviewNotes,
      createdAt: extractionCandidatesTable.createdAt,
      updatedAt: extractionCandidatesTable.updatedAt,
      appliedAt: extractionCandidatesTable.appliedAt,
      appliedBy: extractionCandidatesTable.appliedBy,
    })
    .from(extractionCandidatesTable)
    .where(and(
      eq(extractionCandidatesTable.id, candidateId),
      eq(extractionCandidatesTable.tenantId, tenantId),
      eq(extractionCandidatesTable.propertyId, propertyId),
      eq(extractionCandidatesTable.documentId, documentId),
      eq(extractionCandidatesTable.jobId, jobId),
      eq(extractionCandidatesTable.extractionId, extractionId),
    ))
    .limit(1);

  if (!candidate) return err(c, 'Candidate nao encontrado apos revisao', 'CANDIDATE_REVIEW_WRITE_FAILED', 500);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'document_extraction_candidate',
    entityId: candidateId,
    action: 'document_extraction_candidate_reviewed',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: buildDocumentExtractionCandidateReviewAuditData({
      tenantId,
      propertyId,
      documentId,
      jobId,
      extractionId,
      candidateId,
      status: parsed.data.status,
    }),
  });

  return ok(c, { candidate: mapDocumentExtractionCandidateToContract(candidate) });
});

export default documents;
