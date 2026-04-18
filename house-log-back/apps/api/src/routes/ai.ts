import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { err, ok } from '../lib/response';
import { classifyDocument, diagnoseImage, transcribeAudio } from '../lib/ai';
import type { Bindings, Variables } from '../lib/types';

const ai = new Hono<{ Bindings: Bindings; Variables: Variables }>();

ai.use('*', authMiddleware);

// POST /ai/diagnose — multipart com campo "image" (ou JSON {image_base64, context})
ai.post('/diagnose', async (c) => {
  const contentType = c.req.header('Content-Type') ?? '';
  let bytes: Uint8Array | null = null;
  let context: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const form = await c.req.formData();
    const file = form.get('image') as { size?: number; arrayBuffer?: () => Promise<ArrayBuffer> } | null;
    context = form.get('context')?.toString() || undefined;
    if (!file || typeof file.arrayBuffer !== 'function') {
      return err(c, 'Imagem obrigatória', 'VALIDATION_ERROR', 422);
    }
    if ((file.size ?? 0) > 8 * 1024 * 1024) return err(c, 'Imagem muito grande', 'PAYLOAD_TOO_LARGE', 422);
    bytes = new Uint8Array(await file.arrayBuffer());
  } else {
    const body = await c.req
      .json<{ image_base64?: string; context?: string }>()
      .catch(() => ({}) as { image_base64?: string; context?: string });
    context = body.context;
    if (!body.image_base64) return err(c, 'image_base64 obrigatório', 'VALIDATION_ERROR', 422);
    const bin = atob(body.image_base64.replace(/^data:image\/[a-z]+;base64,/, ''));
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  }

  try {
    const result = await diagnoseImage(c.env.AI, c.env.DB, bytes, context);
    return ok(c, result);
  } catch (e) {
    return err(c, 'Falha no diagnóstico', 'AI_ERROR', 503, { message: String(e) });
  }
});

// POST /ai/transcribe — multipart com "audio"
ai.post('/transcribe', async (c) => {
  const form = await c.req.formData().catch(() => null);
  if (!form) return err(c, 'multipart/form-data obrigatório', 'VALIDATION_ERROR', 422);
  const file = form.get('audio') as { size?: number; arrayBuffer?: () => Promise<ArrayBuffer> } | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return err(c, 'Áudio obrigatório', 'VALIDATION_ERROR', 422);
  }
  if ((file.size ?? 0) > 20 * 1024 * 1024) return err(c, 'Áudio muito grande', 'PAYLOAD_TOO_LARGE', 422);

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const result = await transcribeAudio(c.env.AI, c.env.DB, bytes);
    return ok(c, result);
  } catch (e) {
    return err(c, 'Falha na transcrição', 'AI_ERROR', 503, { message: String(e) });
  }
});

// POST /ai/classify-document — JSON { text }
ai.post('/classify-document', async (c) => {
  const body = await c.req
    .json<{ text?: string }>()
    .catch(() => ({}) as { text?: string });
  if (!body.text || body.text.length < 20) {
    return err(c, 'Texto muito curto', 'VALIDATION_ERROR', 422);
  }
  try {
    const result = await classifyDocument(c.env.AI, c.env.DB, body.text);
    return ok(c, result);
  } catch (e) {
    return err(c, 'Falha na classificação', 'AI_ERROR', 503, { message: String(e) });
  }
});

export default ai;
