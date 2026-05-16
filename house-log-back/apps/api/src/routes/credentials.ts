import { Hono } from 'hono';
import type { Context } from 'hono';
import { nanoid } from 'nanoid';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { ok, err } from '../lib/response';
import { writeAuditLog } from '../lib/audit';
import {
  canRevealCredential,
  canCreateCredential,
  canDeleteCredential,
  canGenerateTemporaryCredentialAccess,
  canListCredentials,
  canUpdateCredential,
} from '../lib/authorization';
import { authMiddleware, resolveTenant } from '../middleware/auth';
import { applyRateLimit } from '../middleware/rateLimit';
import { encryptSecret, decryptSecret, getCredentialKey, isEncrypted } from '../lib/credential-crypto';
import {
  hasCredentialIntegrationSecret,
  sanitizeCredentialIntegrationConfig,
  splitCredentialIntegrationConfig,
} from '../lib/credential-integration';
import { getDb } from '../db/client';
import { propertyAccessCredentials } from '../db/schema';
import { credentialCreateSchema, credentialRevealSchema } from '@houselog/contracts';
import type { Bindings, Variables } from '../lib/types';

const credentials = new Hono<{ Bindings: Bindings; Variables: Variables }>();
credentials.use('*', authMiddleware);
credentials.use('*', resolveTenant);

type CredentialsContext = Context<{ Bindings: Bindings; Variables: Variables }>;

const REVEAL_MAX = 10;
const REVEAL_WINDOW = 3600; // 1 hour

const createSchema = credentialCreateSchema;

type CredentialRecord = {
  id: string;
  tenant_id: string | null;
  property_id: string;
  created_by: string;
  category: string;
  label: string;
  username: string | null;
  secret: string;
  notes: string | null;
  integration_type: string | null;
  integration_config: Record<string, unknown> | null;
  integration_secret: string | null;
  share_with_os: number;
  created_at: string;
  updated_at: string;
};

type RevealedCredentialRecord = CredentialRecord;

type CredentialResponse = Omit<CredentialRecord, 'share_with_os' | 'tenant_id' | 'secret' | 'integration_secret'> & {
  integration_config: Record<string, unknown> | null;
  share_with_os: boolean;
  has_secret: boolean;
  has_integration_secret: boolean;
};

const credentialSelect = {
  id: propertyAccessCredentials.id,
  tenant_id: propertyAccessCredentials.tenantId,
  property_id: propertyAccessCredentials.propertyId,
  created_by: propertyAccessCredentials.createdBy,
  category: propertyAccessCredentials.category,
  label: propertyAccessCredentials.label,
  username: propertyAccessCredentials.username,
  secret: propertyAccessCredentials.secret,
  notes: propertyAccessCredentials.notes,
  integration_type: propertyAccessCredentials.integrationType,
  integration_config: propertyAccessCredentials.integrationConfig,
  integration_secret: propertyAccessCredentials.integrationSecret,
  share_with_os: propertyAccessCredentials.shareWithOs,
  created_at: propertyAccessCredentials.createdAt,
  updated_at: propertyAccessCredentials.updatedAt,
};

const credentialRevealSelect = {
  ...credentialSelect,
  secret: propertyAccessCredentials.secret,
};

function toCredentialResponse(row: CredentialRecord): CredentialResponse {
  const { tenant_id: _tenantId, secret: _secret, integration_secret: _integrationSecret, ...safeRow } = row;
  return {
    ...safeRow,
    integration_config: sanitizeCredentialIntegrationConfig(row.integration_config),
    share_with_os: row.share_with_os === 1,
    has_secret: true,
    has_integration_secret: hasCredentialIntegrationSecret(row.integration_secret, row.integration_config),
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

async function decryptStoredSecret(
  value: string,
  key: string
): Promise<string> {
  if (!isEncrypted(value)) return value;
  return decryptSecret(value, key);
}

async function migrateLegacyStoredSecretIfNeeded(
  db: ReturnType<typeof getDb>,
  row: CredentialRecord | RevealedCredentialRecord,
  key: string
): Promise<CredentialRecord | RevealedCredentialRecord> {
  if (!row.tenant_id || isEncrypted(row.secret)) return row;

  const encryptedSecret = await encryptSecret(row.secret, key);
  await db
    .update(propertyAccessCredentials)
    .set({
      secret: encryptedSecret,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(propertyAccessCredentials.id, row.id), eq(propertyAccessCredentials.tenantId, row.tenant_id)));

  return {
    ...row,
    secret: encryptedSecret,
  };
}

async function migrateLegacyIntegrationSecretIfNeeded(
  db: ReturnType<typeof getDb>,
  row: CredentialRecord | RevealedCredentialRecord,
  key: string
): Promise<CredentialRecord | RevealedCredentialRecord> {
  if (!row.tenant_id) {
    return {
      ...row,
      integration_config: sanitizeCredentialIntegrationConfig(row.integration_config),
    };
  }

  const { publicConfig, secretPlaintext } = splitCredentialIntegrationConfig(row.integration_config);
  if (!secretPlaintext) {
    return {
      ...row,
      integration_config: publicConfig,
    };
  }

  const encryptedSecret = await encryptSecret(secretPlaintext, key);
  await db
    .update(propertyAccessCredentials)
    .set({
      integrationConfig: publicConfig,
      integrationSecret: encryptedSecret,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(propertyAccessCredentials.id, row.id), eq(propertyAccessCredentials.tenantId, row.tenant_id)));

  return {
    ...row,
    integration_config: publicConfig,
    integration_secret: encryptedSecret,
  };
}

async function revealCredentialSecret(c: CredentialsContext) {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');
  const revealBody = credentialRevealSchema.safeParse(await c.req.json().catch(() => null));

  if (!revealBody.success) {
    return err(c, 'Motivo obrigatorio para revelar credencial', 'VALIDATION_ERROR', 422, revealBody.error.flatten());
  }

  const reason = revealBody.data.reason;
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
    return err(c, 'Limite de revelacoes atingido. Tente novamente em 1 hora.', 'RATE_LIMITED', 429);
  }

  const decision = await canRevealCredential(c.env.DB, {
    propertyId,
    userId,
    role,
    tenantId,
    tenantRole: c.get('tenantRole'),
  });
  if (!decision.allowed) {
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
    return err(c, 'Sem acesso', decision.code, decision.status);
  }

  const [rawCred] = await db
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

  if (!rawCred) return err(c, 'Credencial nao encontrada', 'NOT_FOUND', 404);

  const credKey = getCredentialKey(c.env);
  const withEncryptedSecret = await migrateLegacyStoredSecretIfNeeded(db, rawCred, credKey);
  const cred = await migrateLegacyIntegrationSecretIfNeeded(db, withEncryptedSecret, credKey);

  let plainSecret: string;
  let integrationSecret: string | null = null;
  try {
    plainSecret = await decryptStoredSecret(rawCred.secret, credKey);
    if (cred.integration_secret) {
      integrationSecret = await decryptStoredSecret(cred.integration_secret, credKey);
    }
  } catch {
    return err(c, 'Erro ao decifrar credencial', 'DECRYPT_ERROR', 500);
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
      reason,
      user_agent: c.req.header('User-Agent') ?? null,
    },
  });

  return ok(c, {
    credential: {
      ...toCredentialResponse(cred),
      secret: plainSecret,
      integration_secret: integrationSecret,
      secret_revealed: true,
    },
  });
}


// â”€â”€ GET /properties/:propertyId/credentials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

credentials.get('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canListCredentials(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
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

  const credKey = getCredentialKey(c.env);
  const sanitizedResults = await Promise.all(
    results.map(async (row) => {
      const withEncryptedSecret = await migrateLegacyStoredSecretIfNeeded(db, row, credKey);
      return migrateLegacyIntegrationSecretIfNeeded(db, withEncryptedSecret, credKey);
    })
  );

  return ok(c, { credentials: sanitizedResults.map(toCredentialResponse) });
});

// â”€â”€ POST /properties/:propertyId/credentials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

credentials.post('/', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canCreateCredential(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invÃ¡lido', 'INVALID_BODY');

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(c, 'Dados invÃ¡lidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

  const { category, label, username, secret, notes, integration_type, integration_config, share_with_os } = parsed.data;
  const id = nanoid();
  const credKey = getCredentialKey(c.env);
  const encryptedSecret = await encryptSecret(secret, credKey);
  const {
    publicConfig: publicIntegrationConfig,
    secretPlaintext: integrationSecretPlaintext,
  } = splitCredentialIntegrationConfig(integration_config);
  const encryptedIntegrationSecret = integrationSecretPlaintext
    ? await encryptSecret(integrationSecretPlaintext, credKey)
    : null;

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
    integrationConfig: publicIntegrationConfig,
    integrationSecret: encryptedIntegrationSecret,
    shareWithOs: share_with_os ? 1 : 0,
  });

  const [row] = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(and(eq(propertyAccessCredentials.id, id), eq(propertyAccessCredentials.tenantId, tenantId), eq(propertyAccessCredentials.propertyId, propertyId), isNull(propertyAccessCredentials.deletedAt)))
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

// â”€â”€ GET /properties/:propertyId/credentials/:credId/secret â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Blocked to prevent cache/log/preload exposure of credential secrets.

credentials.get('/:credId/secret', async (c) => {
  c.header('Allow', 'POST');
  return c.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, 405);
});

// â”€â”€ POST /properties/:propertyId/credentials/:credId/reveal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

credentials.post('/:credId/reveal', revealCredentialSecret);

// Backward-compatible alias while consumers migrate to /reveal.
credentials.post('/:credId/secret/reveal', revealCredentialSecret);

// â”€â”€ PUT /properties/:propertyId/credentials/:credId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

credentials.put('/:credId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canUpdateCredential(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => null);
  if (!body) return err(c, 'Body invÃ¡lido', 'INVALID_BODY');

  const parsed = createSchema.partial().safeParse(body);
  if (!parsed.success) return err(c, 'Dados invÃ¡lidos', 'VALIDATION_ERROR', 422, parsed.error.flatten());

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
  if (!existing) return err(c, 'Credencial nÃ£o encontrada', 'NOT_FOUND', 404);

  const { category, label, username, secret, notes, integration_type, integration_config, share_with_os } = parsed.data;
  const credKey = getCredentialKey(c.env);

  const patch: Partial<typeof propertyAccessCredentials.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (category !== undefined) patch.category = category;
  if (label !== undefined) patch.label = label;
  if (username !== undefined) patch.username = username ?? null;
  if (secret !== undefined) patch.secret = await encryptSecret(secret, credKey);
  if (notes !== undefined) patch.notes = notes ?? null;
  if (integration_type !== undefined) patch.integrationType = integration_type ?? null;
  if (integration_type === null) {
    patch.integrationConfig = null;
    patch.integrationSecret = null;
  }
  if (integration_config !== undefined) {
    if (integration_config === null) {
      patch.integrationConfig = null;
      patch.integrationSecret = null;
    } else {
      const {
        publicConfig: publicIntegrationConfig,
        secretPlaintext: integrationSecretPlaintext,
      } = splitCredentialIntegrationConfig(integration_config);
      patch.integrationConfig = publicIntegrationConfig;
      if (integrationSecretPlaintext !== null) {
        patch.integrationSecret = await encryptSecret(integrationSecretPlaintext, credKey);
      }
    }
  }
  if (share_with_os !== undefined) patch.shareWithOs = share_with_os ? 1 : 0;

  await db
    .update(propertyAccessCredentials)
    .set(patch)
    .where(and(eq(propertyAccessCredentials.id, credId), eq(propertyAccessCredentials.tenantId, tenantId), eq(propertyAccessCredentials.propertyId, propertyId), isNull(propertyAccessCredentials.deletedAt)));

  const [row] = await db
    .select(credentialSelect)
    .from(propertyAccessCredentials)
    .where(and(eq(propertyAccessCredentials.id, credId), eq(propertyAccessCredentials.tenantId, tenantId), eq(propertyAccessCredentials.propertyId, propertyId), isNull(propertyAccessCredentials.deletedAt)))
    .limit(1) as CredentialRecord[];

  if (!row) return err(c, 'Credencial nÃ£o encontrada', 'NOT_FOUND', 404);

  const withEncryptedSecret = await migrateLegacyStoredSecretIfNeeded(db, row, credKey);
  const sanitizedRow = await migrateLegacyIntegrationSecretIfNeeded(db, withEncryptedSecret, credKey);

  await writeAuditLog(c.env.DB, {
    tenantId,
    propertyId,
    entityType: 'property_access_credential',
    entityId: sanitizedRow.id,
    action: 'credential_updated',
    actorId: userId,
    actorIp: c.req.header('CF-Connecting-IP'),
    oldData: credentialAuditData(propertyId, existing, userId),
    newData: {
      ...credentialAuditData(propertyId, sanitizedRow, userId),
      changed_fields: Object.keys(parsed.data).filter((field) => field !== 'secret'),
      secret_changed: secret !== undefined,
      integration_secret_changed: integration_config !== undefined && splitCredentialIntegrationConfig(integration_config).secretPlaintext !== null,
    },
  });

  return ok(c, { credential: toCredentialResponse(sanitizedRow) });
});

// â”€â”€ DELETE /properties/:propertyId/credentials/:credId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

credentials.delete('/:credId', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canDeleteCredential(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
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

// â”€â”€ POST /properties/:propertyId/credentials/:credId/generate-temp-code â”€â”€â”€â”€â”€â”€
// Intelbras smart lock: generate a temporary PIN (stub â€” real call done client-side
// or via a dedicated worker; here we demonstrate the flow).

credentials.post('/:credId/generate-temp-code', async (c) => {
  const db = getDb(c.env.DB);
  const propertyId = c.req.param('propertyId')!;
  const credId = c.req.param('credId')!;
  const userId = c.get('userId');
  const tenantId = c.get('tenantId') as string;
  const role = c.get('userRole');

  const hasAccess = await canGenerateTemporaryCredentialAccess(c.env.DB, { propertyId, userId, role, tenantId, tenantRole: c.get('tenantRole') });
  if (!hasAccess) return err(c, 'Sem acesso', 'FORBIDDEN', 403);

  const body = await c.req.json().catch(() => ({})) as { expires_hours?: number; provider_name?: string };
  const expiresHours = body.expires_hours ?? 24;

  // Load metadata only â€” secret is not used until real Intelbras API call is implemented
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

  if (!cred) return err(c, 'Credencial nÃ£o encontrada', 'NOT_FOUND', 404);
  if (cred.integration_type !== 'intelbras') {
    return err(c, 'Esta credencial nÃ£o tem integraÃ§Ã£o Intelbras configurada', 'INVALID_INTEGRATION', 400);
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
    note: 'PIN temporÃ¡rio gerado. Configure no painel Intelbras se necessÃ¡rio.',
  });
});

export default credentials;
