import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, isNull, lt } from 'drizzle-orm';
import { writeAuditLog } from '../lib/audit';
import { canDeleteDocument, canRequestDocumentOCR, canUploadDocument } from '../lib/authorization';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { validateUpload, buildR2Key, uploadToR2, getPublicUrl, extractR2KeyFromPublicUrl } from '../lib/r2';
import { getDb } from '../db/client';
import { documents as documentsTable, users } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

type Document = {
  id: string; property_id: string; service_id: string | null;
  type: string; title: string; file_url: string; file_size: number;
  ocr_data: string | null; vendor_cnpj: string | null; amount: number | null;
  issue_date: string | null; expiry_date: string | null;
  uploaded_by: string; created_at: string; deleted_at: string | null;
};

const documents = new Hono<{ Bindings: Bindings; Variables: Variables }>();
documents.use('*', authMiddleware);

const metaSchema = z.object({
  type: z.enum(['invoice', 'manual', 'project', 'contract', 'deed', 'permit', 'insurance', 'other']),
  title: z.string().min(1),
  service_id: z.string().optional(),
  vendor_cnpj: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
});

// ── GET /properties/:propertyId/documents ────────────────────────────────────

documents.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const type = c.req.query('type');

  const filters = [eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)];
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

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── POST /properties/:propertyId/documents — multipart upload ────────────────

documents.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canUploadDocument(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo obrigatório', 'MISSING_FILE');

  const validation = validateUpload(file.type, file.size);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const rawMeta = formData.get('meta') as string | null;
  const metaJson = rawMeta ? JSON.parse(rawMeta) : {};
  const parsed = metaSchema.safeParse(metaJson);
  if (!parsed.success) {
    return err(c, 'Metadados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const meta = parsed.data;
  const key = buildR2Key({ propertyId, category: 'documents', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);
  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  const id = nanoid();
  await db.insert(documentsTable).values({
    id,
    propertyId,
    serviceId: meta.service_id ?? null,
    type: meta.type,
    title: meta.title,
    fileUrl,
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
    .where(eq(documentsTable.id, id))
    .limit(1) as Document[];

  if (!doc) return err(c, 'Documento nao encontrado apos upload', 'DOCUMENT_UPLOAD_READ_FAILED', 500);

  await writeAuditLog(c.env.DB, {
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

  return ok(c, { document: doc }, 201);
});

// ── GET /properties/:propertyId/documents/:id ────────────────────────────────

documents.get('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
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
    .where(and(eq(documentsTable.id, id), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)))
    .limit(1);

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);
  return ok(c, { document: doc });
});

// ── DELETE /properties/:propertyId/documents/:id ─────────────────────────────

documents.delete('/:id', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const id = c.req.param('id')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canDeleteDocument(c.env.DB, { propertyId, userId, role });
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
    .where(and(eq(documentsTable.id, id), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)))
    .limit(1) as Document[];

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);

  await db
    .update(documentsTable)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(documentsTable.id, id));

  await writeAuditLog(c.env.DB, {
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

  const hasAccess = await canRequestDocumentOCR(c.env.DB, { propertyId, userId, role });
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
    .where(and(eq(documentsTable.id, id), eq(documentsTable.propertyId, propertyId), isNull(documentsTable.deletedAt)))
    .limit(1) as Document[];

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);
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
    .where(eq(documentsTable.id, id));

  await writeAuditLog(c.env.DB, {
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

export default documents;
