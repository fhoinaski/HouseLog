import { Hono } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, desc, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/client';
import { properties, propertyCollaborators, propertyInvites, users } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const invites = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const createSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  role: z.enum(['viewer', 'provider', 'manager']).default('viewer'),
  specialties: z.array(z.string().min(2)).max(20).optional(),
  whatsapp: z.string().min(8).max(30).optional(),
});

const ROLE_LABELS: Record<string, string> = {
  viewer: 'Visualizador',
  provider: 'Prestador',
  manager: 'Gestor',
};

const SPECIALTY_ALIASES: Record<string, string> = {
  electrical: 'electrical',
  eletrica: 'electrical',
  'elétrica': 'electrical',
  plumbing: 'plumbing',
  hidraulica: 'plumbing',
  'hidráulica': 'plumbing',
  structural: 'structural',
  estrutural: 'structural',
  waterproofing: 'waterproofing',
  impermeabilizacao: 'waterproofing',
  'impermeabilização': 'waterproofing',
  painting: 'painting',
  pintura: 'painting',
  flooring: 'flooring',
  piso: 'flooring',
  roofing: 'roofing',
  telhado: 'roofing',
  general: 'general',
  geral: 'general',
};

function normalizeWhatsapp(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function parseSpecialties(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const mapped = value
    .map((item) => String(item).trim().toLowerCase())
    .map((item) => SPECIALTY_ALIASES[item] ?? item)
    .filter((item) => item.length >= 2)
    .slice(0, 10);

  return Array.from(new Set(mapped));
}

async function canManagePropertyTeam(db: D1Database, propertyId: string, userId: string): Promise<boolean> {
  const drizzle = getDb(db);
  const direct = await drizzle
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        eq(properties.id, propertyId),
        isNull(properties.deletedAt),
        or(eq(properties.ownerId, userId), eq(properties.managerId, userId))
      )
    )
    .limit(1);
  if (direct[0]) return true;

  const collab = await drizzle
    .select({ id: propertyCollaborators.id })
    .from(propertyCollaborators)
    .innerJoin(properties, eq(properties.id, propertyCollaborators.propertyId))
    .where(
      and(
        eq(propertyCollaborators.propertyId, propertyId),
        eq(propertyCollaborators.userId, userId),
        eq(propertyCollaborators.role, 'manager'),
        isNull(properties.deletedAt)
      )
    )
    .limit(1);

  return Boolean(collab[0]);
}

// ── Protected: create invite ──────────────────────────────────────────────────

invites.post('/properties/:propertyId/invites', authMiddleware, async (c) => {
  const db = getDb(c.env.DB);
  const { propertyId } = c.req.param();
  const userId = c.get('userId');

  const canManage = await canManagePropertyTeam(c.env.DB, propertyId, userId);
  if (!canManage) return err(c, 'Imóvel não encontrado ou sem permissão', 'FORBIDDEN', 403);

  const [property] = await db
    .select({ id: properties.id, name: properties.name, owner_id: properties.ownerId })
    .from(properties)
    .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
    .limit(1);

  if (!property) return err(c, 'Imóvel não encontrado ou sem permissão', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { role } = parsed.data;
  const inviteName = parsed.data.name?.trim() || null;
  const normalizedWhatsapp = normalizeWhatsapp(parsed.data.whatsapp);
  const normalizedEmail = parsed.data.email?.trim().toLowerCase() || null;
  const specialtiesJson = JSON.stringify(parseSpecialties(parsed.data.specialties ?? []));

  if (!normalizedEmail && !normalizedWhatsapp) {
    return err(c, 'Informe e-mail ou WhatsApp para convidar', 'VALIDATION_ERROR', 422);
  }

  if (!normalizedEmail && !inviteName) {
    return err(c, 'No pré-cadastro sem e-mail, informe o nome do prestador', 'VALIDATION_ERROR', 422);
  }

  const fallbackEmail = `wa-${(normalizedWhatsapp ?? 'sem-numero').replace(/\D/g, '') || 'sem-numero'}-${nanoid(6)}@pending.houselog.local`;
  const inviteEmail = normalizedEmail ?? fallbackEmail;

  // Check for existing pending invite
  if (normalizedEmail) {
    const [existingByEmail] = await db
      .select({ id: propertyInvites.id })
      .from(propertyInvites)
      .where(
        and(
          eq(propertyInvites.propertyId, propertyId),
          eq(propertyInvites.email, inviteEmail),
          isNull(propertyInvites.acceptedAt),
          gt(propertyInvites.expiresAt, sql`datetime('now')`)
        )
      )
      .limit(1);
    if (existingByEmail) return err(c, 'Já existe um convite pendente para este email', 'DUPLICATE_INVITE', 409);
  }

  if (!normalizedEmail && normalizedWhatsapp) {
    const [existingByWhatsapp] = await db
      .select({ id: propertyInvites.id })
      .from(propertyInvites)
      .where(
        and(
          eq(propertyInvites.propertyId, propertyId),
          eq(propertyInvites.whatsapp, normalizedWhatsapp),
          isNull(propertyInvites.acceptedAt),
          gt(propertyInvites.expiresAt, sql`datetime('now')`)
        )
      )
      .limit(1);
    if (existingByWhatsapp) return err(c, 'Já existe um convite pendente para este WhatsApp', 'DUPLICATE_INVITE', 409);
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const id = nanoid();
  const appUrl = c.env.APP_URL ?? 'https://house-log.vercel.app';

  await db.insert(propertyInvites).values({
    id,
    propertyId,
    invitedBy: userId,
    email: inviteEmail,
    role,
    token,
    expiresAt,
    specialties: JSON.parse(specialtiesJson) as string[],
    whatsapp: normalizedWhatsapp,
    inviteName,
  });

  // Send invite email (non-blocking)
  void (async () => {
    try {
      if (!normalizedEmail) return;
      if (!c.env.RESEND_API_KEY) return;
      const [inviter] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const { sendEmail } = await import('../lib/email');
      await sendEmail(c.env.RESEND_API_KEY, {
        to: normalizedEmail,
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

  return ok(c, {
    id,
    token,
    expires_at: expiresAt,
    invite_url: `${appUrl}/invite/${token}`,
    delivery: normalizedEmail ? 'email' : 'whatsapp_link',
  }, 201);
});

// ── OCR helper: extract provider data from business card image ──────────────

invites.post('/properties/:propertyId/invites/extract-card', authMiddleware, async (c) => {
  const { propertyId } = c.req.param();
  const userId = c.get('userId');

  const canManage = await canManagePropertyTeam(c.env.DB, propertyId, userId);
  if (!canManage) return err(c, 'Imóvel não encontrado ou sem permissão', 'FORBIDDEN', 403);

  const formData = await c.req.formData().catch(() => null);
  if (!formData) return err(c, 'Form data inválido', 'INVALID_BODY');

  const file = formData.get('file') as File | null;
  if (!file) return err(c, 'Imagem do cartão é obrigatória', 'MISSING_FILE');
  if (!file.type.startsWith('image/')) return err(c, 'Envie uma imagem válida (jpg/png/webp)', 'INVALID_FILE', 422);
  if (file.size > 8 * 1024 * 1024) return err(c, 'Imagem muito grande (máx 8MB)', 'INVALID_FILE', 422);

  const bytes = new Uint8Array(await file.arrayBuffer());

  let extracted: {
    name?: string;
    email?: string;
    whatsapp?: string;
    specialties?: string[];
    confidence?: number;
    notes?: string;
  } = {};

  try {
    const aiResponse = await (c.env.AI as Ai).run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: [...bytes],
      prompt: `Analise este cartão de visita e extraia os dados em JSON com o formato exato:
{"name":"","email":"","whatsapp":"","specialties":[""],"confidence":0.0,"notes":""}
Regras:
- Retorne SOMENTE JSON válido.
- whatsapp deve conter apenas números com DDI se possível.
- specialties deve usar termos curtos em minúsculas (ex: eletrica, hidraulica, pintura, ar_condicionado, geral).
- confidence entre 0 e 1.` ,
      max_tokens: 450,
    } as Parameters<Ai['run']>[1]);

    const responseText = (aiResponse as { response?: string }).response ?? '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      extracted = {
        name: typeof parsed.name === 'string' ? parsed.name.trim() : undefined,
        email: typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : undefined,
        whatsapp: normalizeWhatsapp(typeof parsed.whatsapp === 'string' ? parsed.whatsapp : null) ?? undefined,
        specialties: parseSpecialties(parsed.specialties),
        confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : undefined,
        notes: typeof parsed.notes === 'string' ? parsed.notes.trim() : undefined,
      };
    }
  } catch (e) {
    console.error('Card OCR failed:', e);
    return err(c, 'Não foi possível extrair dados da imagem. Tente uma foto mais nítida.', 'OCR_FAILED', 422);
  }

  return ok(c, {
    suggestion: {
      name: extracted.name ?? '',
      email: extracted.email ?? '',
      whatsapp: extracted.whatsapp ?? '',
      specialties: extracted.specialties ?? [],
      confidence: extracted.confidence ?? 0,
      notes: extracted.notes ?? '',
    },
  });
});

// ── GET /properties/:propertyId/invites — list pending invites ────────────────

invites.get('/properties/:propertyId/invites', authMiddleware, async (c) => {
  const db = getDb(c.env.DB);
  const { propertyId } = c.req.param();
  const userId = c.get('userId');

  // Owner, manager_id, or collaborator with role='manager' can view team
  const property = await canManagePropertyTeam(c.env.DB, propertyId, userId);
  if (!property) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .select({
      id: propertyInvites.id,
      property_id: propertyInvites.propertyId,
      invited_by: propertyInvites.invitedBy,
      email: propertyInvites.email,
      role: propertyInvites.role,
      token: propertyInvites.token,
      invite_name: propertyInvites.inviteName,
      specialties: propertyInvites.specialties,
      whatsapp: propertyInvites.whatsapp,
      expires_at: propertyInvites.expiresAt,
      accepted_at: propertyInvites.acceptedAt,
      created_at: propertyInvites.createdAt,
      invited_by_name: users.name,
    })
    .from(propertyInvites)
    .innerJoin(users, eq(users.id, propertyInvites.invitedBy))
    .where(
      and(
        eq(propertyInvites.propertyId, propertyId),
        isNull(propertyInvites.acceptedAt),
        gt(propertyInvites.expiresAt, sql`datetime('now')`)
      )
    )
    .orderBy(desc(propertyInvites.createdAt));

  const collaborators = await db
    .select({
      id: propertyCollaborators.id,
      user_id: propertyCollaborators.userId,
      role: propertyCollaborators.role,
      can_open_os: propertyCollaborators.canOpenOs,
      specialties: propertyCollaborators.specialties,
      whatsapp: propertyCollaborators.whatsapp,
      created_at: propertyCollaborators.createdAt,
      name: users.name,
      email: users.email,
      phone: users.phone,
      avatar_url: users.avatarUrl,
    })
    .from(propertyCollaborators)
    .innerJoin(users, eq(users.id, propertyCollaborators.userId))
    .where(eq(propertyCollaborators.propertyId, propertyId))
    .orderBy(propertyCollaborators.role, users.name);

  return ok(c, { invites: results, collaborators });
});

// ── DELETE /properties/:propertyId/invites/:inviteId ──────────────────────────

invites.delete('/properties/:propertyId/invites/:inviteId', authMiddleware, async (c) => {
  const db = getDb(c.env.DB);
  const { propertyId, inviteId } = c.req.param();
  const userId = c.get('userId');

  const canManage = await canManagePropertyTeam(c.env.DB, propertyId, userId);
  if (!canManage) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  await db.delete(propertyInvites).where(and(eq(propertyInvites.id, inviteId), eq(propertyInvites.propertyId, propertyId)));
  return ok(c, { success: true });
});

// ── Public: get invite details ────────────────────────────────────────────────

invites.get('/invite/:token', async (c) => {
  const db = getDb(c.env.DB);
  const { token } = c.req.param();

  const [invite] = await db
    .select({
      id: propertyInvites.id,
      email: propertyInvites.email,
      role: propertyInvites.role,
      expires_at: propertyInvites.expiresAt,
      invite_name: propertyInvites.inviteName,
      whatsapp: propertyInvites.whatsapp,
      property_name: properties.name,
      property_address: properties.address,
      property_city: properties.city,
      invited_by_name: users.name,
      property_id: propertyInvites.propertyId,
    })
    .from(propertyInvites)
    .innerJoin(properties, eq(properties.id, propertyInvites.propertyId))
    .innerJoin(users, eq(users.id, propertyInvites.invitedBy))
    .where(
      and(
        eq(propertyInvites.token, token),
        isNull(propertyInvites.acceptedAt),
        gt(propertyInvites.expiresAt, sql`datetime('now')`)
      )
    )
    .limit(1) as Array<{
    id: string; email: string; role: string; expires_at: string;
    invite_name: string | null;
    whatsapp: string | null;
    property_name: string; property_address: string; property_city: string;
    invited_by_name: string; property_id: string;
  }>;

  if (!invite) return err(c, 'Convite inválido ou expirado', 'INVALID_TOKEN', 404);

  const email = invite.email.endsWith('@pending.houselog.local') ? null : invite.email;

  return ok(c, {
    email,
    invite_name: invite.invite_name,
    whatsapp: invite.whatsapp,
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
  const db = getDb(c.env.DB);
  const { token } = c.req.param();
  const userId = c.get('userId');

  const [invite] = await db
    .select({
      id: propertyInvites.id,
      property_id: propertyInvites.propertyId,
      role: propertyInvites.role,
      email: propertyInvites.email,
      specialties: propertyInvites.specialties,
      whatsapp: propertyInvites.whatsapp,
      invited_by: propertyInvites.invitedBy,
    })
    .from(propertyInvites)
    .where(
      and(
        eq(propertyInvites.token, token),
        isNull(propertyInvites.acceptedAt),
        gt(propertyInvites.expiresAt, sql`datetime('now')`)
      )
    )
    .limit(1) as Array<{
    id: string;
    property_id: string;
    role: string;
    email: string;
    specialties: string[] | null;
    whatsapp: string | null;
    invited_by: string;
  }>;

  if (!invite) return err(c, 'Convite inválido ou expirado', 'INVALID_TOKEN', 404);

  // Managers get can_open_os = 1 by default; providers/viewers start at 0
  const defaultCanOpenOs = invite.role === 'manager' ? 1 : 0;
  const collabId = nanoid();
  const inviteSpecialties = invite.specialties ?? [];
  try {
    await db.insert(propertyCollaborators).values({
      id: collabId,
      propertyId: invite.property_id,
      userId,
      role: invite.role,
      canOpenOs: defaultCanOpenOs,
      specialties: inviteSpecialties,
      whatsapp: invite.whatsapp,
      invitedBy: invite.invited_by,
    });
  } catch {
    // Already a collaborator — update role and reset can_open_os
    await db
      .update(propertyCollaborators)
      .set({
        role: invite.role,
        canOpenOs: defaultCanOpenOs,
        specialties: inviteSpecialties,
        whatsapp: invite.whatsapp,
      })
      .where(and(eq(propertyCollaborators.propertyId, invite.property_id), eq(propertyCollaborators.userId, userId)));
  }

  if (invite.whatsapp) {
    const [currentUser] = await db
      .select({ phone: users.phone })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!currentUser?.phone) {
      await db.update(users).set({ phone: invite.whatsapp }).where(eq(users.id, userId));
    }
  }

  await db.update(propertyInvites).set({ acceptedAt: sql`datetime('now')` }).where(eq(propertyInvites.token, token));

  return ok(c, { success: true, property_id: invite.property_id, role: invite.role });
});

// ── PATCH /properties/:propertyId/collaborators/:collabId — update permissions ─

invites.patch('/properties/:propertyId/collaborators/:collabId', authMiddleware, async (c) => {
  const db = getDb(c.env.DB);
  const { propertyId, collabId } = c.req.param();
  const userId = c.get('userId');

  const canManage = await canManagePropertyTeam(c.env.DB, propertyId, userId);
  if (!canManage) return err(c, 'Sem permissão para alterar permissões', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return err(c, 'Body inválido', 'INVALID_BODY');

  const { can_open_os } = body as { can_open_os?: boolean };
  if (typeof can_open_os !== 'boolean') return err(c, 'can_open_os obrigatório', 'VALIDATION_ERROR', 422);

  const [collab] = await db
    .select({ id: propertyCollaborators.id })
    .from(propertyCollaborators)
    .where(and(eq(propertyCollaborators.id, collabId), eq(propertyCollaborators.propertyId, propertyId)))
    .limit(1);
  if (!collab) return err(c, 'Colaborador não encontrado', 'NOT_FOUND', 404);

  await db.update(propertyCollaborators).set({ canOpenOs: can_open_os ? 1 : 0 }).where(eq(propertyCollaborators.id, collabId));

  return ok(c, { success: true });
});

// ── DELETE /properties/:propertyId/collaborators/:collabId — remove collaborator

invites.delete('/properties/:propertyId/collaborators/:collabId', authMiddleware, async (c) => {
  const db = getDb(c.env.DB);
  const { propertyId, collabId } = c.req.param();
  const userId = c.get('userId');

  const [property] = await db
    .select({ owner_id: properties.ownerId, manager_id: properties.managerId })
    .from(properties)
    .where(and(eq(properties.id, propertyId), isNull(properties.deletedAt)))
    .limit(1) as Array<{ owner_id: string; manager_id: string | null }>;
  if (!property) return err(c, 'Imóvel não encontrado', 'NOT_FOUND', 404);

  const [collab] = await db
    .select({ id: propertyCollaborators.id, user_id: propertyCollaborators.userId })
    .from(propertyCollaborators)
    .where(and(eq(propertyCollaborators.id, collabId), eq(propertyCollaborators.propertyId, propertyId)))
    .limit(1) as Array<{ id: string; user_id: string }>;
  if (!collab) return err(c, 'Colaborador não encontrado', 'NOT_FOUND', 404);

  const managesByProperty = property.owner_id === userId || property.manager_id === userId;
  const [managesByCollaborator] = await db
    .select({ id: propertyCollaborators.id })
    .from(propertyCollaborators)
    .where(
      and(
        eq(propertyCollaborators.propertyId, propertyId),
        eq(propertyCollaborators.userId, userId),
        eq(propertyCollaborators.role, 'manager')
      )
    )
    .limit(1);
  const isManager = managesByCollaborator !== null;
  const isSelf = collab.user_id === userId;
  if (!managesByProperty && !isManager && !isSelf) {
    return err(c, 'Sem permissão para remover este colaborador', 'FORBIDDEN', 403);
  }

  await db.delete(propertyCollaborators).where(eq(propertyCollaborators.id, collabId));
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
