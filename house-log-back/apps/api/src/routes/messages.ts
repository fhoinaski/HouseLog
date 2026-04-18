// Chat por OS: service_messages.
// Visibilidade:
//  - participantes da OS: owner/manager da property, assigned_to (provider), requested_by.
//  - internal=1: escondido do provider.
//
// Envio de push ao outro lado quando nova mensagem.

import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { authMiddleware, assertPropertyAccess } from '../middleware/auth';
import { err, ok } from '../lib/response';
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
  db: D1Database,
  serviceOrderId: string
): Promise<Participants | null> {
  const row = await db
    .prepare(
      `SELECT s.property_id, s.assigned_to, s.requested_by,
              p.owner_id, p.manager_id
       FROM service_orders s
       JOIN properties p ON p.id = s.property_id
       WHERE s.id = ? AND s.deleted_at IS NULL`
    )
    .bind(serviceOrderId)
    .first<{
      property_id: string;
      assigned_to: string | null;
      requested_by: string;
      owner_id: string;
      manager_id: string | null;
    }>();
  if (!row) return null;
  return {
    propertyId: row.property_id,
    ownerId: row.owner_id,
    managerId: row.manager_id,
    assignedTo: row.assigned_to,
    requestedBy: row.requested_by,
  };
}

function isParticipant(p: Participants, userId: string): boolean {
  return (
    userId === p.ownerId ||
    userId === p.managerId ||
    userId === p.assignedTo ||
    userId === p.requestedBy
  );
}

function isInternalRole(p: Participants, userId: string): boolean {
  // Provider (assigned_to) não vê internas; demais participantes vêem.
  return userId !== p.assignedTo;
}

// GET /services/:serviceOrderId/messages
messages.get('/:serviceOrderId/messages', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  const soId = c.req.param('serviceOrderId');

  const p = await loadParticipants(c.env.DB, soId);
  if (!p) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);
  if (!isParticipant(p, userId)) {
    const hasAccess = await assertPropertyAccess(c.env.DB, p.propertyId, userId, role);
    if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const canSeeInternal = isInternalRole(p, userId);
  const rows = await c.env.DB
    .prepare(
      `SELECT m.id, m.author_id, u.name AS author_name, m.body, m.internal,
              m.attachments, m.created_at
       FROM service_messages m
       JOIN users u ON u.id = m.author_id
       WHERE m.service_order_id = ? AND m.deleted_at IS NULL
         ${canSeeInternal ? '' : 'AND m.internal = 0'}
       ORDER BY m.created_at ASC
       LIMIT 500`
    )
    .bind(soId)
    .all();
  return ok(c, { data: rows.results ?? [] });
});

const createSchema = z.object({
  body: z.string().min(1).max(4000),
  internal: z.boolean().default(false),
  attachments: z.array(z.string().url()).max(8).default([]),
});

// POST /services/:serviceOrderId/messages
messages.post('/:serviceOrderId/messages', async (c) => {
  const userId = c.get('userId');
  const role = c.get('userRole');
  const soId = c.req.param('serviceOrderId');

  const p = await loadParticipants(c.env.DB, soId);
  if (!p) return err(c, 'OS não encontrada', 'NOT_FOUND', 404);
  if (!isParticipant(p, userId)) {
    const hasAccess = await assertPropertyAccess(c.env.DB, p.propertyId, userId, role);
    if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const parsed = createSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());
  const b = parsed.data;

  // Provider não pode criar mensagem internal
  if (b.internal && userId === p.assignedTo) {
    return err(c, 'Provider não pode enviar mensagem interna', 'FORBIDDEN', 403);
  }

  const id = nanoid();
  await c.env.DB
    .prepare(
      `INSERT INTO service_messages
       (id, service_order_id, author_id, body, internal, attachments)
       VALUES (?,?,?,?,?,?)`
    )
    .bind(id, soId, userId, b.body, b.internal ? 1 : 0, JSON.stringify(b.attachments))
    .run();

  // Notifica o outro lado (provider se internal=0; dono/manager caso contrário)
  const recipients = new Set<string>();
  const candidates = [p.ownerId, p.managerId, p.assignedTo, p.requestedBy].filter(
    (x): x is string => Boolean(x) && x !== userId
  );
  for (const uid of candidates) {
    if (b.internal && uid === p.assignedTo) continue;
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
  const userId = c.get('userId');
  const id = c.req.param('id');
  const res = await c.env.DB
    .prepare(
      `UPDATE service_messages
       SET deleted_at = datetime('now')
       WHERE id = ? AND author_id = ? AND deleted_at IS NULL`
    )
    .bind(id, userId)
    .run();
  if (!res.meta.changes) return err(c, 'Não encontrado', 'NOT_FOUND', 404);
  return ok(c, { id });
});

export default messages;
