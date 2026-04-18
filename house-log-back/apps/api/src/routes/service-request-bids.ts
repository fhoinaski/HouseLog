import { Hono } from 'hono';
import { and, eq, ne, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { authMiddleware, requireRole } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';
import { getDb } from '../db/client';
import { bids, properties, serviceRequests, users } from '../db/schema';

const serviceRequestBids = new Hono<{ Bindings: Bindings; Variables: Variables }>();

serviceRequestBids.use('*', authMiddleware, requireRole('owner'));

serviceRequestBids.patch('/:bidId/accept', async (c) => {
  const propertyId = c.req.param('propertyId');
  const serviceRequestId = c.req.param('serviceRequestId');
  const bidId = c.req.param('bidId');
  const ownerId = c.get('userId');

  if (!propertyId || !serviceRequestId || !bidId) {
    return err(c, 'Parametros obrigatorios ausentes', 'INVALID_PARAMS', 422);
  }

  const db = getDb(c.env.DB);

  try {
    const [property] = await db
      .select({
        id: properties.id,
        ownerId: properties.ownerId,
        propertyName: properties.name,
        propertyAddress: properties.address,
      })
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.ownerId, ownerId)))
      .limit(1);

    if (!property) {
      return err(c, 'Sem permissao para aceitar orcamentos deste imovel', 'FORBIDDEN', 403);
    }

    const [requestRow] = await db
      .select({
        id: serviceRequests.id,
        propertyId: serviceRequests.propertyId,
      })
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.id, serviceRequestId),
          eq(serviceRequests.propertyId, propertyId)
        )
      )
      .limit(1);

    if (!requestRow) {
      return err(c, 'Solicitacao de servico nao encontrada', 'SERVICE_REQUEST_NOT_FOUND', 404);
    }

    const [owner] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1);

    const [targetBid] = await db
      .select({
        id: bids.id,
        serviceRequestId: bids.serviceRequestId,
        providerId: bids.providerId,
        amount: bids.amount,
        scope: bids.scope,
        status: bids.status,
        providerName: users.name,
        providerEmail: users.email,
      })
      .from(bids)
      .innerJoin(users, eq(users.id, bids.providerId))
      .where(and(eq(bids.id, bidId), eq(bids.serviceRequestId, serviceRequestId)))
      .limit(1);

    if (!targetBid) {
      return err(c, 'Orcamento nao encontrado para esta solicitacao', 'BID_NOT_FOUND', 404);
    }

    if (targetBid.status === 'ACCEPTED') {
      return err(c, 'Orcamento ja foi aceito', 'BID_ALREADY_ACCEPTED', 409);
    }

    const now = new Date().toISOString();

    await db
      .update(bids)
      .set({ status: 'ACCEPTED', updatedAt: now })
      .where(and(eq(bids.id, bidId), eq(bids.serviceRequestId, serviceRequestId)));

    await db
      .update(bids)
      .set({ status: 'REJECTED', updatedAt: now })
      .where(
        and(
          eq(bids.serviceRequestId, serviceRequestId),
          ne(bids.id, bidId)
        )
      );

    const [acceptedBid] = await db
      .select({
        id: bids.id,
        serviceRequestId: bids.serviceRequestId,
        providerId: bids.providerId,
        amount: bids.amount,
        scope: bids.scope,
        status: bids.status,
        updatedAt: bids.updatedAt,
      })
      .from(bids)
      .where(eq(bids.id, bidId))
      .limit(1);

    const [rejectedSummary] = await db
      .select({
        totalRejected: sql<number>`count(*)`,
      })
      .from(bids)
      .where(
        and(
          eq(bids.serviceRequestId, serviceRequestId),
          eq(bids.status, 'REJECTED')
        )
      );

    const providerConfidentialPayload = {
      providerId: targetBid.providerId,
      providerName: targetBid.providerName,
      providerEmail: targetBid.providerEmail,
      ownerConfidential: {
        ownerName: owner?.name ?? null,
        propertyName: property.propertyName ?? null,
        propertyAddress: property.propertyAddress ?? null,
      },
    };

    return ok(c, {
      accepted_bid: acceptedBid,
      rejected_bids_count: Number(rejectedSummary?.totalRejected ?? 0),
      provider_confidential_payload: providerConfidentialPayload,
    });
  } catch (e) {
    console.error('accept bid failed:', e);
    return err(c, 'Falha ao aceitar orcamento', 'ACCEPT_BID_FAILED', 500);
  }
});

export default serviceRequestBids;
