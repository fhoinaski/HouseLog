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
import { authMiddleware, resolveTenant } from '../middleware/auth';
import { applyRateLimit } from '../middleware/rateLimit';
import { encryptSecret, decryptSecret, getCredentialKey, isEncrypted } from '../lib/credential-crypto';
import { getDb } from '../db/client';
import { propertyAccessCredentials } from '../db/schema';
import type { Bindings, Variables } from '../lib/types';

const credentials = new Hono<{ Bindings: Bindings; Variables: Variables }>();
credentials.use('*', authMiddleware);
credentials.use('*', resolveTenant);

type CredentialsContext = Context<{ Bindings: Bindings; Variables: Variables }>;

const CATEGORIES = ['wifi', 'alarm', 'smart_lock', 'gate', 'app', 'other'] as const;

const REVEAL_MAX = 10;
const REVEAL_WINDOW = 3600; // 1 hour

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
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  // Rate-limit reveals per user to prevent bulk extraction
  const rlKey = `rl:reveal:${userId}`;
  const allowed = await applyRateLimit(c.env.KV, rlKey, REVEAL_MAX, REVEAL_WINDOW);
  if (!allowed) {
    await writeAuditLog(c.env.DB, {
      tenantId,
      propertyId,
      entityType: 'property_access_credential',
      entityId: credId,
      action: 'secret_reveal_denied',
      actorId: userId,
      actorIp: c.req.header('CF-Connecting-IP'),
      newData: { reason: 'RATE_LIMITED', property_id: propertyId, tenant_id: tenantId },
    });
    return err(c, 'Limite de revelações atingido. Tente novamente em 1 hora.', 'RATE_LIMITED', 429);
  }

  const hasAccess = await canRevealCredentialSecret(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) {
    await writeAuditLog(c.env.DB, {
      tenantId,
      propertyId,
      entityType: 'property_access_credential',
      entityId: credId,
      action: 'secret_reveal_denied',
      actorId: userId,
      actorIp: c.req.header('CF-Connecting-IP'),
      newData: { reason: 'FORBIDDEN', property_id: propertyId, tenant_id: tenantId },
    });
    return err(c, 'Sem acesso', 'FORBIDDEN', 403);
  }

  const [cred] = await db
    .select(credentialRevealSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        eq(propertyAccessCredentials.tenantId, tenantId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .limit(1) as RevealedCredentialRecord[];

  if (!cred) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);

  // getCredentialKey throws (→ 500 via global error handler) if misconfigured;
  // keep it outside the try/catch so config errors are not masked as DECRYPT_ERROR.
  const credKey = getCredentialKey(c.env);

  // Decrypt if stored as encrypted; pass through legacy plaintext transparently.
  let plainSecret = cred.secret;
  if (isEncrypted(cred.secret)) {
    try {
      plainSecret = await decryptSecret(cred.secret, credKey);
    } catch {
      return err(c, 'Erro ao decifrar credencial', 'DECRYPT_ERROR', 500);
    }
  }

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'property_access_credential',
    entityId: cred.id,
    action: 'secret_reveal',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    newData: {
      property_id: propertyId,
      tenant_id: tenantId,
      category: cred.category,
      label: cred.label,
      user_agent: c.req.header('User-Agent') ?? null,
    },
  });

  return ok(c, {
    credential: {
      ...toCredentialResponse(cred),
      secret: plainSecret,
      secret_revealed: true,
    },
  });
}

// ── GET /properties/:propertyId/credentials ──────────────────────────────────

credentials.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canListCredentials(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const results = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.propertyId, propertyId),
        eq(propertyAccessCredentials.tenantId, tenantId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .orderBy(asc(propertyAccessCredentials.category), asc(propertyAccessCredentials.label)) as CredentialRecord[];

  return ok(c, { credentials: results.map(toCredentialResponse) });
});

// ── POST /properties/:propertyId/credentials ─────────────────────────────────

credentials.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canCreateCredential(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body inválido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados inválidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { category, label, username, secret, notes, integration_type, integration_config, share_with_os } = parsed.data;
  const id = nanoid();

  const encryptedSecret = await encryptSecret(secret, getCredentialKey(c.env));

  await db.insert(propertyAccessCredentials).values({
    id,
    tenantId,
    propertyId,
    createdBy: userId,
    category,
    label,
    username: username ?? null,
    secret: encryptedSecret,
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
    tenantId,
    propertyId,
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
  c.header('Deprecation', 'true');
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  c.header('Warning', '299 - "Deprecated credential reveal endpoint; use POST /secret/reveal"');
  c.header('Link', `</properties/${propertyId}/credentials/${credId}/secret/reveal>; rel="successor-version"`);
  return revealCredentialSecret(c);
});

// ── POST /properties/:propertyId/credentials/:credId/secret/reveal ───────────

credentials.post('/:credId/secret/reveal', revealCredentialSecret);

// ── PUT /properties/:propertyId/credentials/:credId ──────────────────────────

credentials.put('/:credId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
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
        eq(propertyAccessCredentials.tenantId, tenantId),
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
  if (secret !== undefined) patch.secret = await encryptSecret(secret, getCredentialKey(c.env));
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
    tenantId,
    propertyId,
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
  const tenantId = c.get('tenantId') as string;
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
        eq(propertyAccessCredentials.tenantId, tenantId),
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
        eq(propertyAccessCredentials.tenantId, tenantId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    );

  if (existing) {
    await writeAuditLog(c.env.DB, {
      tenantId,
      propertyId,
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
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canGenerateTemporaryCredentialAccess(c.env.DB, { propertyId, userId, role });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => ({})) as { expires_hours?: number; provider_name?: string };
  const expiresHours = body.expires_hours ?? 24;

  // Load metadata only — secret is not used until real Intelbras API call is implemented
  const [cred] = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(
      and(
        eq(propertyAccessCredentials.id, credId),
        eq(propertyAccessCredentials.propertyId, propertyId),
        eq(propertyAccessCredentials.tenantId, tenantId),
        isNull(propertyAccessCredentials.deletedAt)
      )
    )
    .limit(1) as CredentialRecord[];

  if (!cred) return err(c, 'Credencial não encontrada', 'NOT_FOUND', 404);
  if (cred.integration_type !== 'intelbras') {
    return err(c, 'Esta credencial não tem integração Intelbras configurada', 'INVALID_INTEGRATION', 400);
  }

  const tempPin = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000).toISOString();

  // In production: POST to Intelbras controller API to create a temporary user/card
  // const config = JSON.parse(cred.integration_config ?? '{}');
  // await callIntelbrasApi(config, tempPin, expiresAt);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
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
