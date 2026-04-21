import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { writeAuditLog } from '../lib/audit';
import {
  canCreateCredential,
  canDeleteCredential,
  canGenerateTemporaryCredentialAccess,
  canListCredentials,
  canRevealCredentialSecret,
  canUpdateCredential,
} from '../lib/authorization';
import { authMiddleware } from '../middleware/auth';
import { getDb } from '../db/client';
import { propertyAccessCredentials } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const credentials = new Hono<{ Bindings: Bindings; Variables: Variables }>();
credentials.use('*', authMiddleware);

type CredentialsContext = Context<{ Bindings: Bindings; Variables: Variables }>;

const CATEGORIES = ['wifi', 'alarm', 'smart_lock', 'gate', 'app', 'other'] as const;

const createSchema = z.object({
  category:          z.enum(CATEGORIES).default('other'),
  label:             z.string().min(1),
  username:          z.string().optional(),
  secret:            z.string().min(1),
  notes:             z.string().optional(),
  integration_type:  z.enum(['intelbras']).optional().nullable(),
  integration_config: z.record(z.unknown()).optional().nullable(),
  share_with_os:     z.boolean().default(false),
});

type CredentialRecord = {
  id: string;
  property_id: string;
  created_by: string;
  category: string;
  label: string;
  username: string | null;
  notes: string | null;
  integration_type: string | null;
  integration_config: Record<string, unknown> | null;
  share_with_os: number;
  created_at: string;
  updated_at: string;
};

type RevealedCredentialRecord = CredentialRecord & {
  secret: string;
};

type CredentialResponse = Omit<CredentialRecord, 'share_with_os'> & {
  share_with_os: boolean;
  has_secret: boolean;
};

const credentialSelect = {
  id: propertyAccessCredentials.id,
  property_id: propertyAccessCredentials.propertyId,
  created_by: propertyAccessCredentials.createdBy,
  category: propertyAccessCredentials.category,
  label: propertyAccessCredentials.label,
  username: propertyAccessCredentials.username,
  notes: propertyAccessCredentials.notes,
  integration_type: propertyAccessCredentials.integrationType,
  integration_config: propertyAccessCredentials.integrationConfig,
  share_with_os: propertyAccessCredentials.shareWithOs,
  created_at: propertyAccessCredentials.createdAt,
  updated_at: propertyAccessCredentials.updatedAt,
};

const credentialRevealSelect = {
  ...credentialSelect,
  secret: propertyAccessCredentials.secret,
};

function toCredentialResponse(row: CredentialRecord): CredentialResponse {
  return {
    ...row,
    integration_config: row.integration_config ?? null,
    share_with_os: row.share_with_os === 1,
    has_secret: true,
  };
}

function credentialAuditData(propertyId: string, row: CredentialRecord, actorId: string) {
  return {
    property_id: propertyId,
    credential_id: row.id,
    category: row.category,
    label: row.label,
    integration_type: row.integration_type,
    share_with_os: row.share_with_os === 1,
    actor_id: actorId,
  };
}

async function revealCredentialSecret(c: CredentialsContext) {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canRevealCredentialSecret(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [cred] = await db
    .select(credentialRevealSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .limit(1) as RevealedCredentialRecord[];

  if (!cred) return err(c, 'Credencial nÃ£o encontrada', 'NOT_FOUND', 404);

  await writeAuditLog(c.env.DB, {
    entityType: 'property_access_credential',
    entityId: cred.id,
    action: 'secret_reveal',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      category: cred.category,
      label: cred.label,
    },
  });

  return ok(c, {
    credential: {
      ...toCredentialResponse(cred),
      secret: cred.secret,
      secret_revealed: true,
    },
  });
}

// ── GET /properties/:propertyId/credentials ──────────────────────────────────

credentials.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canListCredentials(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.propertyId, propertyId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .orderBy(asc(propertyAccessCredentials.category), asc(propertyAccessCredentials.label)) as CredentialRecord[];

  const items = results.map(toCredentialResponse);

  return ok(c, { credentials: items });
});

// ── POST /properties/:propertyId/credentials ─────────────────────────────────

credentials.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canCreateCredential(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { category, label, username, secret, notes, integration_type, integration_config, share_with_os } = parsed.data;
  const id = nanoid();

  await db.insert(propertyAccessCredentials).values({
    id,
    propertyId,
    createdBy: userId,
    category,
    label,
    username: username ?? null,
    secret,
    notes: notes ?? null,
    integrationType: integration_type ?? null,
    integrationConfig: integration_config ?? null,
    shareWithOs: share_with_os ? 1 : 0,
  });

  const [row] = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(eq(propertyAccessCredentials.id, id))
    .limit(1) as CredentialRecord[];

  if (!row) return err(c, 'Erro ao carregar credencial', 'SERVER_ERROR', 500);

  await writeAuditLog(c.env.DB, {
    entityType: 'property_access_credential',
    entityId: row.id,
    action: 'credential_created',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: credentialAuditData(propertyId, row, userId),
  });

  return ok(c, { credential: toCredentialResponse(row) }, 201);
});

// ── GET /properties/:propertyId/credentials/:credId/secret ───────────────────
// Legacy reveal path kept temporarily for compatibility.
// New consumers must use POST /properties/:propertyId/credentials/:credId/secret/reveal.

credentials.get('/:credId/secret', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  c.header('Deprecation', 'true');
  c.header('Warning', '299 - "Deprecated credential reveal endpoint; use POST /secret/reveal"');
  c.header('Link', `</properties/${propertyId}/credentials/${credId}/secret/reveal>; rel="successor-version"`);
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canRevealCredentialSecret(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [cred] = await db
    .select(credentialRevealSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .limit(1) as RevealedCredentialRecord[];

  if (!cred) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);

  await writeAuditLog(c.env.DB, {
    entityType: 'property_access_credential',
    entityId: cred.id,
    action: 'secret_reveal',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      category: cred.category,
      label: cred.label,
    },
  });

  return ok(c, {
    credential: {
      ...toCredentialResponse(cred),
      secret: cred.secret,
      secret_revealed: true,
    },
  });
});

// ── PUT /properties/:propertyId/credentials/:credId ──────────────────────────

// POST /properties/:propertyId/credentials/:credId/secret/reveal
// Preferred explicit action for sensitive, audited credential reveal.

credentials.post('/:credId/secret/reveal', revealCredentialSecret);

credentials.put('/:credId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canUpdateCredential(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const [existing] = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .limit(1) as CredentialRecord[];
  if (!existing) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);

  const { category, label, username, secret, notes, integration_type, integration_config, share_with_os } = parsed.data;

  const patch: Partial<typeof propertyAccessCredentials.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (category !== undefined) patch.category = category;
  if (label !== undefined) patch.label = label;
  if (username !== undefined) patch.username = username ?? null;
  if (secret !== undefined) patch.secret = secret;
  if (notes !== undefined) patch.notes = notes ?? null;
  if (integration_type !== undefined) patch.integrationType = integration_type ?? null;
  if (integration_config !== undefined) patch.integrationConfig = integration_config ?? null;
  if (share_with_os !== undefined) patch.shareWithOs = share_with_os ? 1 : 0;

  await db
    .update(propertyAccessCredentials)
    .set(patch)
    .where(eq(propertyAccessCredentials.id, credId));

  const [row] = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(eq(propertyAccessCredentials.id, credId))
    .limit(1) as CredentialRecord[];

  if (!row) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);

  await writeAuditLog(c.env.DB, {
    entityType: 'property_access_credential',
    entityId: row.id,
    action: 'credential_updated',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: credentialAuditData(propertyId, existing, userId),
    newData: {
      ...credentialAuditData(propertyId, row, userId),
      changed_fields: Object.keys(parsed.data).filter((field) => field !== 'secret'),
      secret_changed: secret !== undefined,
    },
  });

  return ok(c, { credential: toCredentialResponse(row) });
});

// ── DELETE /properties/:propertyId/credentials/:credId ───────────────────────

credentials.delete('/:credId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canDeleteCredential(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const [existing] = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .limit(1) as CredentialRecord[];

  await db
    .update(propertyAccessCredentials)
    .set({ deletedAt: new Date().toISOString() })
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    );

  if (existing) {
    await writeAuditLog(c.env.DB, {
      entityType: 'property_access_credential',
      entityId: existing.id,
      action: 'credential_deleted',
      actorId: userId,
      actorIp: c.req.header('CF-Connecting-IP'),
      oldData: credentialAuditData(propertyId, existing, userId),
    });
  }

  return ok(c, { deleted: true });
});

// ── POST /properties/:propertyId/credentials/:credId/generate-temp-code ──────
// Intelbras smart lock: generate a temporary PIN (stub — real call done client-side
// or via a dedicated worker; here we demonstrate the flow).

credentials.post('/:credId/generate-temp-code', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const role = c.get('userRole');

  const hasAccess = await canGenerateTemporaryCredentialAccess(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => ({})) as { expires_hours?: number; provider_name?: string };
  const expiresHours = body.expires_hours ?? 24;

  const [cred] = await db
    .select(credentialRevealSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .limit(1) as RevealedCredentialRecord[];

  if (!cred) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);
  if (cred.integration_type !== 'intelbras') {
    return err(c, 'Esta credencial não tem integração Intelbras configurada', 'INVALID_INTEGRATION', 400);
  }

  // Generate a 6-digit temporary PIN (real implementation would call Intelbras API)
  const tempPin = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

  // In production: POST to Intelbras controller API to create a temporary user/card
  // const config = JSON.parse(cred.integration_config ?? '{}');
  // await callIntelbrasApi(config, tempPin, expiresAt);

  await writeAuditLog(c.env.DB, {
    entityType: 'property_access_credential',
    entityId: cred.id,
    action: 'temporary_credential_access_generated',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      credential_id: cred.id,
      expires_at: expiresAt,
      expires_hours: expiresHours,
      provider_name: body.provider_name ?? null,
    },
  });

  return ok(c, {
    temp_pin: tempPin,
    expires_at: expiresAt,
    expires_hours: expiresHours,
    note: 'PIN temporário gerado. Configure no painel Intelbras se necessário.',
  });
});

export default credentials;
