// Chat por OS: service_messages.
// Visibilidade:
//  - participantes da OS: owner/manager da property, assigned_to (provider), requested_by.
//  - internal=1: escondido do provider.
//
// Envio de push ao outro lado quando nova mensagem.

import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import {
  canAccessProperty,
  canSendInternalServiceMessage,
  canSendServiceMessage,
  canViewInternalServiceMessages,
  canViewServiceMessages,
  type ServiceMessageAuthorizationInput,
} from '../lib/authorization';
import { err, ok } from '../lib/response';
import { getDb } from '../db/client';
import { properties, serviceBids, serviceMessages, serviceOrders, users } from '../db/schema';
import type { Bindings, Variables, QueueMessage } from '../lib/types';

const messages = new Hono<{ Bindings: Bindings; Variables: Variables }>();
messages.use('*', authMiddleware);

type Participants = {
  propertyId: string;
  ownerId: string;
  managerId: string | null;
  assignedTo: string | null;
  requestedBy: string;
};

async function loadParticipants(
  db: ReturnType<typeof getDb>,
  serviceOrderId: string
): Promise<Participants | null> {
  const [row] = await db
    .select({
      property_id: serviceOrders.propertyId,
      assigned_to: serviceOrders.assignedTo,
      requested_by: serviceOrders.requestedBy,
      owner_id: properties.ownerId,
      manager_id: properties.managerId,
    })
    .from(serviceOrders)
    .innerJoin(properties, eq(properties.id, serviceOrders.propertyId))
    .where(and(eq(serviceOrders.id, serviceOrderId), isNull(serviceOrders.deletedAt)))
    .limit(1);
  if (!row) return null;
  return {
    propertyId: row.property_id,
    ownerId: row.owner_id,
    managerId: row.manager_id,
    assignedTo: row.assigned_to,
    requestedBy: row.requested_by,
  };
}

function toMessageAuthorizationInput(
  p: Participants,
  userId: string,
  role: Variables['userRole'],
  extras: Pick<ServiceMessageAuthorizationInput, 'hasActiveProviderBid' | 'hasPropertyAccess'> = {}
): ServiceMessageAuthorizationInput {
  return {
    userId,
    role,
    propertyOwnerId: p.ownerId,
    propertyManagerId: p.managerId,
    requestedById: p.requestedBy,
    assignedProviderId: p.assignedTo,
    ...extras,
  };
}

async function hasActiveBidAccess(
  db: ReturnType<typeof getDb>,
  serviceOrderId: string,
  userId: string
): Promise<boolean> {
  const [bid] = await db
    .select({ id: serviceBids.id })
    .from(serviceBids)
    .where(
      and(
        eq(serviceBids.serviceId, serviceOrderId),
        eq(serviceBids.providerId, userId),
        sql`${serviceBids.status} IN ('pending', 'accepted')`
      )
    )
    .limit(1);
  return !!bid;
}

// GET /services/:serviceOrderId/messages
messages.get('/:serviceOrderId/messages', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  const soId = c.req.param('serviceOrderId')!;

  const p = await loadParticipants(db, soId);
  if (!p) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);
  let authInput = toMessageAuthorizationInput(p, userId, role);
  if (!canViewServiceMessages(authInput)) {
    const hasActiveProviderBid = role === 'provider' ? await hasActiveBidAccess(db, soId, userId) : false;
    authInput = toMessageAuthorizationInput(p, userId, role, { hasActiveProviderBid });
    if (!canViewServiceMessages(authInput)) {
      const hasPropertyAccess = await canAccessProperty(c.env.DB, { propertyId: p.propertyId, userId, role });
      authInput = toMessageAuthorizationInput(p, userId, role, { hasActiveProviderBid, hasPropertyAccess });
      if (!canViewServiceMessages(authInput)) return err(c, 'Sem acesso', 'FORBIDDEN', 403);
    }
  }

  const canSeeInternal = canViewInternalServiceMessages(authInput);
  const rows = await db
    .select({
      id: serviceMessages.id,
      author_id: serviceMessages.authorId,
      author_name: users.name,
      body: serviceMessages.body,
      internal: serviceMessages.internal,
      attachments: serviceMessages.attachments,
      created_at: serviceMessages.createdAt,
    })
    .from(serviceMessages)
    .innerJoin(users, eq(users.id, serviceMessages.authorId))
    .where(
      and(
        eq(serviceMessages.serviceOrderId, soId),
        isNull(serviceMessages.deletedAt),
        canSeeInternal ? sql`1=1` : eq(serviceMessages.internal, 0)
      )
    )
    .orderBy(asc(serviceMessages.createdAt))
    .limit(500);
  return ok(c, { data: rows });
});

const createSchema = z.object({
  body: z.string().min(1).max(4000),
  internal: z.boolean().default(false),
  attachments: z.array(z.string().url()).max(8).default([]),
});

// POST /services/:serviceOrderId/messages
messages.post('/:serviceOrderId/messages', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const role = c.get('userRole');
  const soId = c.req.param('serviceOrderId')!;

  const p = await loadParticipants(db, soId);
  if (!p) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);
  let authInput = toMessageAuthorizationInput(p, userId, role);
  if (!canSendServiceMessage(authInput)) {
    const hasActiveProviderBid = role === 'provider' ? await hasActiveBidAccess(db, soId, userId) : false;
    authInput = toMessageAuthorizationInput(p, userId, role, { hasActiveProviderBid });
    if (!canSendServiceMessage(authInput)) {
      const hasPropertyAccess = await canAccessProperty(c.env.DB, { propertyId: p.propertyId, userId, role });
      authInput = toMessageAuthorizationInput(p, userId, role, { hasActiveProviderBid, hasPropertyAccess });
      if (!canSendServiceMessage(authInput)) return err(c, 'Sem acesso', 'FORBIDDEN', 403);
    }
  }

  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const b = parsed.data;

  // Providers can participate in the operational thread, but not in internal notes.
  if (b.internal && !canSendInternalServiceMessage(authInput)) {
    return err(c, 'Provider não pode enviar mensagem interna', 'FORBIDDEN', 403);
  }

  const id = nanoid();
  await db.insert(serviceMessages).values({
    id,
    serviceOrderId: soId,
    authorId: userId,
    body: b.body,
    internal: b.internal ? 1 : 0,
    attachments: b.attachments,
  });

  // Notifica o outro lado (provider se internal=0; dono/manager caso contrário)
  const recipients = new Set<string>();
  const activeBidderIds = new Set<string>();
  const candidates = [p.ownerId, p.managerId, p.assignedTo, p.requestedBy].filter(
    (x): x is string => Boolean(x) && x !== userId
  );

  if (!p.assignedTo) {
    const activeBidders = await db
      .select({ provider_id: serviceBids.providerId })
      .from(serviceBids)
      .where(and(eq(serviceBids.serviceId, soId), sql`${serviceBids.status} IN ('pending', 'accepted')`));
    for (const b of activeBidders) {
      activeBidderIds.add(b.provider_id);
      if (b.provider_id !== userId) candidates.push(b.provider_id);
    }
  }

  for (const uid of candidates) {
    if (b.internal && (uid === p.assignedTo || activeBidderIds.has(uid))) continue;
    recipients.add(uid);
  }

  for (const uid of recipients) {
    const msg: QueueMessage = {
      type: 'SEND_PUSH',
      userId: uid,
      payload: {
        title: 'Nova mensagem na OS',
        body: b.body.slice(0, 140),
        url: `/services/${soId}`,
        tag: `msg:${soId}`,
        data: { serviceOrderId: soId, messageId: id },
      },
    };
    try {
      await c.env.QUEUE.send(msg);
    } catch {
      // ignore queue failures
    }
  }

  return ok(c, { id, created_at: new Date().toISOString() }, 201);
});

// DELETE /services/:serviceOrderId/messages/:id — soft delete (autor somente)
messages.delete('/:serviceOrderId/messages/:id', async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get('userId');
  const id = c.req.param('id')!;
  const res = await db.run(
    sql`UPDATE service_messages
        SET deleted_at = datetime('now')
        WHERE id = ${id} AND author_id = ${userId} AND deleted_at IS NULL`
  );
  if (!res.meta.changes) return err(c, 'Não encontrado', 'NOT_FOUND', 404);
  return ok(c, { id });
});

export default messages;
