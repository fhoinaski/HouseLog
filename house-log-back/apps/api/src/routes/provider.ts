import { Hono } from 'hono';
import { ok, err, paginate } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables, ServiceOrder } from '../lib/types';

const provider = new Hono<{ Bindings: Bindings; Variables: Variables }>();
provider.use('*', authMiddleware);

function requireProvider(role: string) {
  return role === 'provider' || role === 'admin';
}

// GET /provider/services
provider.get('/services', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!requireProvider(role)) return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);

  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const cursor = c.req.query('cursor');
  const status = c.req.query('status');

  const conditions = ['s.assigned_to = ?', 's.deleted_at IS NULL'];
  const bindings: unknown[] = [userId];

  if (status) { conditions.push('s.status = ?'); bindings.push(status); }
  if (cursor) { conditions.push('s.created_at < ?'); bindings.push(cursor); }
  bindings.push(limit + 1);

  const { results } = await c.env.DB.prepare(`
    SELECT s.*,
           u1.name as requested_by_name,
           r.name  as room_name,
           p.name  as property_name,
           p.address as property_address,
           p.id    as property_id
    FROM service_orders s
    JOIN users u1      ON u1.id = s.requested_by
    LEFT JOIN rooms r  ON r.id  = s.room_id
    JOIN properties p  ON p.id  = s.property_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE s.priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
      s.created_at DESC LIMIT ?
  `).bind(...bindings).all<ServiceOrder & {
    requested_by_name: string; room_name: string | null;
    property_name: string; property_address: string; property_id: string;
  }>();

  return ok(c, paginate(results, limit, 'created_at'));
});

// GET /provider/services/:id
provider.get('/services/:id', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  const { id } = c.req.param();
  if (!requireProvider(role)) return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);

  const order = await c.env.DB.prepare(`
    SELECT s.*,
           u1.name as requested_by_name,
           r.name  as room_name,
           p.name  as property_name,
           p.address as property_address,
           p.id    as property_id
    FROM service_orders s
    JOIN users u1      ON u1.id = s.requested_by
    LEFT JOIN rooms r  ON r.id  = s.room_id
    JOIN properties p  ON p.id  = s.property_id
    WHERE s.id = ? AND (s.assigned_to = ? OR ? = 'admin') AND s.deleted_at IS NULL
  `).bind(id, userId, role).first();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  // Fetch bids for this order submitted by this provider
  const { results: myBids } = await c.env.DB.prepare(
    `SELECT * FROM service_bids WHERE service_id = ? AND provider_id = ? ORDER BY created_at DESC`
  ).bind(id, userId).all();

  return ok(c, { order, my_bids: myBids });
});

// GET /provider/stats
provider.get('/stats', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  if (!requireProvider(role)) return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);

  const { results: statusCounts } = await c.env.DB.prepare(`
    SELECT status, COUNT(*) as count
    FROM service_orders
    WHERE assigned_to = ? AND deleted_at IS NULL
    GROUP BY status
  `).bind(userId).all<{ status: string; count: number }>();

  const stats = statusCounts.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {} as Record<string, number>);
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  const { results: recentBids } = await c.env.DB.prepare(`
    SELECT b.*, s.title as service_title, p.name as property_name
    FROM service_bids b
    JOIN service_orders s ON s.id = b.service_id
    JOIN properties p     ON p.id = s.property_id
    WHERE b.provider_id = ?
    ORDER BY b.created_at DESC LIMIT 5
  `).bind(userId).all();

  return ok(c, { stats, total, recent_bids: recentBids });
});

// POST /provider/services/:id/invoice — provider uploads nota fiscal
provider.post('/services/:id/invoice', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  const { id } = c.req.param();
  if (!requireProvider(role)) return err(c, 'Acesso restrito a prestadores', 'FORBIDDEN', 403);

  const order = await c.env.DB.prepare(`
    SELECT s.id, s.property_id
    FROM service_orders s
    WHERE s.id = ? AND (s.assigned_to = ? OR ? = 'admin') AND s.deleted_at IS NULL
  `).bind(id, userId, role).first<{ id: string; property_id: string }>();

  if (!order) return err(c, 'OS não encontrada ou sem acesso', 'NOT_FOUND', 404);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Arquivo não encontrado', 'MISSING_FILE');

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (!allowed.includes(file.type)) return err(c, 'Tipo de arquivo não permitido', 'INVALID_FILE', 422);
  if (file.size > 10 * 1024 * 1024) return err(c, 'Arquivo excede 10MB', 'INVALID_FILE', 422);

  const { buildR2Key, uploadToR2, getPublicUrl } = await import('../lib/r2');
  const key = buildR2Key({ propertyId: order.property_id, category: 'invoices', filename: file.name });
  const buffer = await file.arrayBuffer();
  await uploadToR2(c.env.STORAGE, key, buffer, file.type);
  const fileUrl = getPublicUrl(key, c.env.R2_PUBLIC_URL ?? '');

  // Create a document record linked to this service
  const { nanoid } = await import('nanoid');
  const docId = nanoid();
  await c.env.DB.prepare(`
    INSERT INTO documents (id, property_id, service_id, type, title, file_url, file_size, uploaded_by, created_at)
    VALUES (?, ?, ?, 'invoice', 'Nota Fiscal — ' || ?, ?, ?, ?, datetime('now'))
  `).bind(docId, order.property_id, id, id.slice(0, 8).toUpperCase(), fileUrl, file.size, userId).run();

  return ok(c, { invoice_url: fileUrl, document_id: docId });
});

export default provider;
