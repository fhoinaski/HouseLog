import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { writeAuditLog } from '../lib/audit';
import { canSubmitProviderProposal } from '../lib/authorization';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { getDb } from '../db/client';
import { properties, serviceBids, serviceOrders, users } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const bids = new Hono<{ Bindings: Bindings; Variables: Variables }>();
bids.use('*', authMiddleware);

const bidSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  notes: z.string().max(500).optional(),
});

// GET /properties/:propertyId/services/:serviceId/bids
bids.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const serviceId = c.req.param('serviceId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .select({
      id: serviceBids.id,
      service_id: serviceBids.serviceId,
      provider_id: serviceBids.providerId,
      amount: serviceBids.amount,
      notes: serviceBids.notes,
      status: serviceBids.status,
      created_at: serviceBids.createdAt,
      updated_at: serviceBids.updatedAt,
      provider_name: users.name,
      provider_email: users.email,
      provider_phone: users.phone,
    })
    .from(serviceBids)
    .innerJoin(users, eq(users.id, serviceBids.providerId))
    .where(eq(serviceBids.serviceId, serviceId))
    .orderBy(desc(serviceBids.createdAt));

  return ok(c, { bids: results });
});

// POST /properties/:propertyId/services/:serviceId/bids
bids.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const serviceId = c.req.param('serviceId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  if (!canSubmitProviderProposal({ userId, role, propertyId, serviceOrderId: serviceId })) {
    return err(c, 'Apenas prestadores podem enviar orçamentos', 'FORBIDDEN', 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = bidSchema.safeParse(body);
  if (!parsed.success) {
    return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  }

  const [order] = await db
    .select({
      id: serviceOrders.id,
      title: serviceOrders.title,
      status: serviceOrders.status,
      assigned_to: serviceOrders.assignedTo,
      requested_by: serviceOrders.requestedBy,
      property_name: properties.name,
      owner_id: properties.ownerId,
    })
    .from(serviceOrders)
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(and(eq(serviceOrders.id, serviceId), eq(serviceOrders.propertyId, propertyId), sql`${serviceOrders.deletedAt} IS NULL`))
    .limit(1) as Array<{
    id: string;
    title: string;
    status: string;
    assigned_to: string | null;
    requested_by: string;
    property_name: string;
    owner_id: string;
  }>;

  if (!order) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);

  if (order.assigned_to) {
    return err(c, 'Esta OS é de execução direta e não aceita orçamentos', 'DIRECT_EXECUTION', 409);
  }

  if (order.status !== 'requested') {
    return err(c, 'Esta OS não está aberta para orçamento', 'BIDDING_CLOSED', 409);
  }

  const [existing] = await db
    .select({ id: serviceBids.id })
    .from(serviceBids)
    .where(and(eq(serviceBids.serviceId, serviceId), eq(serviceBids.providerId, userId), eq(serviceBids.status, 'pending')))
    .limit(1);
  if (existing) return err(c, 'Já existe um orçamento pendente seu para esta OS', 'DUPLICATE_BID', 409);

  const id = nanoid();
  await db.insert(serviceBids).values({
    id,
    serviceId,
    providerId: userId,
    amount: parsed.data.amount,
    notes: parsed.data.notes ?? null,
  });

  await writeAuditLog(c.env.DB, {
    entityType: 'service_bid',
    entityId: id,
    action: 'provider_proposal_submitted',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      service_order_id: serviceId,
      provider_id: userId,
      proposal_id: id,
      amount: parsed.data.amount,
      status: 'pending',
      actor_id: userId,
      actor_role: role,
    },
  });

  // Notify owner (non-blocking)
  void (async () => {
    try {
      if (!c.env.RESEND_API_KEY) return;
      const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';
      const [provider, owner] = await Promise.all([
        db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1).then((r) => r[0]),
        db
          .select({ email: users.email, name: users.name, notification_prefs: users.notificationPrefs })
          .from(users)
          .where(eq(users.id, order.owner_id))
          .limit(1)
          .then((r) => r[0] as { email: string; name: string; notification_prefs: string }),
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

  const [bid] = await db
    .select({
      id: serviceBids.id,
      service_id: serviceBids.serviceId,
      provider_id: serviceBids.providerId,
      amount: serviceBids.amount,
      notes: serviceBids.notes,
      status: serviceBids.status,
      created_at: serviceBids.createdAt,
      updated_at: serviceBids.updatedAt,
      provider_name: users.name,
    })
    .from(serviceBids)
    .innerJoin(users, eq(users.id, serviceBids.providerId))
    .where(eq(serviceBids.id, id))
    .limit(1);

  return ok(c, { bid }, 201);
});

// PATCH /properties/:propertyId/services/:serviceId/bids/:bidId/status
bids.patch('/:bidId/status', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const serviceId = c.req.param('serviceId')!;
  const bidId = c.req.param('bidId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await assertPropertyAccess(c.env.DB, propertyId, userId, role);
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json<{ status: string }>().catch(() => null);
  if (!body?.status || !['accepted', 'rejected'].includes(body.status)) {
    return err(c, 'Status deve ser accepted ou rejected', 'INVALID_BODY');
  }

  const [bid] = await db
    .select({
      id: serviceBids.id,
      provider_id: serviceBids.providerId,
      amount: serviceBids.amount,
      status: serviceBids.status,
    })
    .from(serviceBids)
    .where(and(eq(serviceBids.id, bidId), eq(serviceBids.serviceId, serviceId)))
    .limit(1) as Array<{ id: string; provider_id: string; amount: number; status: string }>;

  if (!bid) return err(c, 'Orçamento não encontrado', 'NOT_FOUND', 404);
  if (bid.status !== 'pending') return err(c, 'Orçamento já foi processado', 'ALREADY_PROCESSED', 409);

  await db
    .update(serviceBids)
    .set({ status: body.status as 'accepted' | 'rejected', updatedAt: new Date().toISOString() })
    .where(eq(serviceBids.id, bidId));

  if (body.status === 'accepted') {
    await db
      .update(serviceOrders)
      .set({ assignedTo: bid.provider_id, cost: bid.amount, status: 'approved' })
      .where(eq(serviceOrders.id, serviceId));
    await db.run(sql`UPDATE service_bids SET status = 'rejected', updated_at = datetime('now') WHERE service_id = ${serviceId} AND id != ${bidId} AND status = 'pending'`);
  }

  return ok(c, { success: true, status: body.status });
});

export default bids;
