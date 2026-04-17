import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ok, err } from '../lib/response';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';

const bids = new Hono<{ Bindings: Bindings; Variables: Variables }>();
bids.use('*', authMiddleware);

const bidSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  notes: z.string().max(500).optional(),
});

// GET /properties/:propertyId/services/:serviceId/bids
bids.get('/', async (c) => {
  const { propertyId, serviceId } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { results } = await c.env.DB.prepare(`
    SELECT b.*, u.name as provider_name, u.email as provider_email, u.phone as provider_phone
    FROM service_bids b
    JOIN users u ON u.id = b.provider_id
    WHERE b.service_id = ?
    ORDER BY b.created_at DESC
  `).bind(serviceId).all();

  return ok(c, { bids: results });
});

// POST /properties/:propertyId/services/:serviceId/bids
bids.post('/', async (c) => {
  const { propertyId, serviceId } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  if (role !== 'provider' && role !== 'admin') {
    return err(c, 'Apenas prestadores podem enviar orçamentos', 'FORBIDDEN', 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = bidSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const order = await c.env.DB.prepare(`
    SELECT s.id, s.title, s.requested_by, p.name as property_name, p.owner_id
    FROM service_orders s JOIN properties p ON p.id = s.property_id
    WHERE s.id = ? AND s.property_id = ? AND s.deleted_at IS NULL
  `).bind(serviceId, propertyId).first<{
    id: string; title: string; requested_by: string; property_name: string; owner_id: string;
  }>();

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  const existing = await c.env.DB.prepare(
    `SELECT id FROM service_bids WHERE service_id = ? AND provider_id = ? AND status = 'pending'`
  ).bind(serviceId, userId).first();
  if (existing) return err(c, 'Já existe um orçamento pendente seu para esta OS', 'DUPLICATE_BID', 409);

  const id = nanoid();
  await c.env.DB.prepare(
    `INSERT INTO service_bids (id, service_id, provider_id, amount, notes) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, serviceId, userId, parsed.data.amount, parsed.data.notes ?? null).run();

  // Auto-transition OS to 'bidding' when first bid arrives
  await c.env.DB.prepare(
    `UPDATE service_orders SET status = 'bidding' WHERE id = ? AND status = 'requested'`
  ).bind(serviceId).run();

  // Notify owner (non-blocking)
  void (async () => {
    try {
      if (!c.env.RESEND_API_KEY) return;
      const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';
      const [provider, owner] = await Promise.all([
        c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{ name: string }>(),
        c.env.DB.prepare('SELECT email, name, notification_prefs FROM users WHERE id = ?')
          .bind(order.owner_id).first<{ email: string; name: string; notification_prefs: string }>(),
      ]);
      if (owner) {
        const prefs = JSON.parse(owner.notification_prefs || '{}') as Record<string, boolean>;
        if (prefs.new_bid !== false) {
          const { sendEmail, emailNewBid } = await import('../lib/email');
          await sendEmail(c.env.RESEND_API_KEY, {
            to: owner.email,
            subject: `Novo orçamento para "${order.title}"`,
            html: emailNewBid({
              ownerName: owner.name,
              providerName: provider?.name ?? 'Prestador',
              orderTitle: order.title,
              amount: parsed.data.amount,
              notes: parsed.data.notes ?? '',
              propertyName: order.property_name,
              serviceUrl: `${appUrl}/properties/${propertyId}/services/${serviceId}`,
              appUrl,
            }),
          });
        }
      }
    } catch (e) {
      console.error('Bid email failed:', e);
    }
  })();

  const bid = await c.env.DB.prepare(
    `SELECT b.*, u.name as provider_name FROM service_bids b JOIN users u ON u.id = b.provider_id WHERE b.id = ?`
  ).bind(id).first();

  return ok(c, { bid }, 201);
});

// PATCH /properties/:propertyId/services/:serviceId/bids/:bidId/status
bids.patch('/:bidId/status', async (c) => {
  const { propertyId, serviceId, bidId } = c.req.param();
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json<{ status: string }>().catch(() => null);
  if (!body?.status || !['accepted', 'rejected'].includes(body.status)) {
    return err(c, 'Status deve ser accepted ou rejected', 'INVALID_BODY');
  }

  const bid = await c.env.DB.prepare(
    `SELECT * FROM service_bids WHERE id = ? AND service_id = ?`
  ).bind(bidId, serviceId).first<{ id: string; provider_id: string; amount: number; status: string }>();

  if (!bid) return err(c, 'Orçamento não encontrado', 'NOT_FOUND', 404);
  if (bid.status !== 'pending') return err(c, 'Orçamento já foi processado', 'ALREADY_PROCESSED', 409);

  await c.env.DB.prepare(
    `UPDATE service_bids SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(body.status, bidId).run();

  if (body.status === 'accepted') {
    await c.env.DB.prepare(
      `UPDATE service_orders SET assigned_to = ?, cost = ?, status = 'approved' WHERE id = ?`
    ).bind(bid.provider_id, bid.amount, serviceId).run();
    await c.env.DB.prepare(
      `UPDATE service_bids SET status = 'rejected', updated_at = datetime('now') WHERE service_id = ? AND id != ? AND status = 'pending'`
    ).bind(serviceId, bidId).run();
  }

  // If rejected, check if no more pending bids → revert OS to 'requested'
  if (body.status === 'rejected') {
    const { results: remaining } = await c.env.DB.prepare(
      `SELECT id FROM service_bids WHERE service_id = ? AND status = 'pending'`
    ).bind(serviceId).all();
    if (remaining.length === 0) {
      await c.env.DB.prepare(
        `UPDATE service_orders SET status = 'requested' WHERE id = ? AND status = 'bidding'`
      ).bind(serviceId).run();
    }
  }

  return ok(c, { success: true, status: body.status });
});

export default bids;
