import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { validateUpload, buildR2Key, uploadToR2, getPublicUrl } from '../lib/r2';
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
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const type = c.req.query('type');

  const conditions = ['d.property_id = ?', 'd.deleted_at IS NULL'];
  const bindings: unknown[] = [propertyId];
  if (type   && type   !== 'undefined') { conditions.push('d.type = ?');        bindings.push(type); }
  if (cursor)                           { conditions.push('d.created_at < ?');  bindings.push(cursor); }
  bindings.push(limit + 1);

  const { results } = await c.env.DB
    .prepare(
      `SELECT d.*, u.name as uploader_name FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.created_at DESC LIMIT ?`
    )
    .bind(...bindings)
    .all<Document & { uploader_name: string }>();

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── POST /properties/:propertyId/documents — multipart upload ────────────────

documents.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
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
  await c.env.DB
    .prepare(
      `INSERT INTO documents
       (id, property_id, service_id, type, title, file_url, file_size,
        vendor_cnpj, amount, issue_date, expiry_date, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id, propertyId, meta.service_id ?? null, meta.type, meta.title,
      fileUrl, file.size, meta.vendor_cnpj ?? null, meta.amount ?? null,
      meta.issue_date ?? null, meta.expiry_date ?? null, userId
    )
    .run();

  const doc = await c.env.DB
    .prepare('SELECT * FROM documents WHERE id = ?')
    .bind(id)
    .first<Document>();

  await writeAuditLog(c.env.DB, {
    entityType: 'document', entityId: id, action: 'upload',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), newData: doc,
  });

  return ok(c, { document: doc }, 201);
});

// ── GET /properties/:propertyId/documents/:id ────────────────────────────────

documents.get('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const doc = await c.env.DB
    .prepare(
      `SELECT d.*, u.name as uploader_name FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       WHERE d.id = ? AND d.property_id = ? AND d.deleted_at IS NULL`
    )
    .bind(id, propertyId)
    .first();

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);
  return ok(c, { document: doc });
});

// ── DELETE /properties/:propertyId/documents/:id ─────────────────────────────

documents.delete('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const doc = await c.env.DB
    .prepare('SELECT * FROM documents WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<Document>();

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);

  await c.env.DB
    .prepare(`UPDATE documents SET deleted_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'document', entityId: id, action: 'delete',
    actorId: userId, oldData: doc,
  });

  return ok(c, { success: true });
});

// ── POST /properties/:propertyId/documents/:id/ocr ───────────────────────────

documents.post('/:id/ocr', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const doc = await c.env.DB
    .prepare('SELECT * FROM documents WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<Document>();

  if (!doc) return err(c, 'Documento não encontrado', 'NOT_FOUND', 404);
  if (doc.type !== 'invoice') return err(c, 'OCR disponível apenas para notas fiscais', 'INVALID_TYPE', 422);

  // Fetch the file from R2 to send to Workers AI
  const key = doc.file_url.split('/').slice(-3).join('/'); // extract key from URL
  const r2Object = await c.env.STORAGE.get(key);
  if (!r2Object) return err(c, 'Arquivo não encontrado no storage', 'STORAGE_ERROR', 404);

  const fileBytes = await r2Object.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBytes)));

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
  const updates: string[] = ['ocr_data = ?'];
  const vals: unknown[] = [JSON.stringify(ocrResult)];

  if (ocrResult.vendor_cnpj) { updates.push('vendor_cnpj = ?'); vals.push(ocrResult.vendor_cnpj); }
  if (ocrResult.amount)      { updates.push('amount = ?');       vals.push(Number(ocrResult.amount)); }
  if (ocrResult.issue_date)  { updates.push('issue_date = ?');   vals.push(ocrResult.issue_date); }

  await c.env.DB
    .prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...vals, id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'document', entityId: id, action: 'ocr',
    actorId: userId, newData: ocrResult,
  });

  return ok(c, { ocr_data: ocrResult });
});

export default documents;
