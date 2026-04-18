import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { writeAuditLog } from '../lib/audit';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware, assertPropertyAccess, canUserOpenOS } from '../middleware/auth';
import { validateUpload, buildR2Key, uploadToR2, getPublicUrl } from '../lib/r2';
import { sendEmail, emailOsStatusChanged, emailServiceAssigned } from '../lib/email';
import type { Bindings, Variables, ServiceOrder } from '../lib/types';

const services = new Hono<{ Bindings: Bindings; Variables: Variables }>();

services.use('*', authMiddleware);

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  requested:   ['approved', 'bidding'],
  bidding:     ['approved', 'requested'],
  approved:    ['in_progress', 'requested'],
  in_progress: ['completed', 'approved'],
  completed:   ['verified', 'in_progress'],
  verified:    [],
};

const createSchema = z.object({
  title: z.string().min(1),
  system_type: z.enum(['electrical', 'plumbing', 'structural', 'waterproofing', 'painting', 'flooring', 'roofing', 'general']),
  description: z.string().optional(),
  room_id: z.string().optional(),
  priority: z.enum(['urgent', 'normal', 'preventive']).default('normal'),
  assigned_to: z.string().optional(),
  warranty_until: z.string().optional(),
  scheduled_at: z.string().optional(),
  checklist: z.array(z.object({ item: z.string(), done: z.boolean() })).optional(),
});

// ── GET /properties/:propertyId/services ─────────────────────────────────────

services.get('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const status = c.req.query('status');
  const priority = c.req.query('priority');

  const conditions = ['s.property_id = ?', 's.deleted_at IS NULL'];
  const bindings: unknown[] = [propertyId];

  if (status)   { conditions.push('s.status = ?');   bindings.push(status); }
  if (priority) { conditions.push('s.priority = ?'); bindings.push(priority); }
  if (cursor)   { conditions.push('s.created_at < ?'); bindings.push(cursor); }

  bindings.push(limit + 1);

  const { results } = await c.env.DB
    .prepare(
      `SELECT s.*,
              u1.name as requested_by_name,
              u2.name as assigned_to_name,
              r.name as room_name
       FROM service_orders s
       JOIN users u1 ON u1.id = s.requested_by
       LEFT JOIN users u2 ON u2.id = s.assigned_to
       LEFT JOIN rooms r ON r.id = s.room_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE s.priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
         s.created_at DESC LIMIT ?`
    )
    .bind(...bindings)
    .all<ServiceOrder & { requested_by_name: string; assigned_to_name: string | null; room_name: string | null }>();

  return ok(c, paginate(results, limit, 'created_at'));
});

// ── POST /properties/:propertyId/services ────────────────────────────────────

services.post('/', async (c) => {
  const propertyId = c.req.param('propertyId');
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const allowed = await canUserOpenOS(c.env.DB, propertyId, userId);
  if (!allowed) return err(c, 'Sem permissão para abrir OS neste imóvel', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const id = nanoid();
  const checklistJson = JSON.stringify(d.checklist ?? []);

  try {
    await c.env.DB
      .prepare(
        `INSERT INTO service_orders
         (id, property_id, room_id, system_type, requested_by, assigned_to,
          title, description, priority, status, warranty_until, scheduled_at, checklist, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, datetime('now'))`
      )
      .bind(
        id, propertyId, d.room_id ?? null, d.system_type, userId,
        d.assigned_to ?? null, d.title, d.description ?? null,
        d.priority, d.warranty_until ?? null,
        d.scheduled_at ?? null, checklistJson
      )
      .run();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('FOREIGN KEY')) {
      return err(c, 'Cômodo ou prestador não encontrado', 'REFERENCE_NOT_FOUND', 422);
    }
    throw e;
  }

  const order = await c.env.DB
    .prepare('SELECT * FROM service_orders WHERE id = ?')
    .bind(id)
    .first<ServiceOrder>();

  // Notify assigned provider (non-blocking)
  void (async () => {
    try {
      if (!d.assigned_to || !c.env.RESEND_API_KEY) return;

      const provider = await c.env.DB
        .prepare('SELECT name, email FROM users WHERE id = ?')
        .bind(d.assigned_to)
        .first<{ name: string; email: string }>();

      const property = await c.env.DB
        .prepare('SELECT name FROM properties WHERE id = ?')
        .bind(propertyId)
        .first<{ name: string }>();

      if (!provider?.email) return;

      const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';
      await sendEmail(c.env.RESEND_API_KEY, {
        to: provider.email,
        subject: `Nova OS atribuída: ${d.title}`,
        html: emailServiceAssigned({
          providerName: provider.name,
          orderTitle: d.title,
          propertyName: property?.name ?? 'Imóvel',
          priorityLabel: d.priority,
          scheduledAt: d.scheduled_at,
          serviceUrl: `${appUrl}/provider/services/${id}`,
          appUrl,
        }),
      });
    } catch (e) {
      console.error('Assigned provider notification failed:', e);
    }
  })();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: 'create',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), newData: order,
  });

  return ok(c, { order }, 201);
});

// ── GET /properties/:propertyId/services/:id ─────────────────────────────────

services.get('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const order = await c.env.DB
    .prepare(
      `SELECT s.*, u1.name as requested_by_name, u2.name as assigned_to_name, r.name as room_name
       FROM service_orders s
       JOIN users u1 ON u1.id = s.requested_by
       LEFT JOIN users u2 ON u2.id = s.assigned_to
       LEFT JOIN rooms r ON r.id = s.room_id
       WHERE s.id = ? AND s.property_id = ? AND s.deleted_at IS NULL`
    )
    .bind(id, propertyId)
    .first();

  if (!order) return err(c, 'Ordem de serviço não encontrada', 'NOT_FOUND', 404);

  return ok(c, { order });
});

// ── PUT /properties/:propertyId/services/:id ─────────────────────────────────

services.put('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<ServiceOrder>();

  if (!old) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const d = parsed.data;
  const pairs: [string, unknown][] = [];

  if (d.title !== undefined)        pairs.push(['title', d.title]);
  if (d.description !== undefined)  pairs.push(['description', d.description]);
  if (d.system_type !== undefined)  pairs.push(['system_type', d.system_type]);
  if (d.room_id !== undefined)      pairs.push(['room_id', d.room_id]);
  if (d.priority !== undefined)     pairs.push(['priority', d.priority]);
  if (d.assigned_to !== undefined)  pairs.push(['assigned_to', d.assigned_to]);
  if (d.warranty_until !== undefined) pairs.push(['warranty_until', d.warranty_until]);
  if (d.scheduled_at !== undefined) pairs.push(['scheduled_at', d.scheduled_at]);
  if (d.checklist !== undefined)    pairs.push(['checklist', JSON.stringify(d.checklist)]);

  if (pairs.length === 0) return err(c, 'Nenhum campo para atualizar', 'NO_CHANGES');

  await c.env.DB
    .prepare(`UPDATE service_orders SET ${pairs.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...pairs.map(([, v]) => v), id)
    .run();

  const updated = await c.env.DB
    .prepare('SELECT * FROM service_orders WHERE id = ?')
    .bind(id)
    .first<ServiceOrder>();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: 'update',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: old, newData: updated,
  });

  return ok(c, { order: updated });
});

// ── PATCH /properties/:propertyId/services/:id/status ────────────────────────

services.patch('/:id/status', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json<{ status: string }>().catch(() => null);
  if (!body?.status) return err(c, 'Status inválido', 'INVALID_BODY');

  const order = await c.env.DB
    .prepare('SELECT * FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<ServiceOrder>();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const allowed = STATUS_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(body.status)) {
    return err(
      c,
      `Transição inválida: ${order.status} → ${body.status}`,
      'INVALID_TRANSITION',
      422
    );
  }

  // Rule: completing requires at least 1 after photo
  if (body.status === 'completed') {
    const afterPhotos = JSON.parse(order.after_photos || '[]') as string[];
    if (afterPhotos.length === 0) {
      return err(c, 'OS requer ao menos 1 foto "depois" para ser concluída', 'MISSING_AFTER_PHOTO', 422);
    }
  }

  const extra: Record<string, string> = {};
  if (body.status === 'completed') extra.completed_at = "datetime('now')";

  const setClause = [
    'status = ?',
    ...Object.keys(extra).map((k) => `${k} = ${extra[k]}`),
  ].join(', ');

  await c.env.DB
    .prepare(`UPDATE service_orders SET ${setClause} WHERE id = ?`)
    .bind(body.status, id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: `status_${body.status}`,
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'),
    oldData: { status: order.status }, newData: { status: body.status },
  });

  const updated = await c.env.DB
    .prepare('SELECT * FROM service_orders WHERE id = ?')
    .bind(id)
    .first<ServiceOrder>();

  // Send email notification to requester (non-blocking)
  void (async () => {
    try {
      const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';
      const requester = await c.env.DB
        .prepare(`SELECT u.email, u.name, u.notification_prefs, p.name as property_name
                  FROM users u JOIN properties p ON p.id = ?
                  WHERE u.id = ?`)
        .bind(propertyId, order.requested_by)
        .first<{ email: string; name: string; notification_prefs: string; property_name: string }>();

      if (requester && c.env.RESEND_API_KEY) {
        const prefs = JSON.parse(requester.notification_prefs || '{}') as Record<string, boolean>;
        if (prefs.os_status !== false) {
          await sendEmail(c.env.RESEND_API_KEY, {
            to: requester.email,
            subject: `OS "${order.title}" → ${body.status}`,
            html: emailOsStatusChanged({
              recipientName: requester.name,
              orderTitle: order.title,
              oldStatus: order.status,
              newStatus: body.status,
              propertyName: requester.property_name,
              appUrl,
              serviceUrl: `${appUrl}/properties/${propertyId}/services/${id}`,
            }),
          });
        }
      }
    } catch (e) {
      console.error('OS status email failed:', e);
    }
  })();

  return ok(c, { order: updated });
});

// ── POST /properties/:propertyId/services/:id/photos ─────────────────────────

services.post('/:id/photos', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const order = await c.env.DB
    .prepare('SELECT * FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<ServiceOrder>();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const photoType = (formData.get('type') as string) === 'after' ? 'after' : 'before';
  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const validation = validateUpload(file.type, file.size);
  if (!validation.ok) return err(c, validation.error, 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'photos', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);

  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  const field = photoType === 'after' ? 'after_photos' : 'before_photos';
  const current = JSON.parse(order[field] || '[]') as string[];
  current.push(fileUrl);

  await c.env.DB
    .prepare(`UPDATE service_orders SET ${field} = ? WHERE id = ?`)
    .bind(JSON.stringify(current), id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: `photo_upload_${photoType}`,
    actorId: userId, newData: { url: fileUrl },
  });

  return ok(c, { url: fileUrl, type: photoType });
});

// ── POST /properties/:propertyId/services/:id/video ──────────────────────────

services.post('/:id/video', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const order = await c.env.DB
    .prepare('SELECT id FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  if (file.type !== 'video/mp4') return err(c, 'Apenas vídeos MP4 são aceitos', 'INVALID_FILE', 422);
  if (file.size > 50 * 1024 * 1024) return err(c, 'Vídeo excede 50MB', 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'videos', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, 'video/mp4');

  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  await c.env.DB
    .prepare('UPDATE service_orders SET video_url = ? WHERE id = ?')
    .bind(fileUrl, id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: 'video_upload',
    actorId: userId, newData: { video_url: fileUrl },
  });

  return ok(c, { video_url: fileUrl });
});

// ── POST /properties/:propertyId/services/:id/audio ──────────────────────────

services.post('/:id/audio', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const order = await c.env.DB
    .prepare('SELECT id FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const allowed = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm']);
  if (!allowed.has(file.type)) return err(c, 'Tipo de áudio não permitido', 'INVALID_FILE', 422);
  if (file.size > 20 * 1024 * 1024) return err(c, 'Áudio excede 20MB', 'INVALID_FILE', 422);

  const key = buildR2Key({ propertyId, category: 'documents', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);

  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  await c.env.DB
    .prepare('UPDATE service_orders SET audio_url = ? WHERE id = ?')
    .bind(fileUrl, id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: 'audio_upload',
    actorId: userId, newData: { audio_url: fileUrl },
  });

  return ok(c, { audio_url: fileUrl });
});

// ── DELETE /properties/:propertyId/services/:id ──────────────────────────────

services.delete('/:id', async (c) => {
  const propertyId = c.req.param('propertyId');
  const { id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const old = await c.env.DB
    .prepare('SELECT * FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<ServiceOrder>();

  if (!old) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  await c.env.DB
    .prepare(`UPDATE service_orders SET deleted_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();

  await writeAuditLog(c.env.DB, {
    entityType: 'service_order', entityId: id, action: 'delete',
    actorId: userId, actorIp: c.req.header('CF-Connecting-IP'), oldData: old,
  });

  return ok(c, { success: true });
});

// ── PATCH /properties/:propertyId/services/:id/checklist ─────────────────────

services.patch('/:id/checklist', async (c) => {
  const { propertyId, id } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json<{ checklist: { item: string; done: boolean }[] }>().catch(() => null);
  if (!body?.checklist || !Array.isArray(body.checklist)) {
    return err(c, 'Checklist inválido', 'INVALID_BODY');
  }

  const order = await c.env.DB
    .prepare('SELECT id FROM service_orders WHERE id = ? AND property_id = ? AND deleted_at IS NULL')
    .bind(id, propertyId)
    .first<{ id: string }>();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const sanitized = body.checklist.map((item) => ({
    item: String(item.item ?? '').slice(0, 200),
    done: Boolean(item.done),
  }));

  await c.env.DB
    .prepare(`UPDATE service_orders SET checklist = ? WHERE id = ?`)
    .bind(JSON.stringify(sanitized), id)
    .run();

  return ok(c, { checklist: sanitized });
});

export default services;
