import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { ok, err } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import type { Bindings, Variables } from '../lib/types';

const invites = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const createSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['viewer', 'provider', 'manager']).default('viewer'),
});

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Visualizador',
  provider: 'Prestador',
  manager: 'Gestor',
};

// ── Protected: create invite ──────────────────────────────────────────────────

invites.post('/properties/:propertyId/invites', authMiddleware, async (c) => {
  const { propertyId } = c.req.param();
  const userId = c.get('userId');

  // Only owner/manager of this property can invite
  const property = await c.env.DB.prepare(
    `SELECT id, name, owner_id FROM properties WHERE id = ? AND (owner_id = ? OR manager_id = ?) AND deleted_at IS NULL`
  ).bind(propertyId, userId, userId).first<{ id: string; name: string; owner_id: string }>();

  if (!property) return err(c, 'Imóvel não encontrado ou sem permissão', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { email, role } = parsed.data;

  // Check for existing pending invite
  const existing = await c.env.DB.prepare(
    `SELECT id FROM property_invites WHERE property_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > datetime('now')`
  ).bind(propertyId, email).first();
  if (existing) return err(c, 'Já existe um convite pendente para este email', 'DUPLICATE_INVITE', 409);

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = nanoid();

  await c.env.DB.prepare(
    `INSERT INTO property_invites (id, property_id, invited_by, email, role, token, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, propertyId, userId, email, role, token, expiresAt).run();

  // Send invite email (non-blocking)
  void (async () => {
    try {
      if (!c.env.RESEND_API_KEY) return;
      const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';
      const inviter = await c.env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{ name: string }>();
      const { sendEmail } = await import('../lib/email');
      await sendEmail(c.env.RESEND_API_KEY, {
        to: email,
        subject: `Convite para acessar ${property.name} no HouseLog`,
        html: buildInviteEmail({
          inviterName: inviter?.name ?? 'Um usuário',
          propertyName: property.name,
          role: ROLE_LABELS[role] ?? role,
          inviteUrl: `${appUrl}/invite/${token}`,
          appUrl,
          expiresAt,
        }),
      });
    } catch (e) {
      console.error('Invite email failed:', e);
    }
  })();

  return ok(c, { id, token, expires_at: expiresAt }, 201);
});

// ── GET /properties/:propertyId/invites — list pending invites ────────────────

invites.get('/properties/:propertyId/invites', authMiddleware, async (c) => {
  const { propertyId } = c.req.param();
  const userId = c.get('userId');

  // Owner, manager_id, or collaborator with role='manager' can view team
  const property = await c.env.DB.prepare(`
    SELECT p.id FROM properties p
    WHERE p.id = ? AND p.deleted_at IS NULL
      AND (
        p.owner_id = ? OR p.manager_id = ?
        OR EXISTS (
          SELECT 1 FROM property_collaborators
          WHERE property_id = p.id AND user_id = ? AND role = 'manager'
        )
      )
  `).bind(propertyId, userId, userId, userId).first();
  if (!property) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const { results } = await c.env.DB.prepare(`
    SELECT i.*, u.name as invited_by_name
    FROM property_invites i
    JOIN users u ON u.id = i.invited_by
    WHERE i.property_id = ? AND i.accepted_at IS NULL AND i.expires_at > datetime('now')
    ORDER BY i.created_at DESC
  `).bind(propertyId).all();

  const { results: collaborators } = await c.env.DB.prepare(`
    SELECT pc.id, pc.user_id, pc.role, pc.can_open_os, pc.created_at,
           u.name, u.email, u.phone, u.avatar_url
    FROM property_collaborators pc
    JOIN users u ON u.id = pc.user_id
    WHERE pc.property_id = ?
    ORDER BY pc.role ASC, u.name ASC
  `).bind(propertyId).all();

  return ok(c, { invites: results, collaborators });
});

// ── DELETE /properties/:propertyId/invites/:inviteId ──────────────────────────

invites.delete('/properties/:propertyId/invites/:inviteId', authMiddleware, async (c) => {
  const { propertyId, inviteId } = c.req.param();
  const userId = c.get('userId');

  const property = await c.env.DB.prepare(
    `SELECT id FROM properties WHERE id = ? AND (owner_id = ? OR manager_id = ?) AND deleted_at IS NULL`
  ).bind(propertyId, userId, userId).first();
  if (!property) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  await c.env.DB.prepare(`DELETE FROM property_invites WHERE id = ? AND property_id = ?`).bind(inviteId, propertyId).run();
  return ok(c, { success: true });
});

// ── Public: get invite details ────────────────────────────────────────────────

invites.get('/invite/:token', async (c) => {
  const { token } = c.req.param();

  const invite = await c.env.DB.prepare(`
    SELECT i.*, p.name as property_name, p.address as property_address, p.city as property_city,
           u.name as invited_by_name
    FROM property_invites i
    JOIN properties p ON p.id = i.property_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.token = ? AND i.accepted_at IS NULL AND i.expires_at > datetime('now')
  `).bind(token).first<{
    id: string; email: string; role: string; expires_at: string;
    property_name: string; property_address: string; property_city: string;
    invited_by_name: string; property_id: string;
  }>();

  if (!invite) return err(c, 'Convite inválido ou expirado', 'INVALID_TOKEN', 404);

  return ok(c, {
    email: invite.email,
    role: invite.role,
    expires_at: invite.expires_at,
    property_name: invite.property_name,
    property_address: invite.property_address,
    property_city: invite.property_city,
    invited_by_name: invite.invited_by_name,
  });
});

// ── Protected: accept invite ──────────────────────────────────────────────────

invites.post('/invite/:token/accept', authMiddleware, async (c) => {
  const { token } = c.req.param();
  const userId = c.get('userId');

  const invite = await c.env.DB.prepare(`
    SELECT * FROM property_invites
    WHERE token = ? AND accepted_at IS NULL AND expires_at > datetime('now')
  `).bind(token).first<{ id: string; property_id: string; role: string; email: string }>();

  if (!invite) return err(c, 'Convite inválido ou expirado', 'INVALID_TOKEN', 404);

  // Managers get can_open_os = 1 by default; providers/viewers start at 0
  const defaultCanOpenOs = invite.role === 'manager' ? 1 : 0;
  const collabId = nanoid();
  try {
    await c.env.DB.prepare(
      `INSERT INTO property_collaborators (id, property_id, user_id, role, can_open_os, invited_by)
       VALUES (?, ?, ?, ?, ?, (SELECT invited_by FROM property_invites WHERE token = ?))`
    ).bind(collabId, invite.property_id, userId, invite.role, defaultCanOpenOs, token).run();
  } catch {
    // Already a collaborator — update role and reset can_open_os
    await c.env.DB.prepare(
      `UPDATE property_collaborators SET role = ?, can_open_os = ? WHERE property_id = ? AND user_id = ?`
    ).bind(invite.role, defaultCanOpenOs, invite.property_id, userId).run();
  }

  await c.env.DB.prepare(
    `UPDATE property_invites SET accepted_at = datetime('now') WHERE token = ?`
  ).bind(token).run();

  return ok(c, { success: true, property_id: invite.property_id, role: invite.role });
});

// ── PATCH /properties/:propertyId/collaborators/:collabId — update permissions ─

invites.patch('/properties/:propertyId/collaborators/:collabId', authMiddleware, async (c) => {
  const { propertyId, collabId } = c.req.param();
  const userId = c.get('userId');

  // Only the property owner can change permissions
  const property = await c.env.DB.prepare(
    `SELECT id FROM properties WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`
  ).bind(propertyId, userId).first();
  if (!property) return err(c, 'Apenas o proprietário pode alterar permissões', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return err(c, 'Body inválido', 'INVALID_BODY');

  const { can_open_os } = body as { can_open_os?: boolean };
  if (typeof can_open_os !== 'boolean') return err(c, 'can_open_os obrigatório', 'VALIDATION_ERROR', 422);

  const collab = await c.env.DB.prepare(
    `SELECT id FROM property_collaborators WHERE id = ? AND property_id = ?`
  ).bind(collabId, propertyId).first();
  if (!collab) return err(c, 'Colaborador não encontrado', 'NOT_FOUND', 404);

  await c.env.DB.prepare(
    `UPDATE property_collaborators SET can_open_os = ? WHERE id = ?`
  ).bind(can_open_os ? 1 : 0, collabId).run();

  return ok(c, { success: true });
});

// ── DELETE /properties/:propertyId/collaborators/:collabId — remove collaborator

invites.delete('/properties/:propertyId/collaborators/:collabId', authMiddleware, async (c) => {
  const { propertyId, collabId } = c.req.param();
  const userId = c.get('userId');

  // Owner can remove anyone; a collaborator can remove themselves
  const property = await c.env.DB.prepare(
    `SELECT owner_id FROM properties WHERE id = ? AND deleted_at IS NULL`
  ).bind(propertyId).first<{ owner_id: string }>();
  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const collab = await c.env.DB.prepare(
    `SELECT id, user_id FROM property_collaborators WHERE id = ? AND property_id = ?`
  ).bind(collabId, propertyId).first<{ id: string; user_id: string }>();
  if (!collab) return err(c, 'Colaborador não encontrado', 'NOT_FOUND', 404);

  const isOwner = property.owner_id === userId;
  const isSelf = collab.user_id === userId;
  if (!isOwner && !isSelf) return err(c, 'Sem permissão para remover este colaborador', 'FORBIDDEN', 403);

  await c.env.DB.prepare(`DELETE FROM property_collaborators WHERE id = ?`).bind(collabId).run();
  return ok(c, { success: true });
});

export default invites;

// ── Email template ────────────────────────────────────────────────────────────

function buildInviteEmail(p: {
  inviterName: string; propertyName: string; role: string;
  inviteUrl: string; appUrl: string; expiresAt: string;
}): string {
  const expiry = new Date(p.expiresAt).toLocaleDateString('pt-BR');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#1e293b;padding:24px 32px">
      <span style="color:#fff;font-size:18px;font-weight:700">HouseLog</span>
    </div>
    <div style="padding:32px">
      <h1 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 16px">Você foi convidado!</h1>
      <p style="color:#475569;font-size:14px;margin:0 0 24px">
        <strong>${p.inviterName}</strong> convidou você para acessar o imóvel
        <strong>${p.propertyName}</strong> com o perfil de <strong>${p.role}</strong>.
      </p>
      <a href="${p.inviteUrl}" style="display:block;background:#3b82f6;color:#fff;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;margin-bottom:16px">
        Aceitar Convite
      </a>
      <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0">Este convite expira em ${expiry}</p>
    </div>
    <div style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center">
      <p style="color:#94a3b8;font-size:12px;margin:0">
        <a href="${p.appUrl}" style="color:#3b82f6;text-decoration:none">HouseLog</a> — Gestão de imóveis
      </p>
    </div>
  </div>
</body></html>`;
}
