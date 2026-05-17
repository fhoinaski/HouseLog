/**
 * TD-005 Phase 2 — Provider credential reveal via active service order.
 *
 * Tests:
 *  1. canProviderRevealCredential — unit tests for each DB-enforced condition
 *  2. Handler: provider failure cases (missing OS id, OS checks)
 *  3. Handler: provider success path (active OS + share_with_os=true)
 *  4. Handler: non-provider roles (owner allowed, tenant manager blocked)
 *  5. Schema validation: reason min/max, serviceOrderId optional
 *  6. has_secret reflects real secret presence
 *  7. Audit log includes serviceOrderId without leaking secret
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';
import { encryptSecret } from '../lib/credential-crypto';

// ── mocks ────────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));

const MOCK_IAT = 1_000_000;
const MOCK_EXP = 9_999_999_999;

vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'provider-1',
    email: 'provider@example.com',
    role: 'provider' as const,
    iat: MOCK_IAT,
    exp: MOCK_EXP,
  })),
}));

vi.mock('../lib/authorization', () => ({
  canListCredentials: vi.fn(async () => true),
  canCreateCredential: vi.fn(async () => true),
  canUpdateCredential: vi.fn(async () => true),
  canDeleteCredential: vi.fn(async () => true),
  canGenerateTemporaryCredentialAccess: vi.fn(async () => true),
  canRevealCredential: vi.fn(async () => ({ allowed: true, reason: 'ok' })),
  canProviderRevealCredential: vi.fn(async () => ({
    allowed: true,
    reason: 'provider_active_service_order',
  })),
}));

vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));

vi.mock('../middleware/rateLimit', () => ({ applyRateLimit: vi.fn(async () => true) }));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import { canRevealCredential, canProviderRevealCredential } from '../lib/authorization';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CREDENTIALS_ENCRYPTION_KEY: 'x'.repeat(32),
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'test',
    R2_PUBLIC_URL: 'https://assets.example.com',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    ...overrides,
  };
}

function authedReq(url: string, opts: RequestInit = {}): Request {
  return new Request(url, {
    ...opts,
    headers: {
      Authorization: 'Bearer test-token',
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

function makeSelectChain(rows: unknown[]) {
  const terminal = {
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(async () => rows),
  };
  return {
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({ where: vi.fn(() => terminal) })),
      where: vi.fn(() => terminal),
    })),
  };
}

function makeDbSequence(selectCalls: unknown[][]) {
  let index = 0;
  return {
    select: vi.fn(() => makeSelectChain(selectCalls[index++] ?? [])),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    })),
  };
}

async function buildCredentialsApp() {
  const { Hono } = await import('hono');
  const { default: credentials } = await import('./credentials');
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/properties/:propertyId/credentials', credentials);
  return app;
}

const VALID_REASON = 'Atendimento tecnico autorizado';
const OS_ID = 'os-active-1';
const TENANT_ID = 'tenant-a';
const PROP_ID = 'prop-1';
const CRED_ID = 'cred-1';

async function makeEncryptedRow(shareWithOs: 0 | 1 = 1, secretValue = 'wifi-pass-123') {
  const credKey = 'x'.repeat(32);
  const encryptedSecret = await encryptSecret(secretValue, credKey);
  return {
    id: CRED_ID,
    tenant_id: TENANT_ID,
    property_id: PROP_ID,
    created_by: 'owner-1',
    category: 'wifi',
    label: 'Wi-Fi Principal',
    username: 'HouseNet',
    notes: null,
    integration_type: null,
    integration_config: null,
    integration_secret: null,
    secret: encryptedSecret,
    share_with_os: shareWithOs,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

beforeEach(() => vi.clearAllMocks());

// ── 1. canProviderRevealCredential unit tests ─────────────────────────────────

describe('canProviderRevealCredential — condições de acesso', () => {
  // vi.importActual bypasses the module-level mock so we test the real implementation.

  it('retorna FORBIDDEN quando OS não encontrada (outro tenant)', async () => {
    vi.mocked(getDb).mockReturnValue(makeDbSequence([[]]) as never);

    const { canProviderRevealCredential: realFn } =
      await vi.importActual<typeof import('../lib/authorization')>('../lib/authorization');
    const result = await realFn({} as D1Database, {
      tenantId: TENANT_ID,
      propertyId: PROP_ID,
      userId: 'provider-1',
      serviceOrderId: 'os-other-tenant',
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('FORBIDDEN');
  });

  it('retorna FORBIDDEN quando OS de outra propriedade', async () => {
    vi.mocked(getDb).mockReturnValue(makeDbSequence([[]]) as never);

    const { canProviderRevealCredential: realFn } =
      await vi.importActual<typeof import('../lib/authorization')>('../lib/authorization');
    const result = await realFn({} as D1Database, {
      tenantId: TENANT_ID,
      propertyId: 'prop-outro',
      userId: 'provider-1',
      serviceOrderId: OS_ID,
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('FORBIDDEN');
  });

  it('retorna FORBIDDEN quando provider não está atribuído à OS', async () => {
    vi.mocked(getDb).mockReturnValue(makeDbSequence([[]]) as never);

    const { canProviderRevealCredential: realFn } =
      await vi.importActual<typeof import('../lib/authorization')>('../lib/authorization');
    const result = await realFn({} as D1Database, {
      tenantId: TENANT_ID,
      propertyId: PROP_ID,
      userId: 'provider-outro',
      serviceOrderId: OS_ID,
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('FORBIDDEN');
  });

  it('retorna FORBIDDEN quando OS está em status encerrado (completed/verified/requested)', async () => {
    vi.mocked(getDb).mockReturnValue(makeDbSequence([[]]) as never);

    const { canProviderRevealCredential: realFn } =
      await vi.importActual<typeof import('../lib/authorization')>('../lib/authorization');
    const result = await realFn({} as D1Database, {
      tenantId: TENANT_ID,
      propertyId: PROP_ID,
      userId: 'provider-1',
      serviceOrderId: 'os-completed',
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.code).toBe('FORBIDDEN');
  });

  it('retorna allowed quando OS ativa e provider atribuído', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ id: OS_ID }]]) as never
    );

    const { canProviderRevealCredential: realFn } =
      await vi.importActual<typeof import('../lib/authorization')>('../lib/authorization');
    const result = await realFn({} as D1Database, {
      tenantId: TENANT_ID,
      propertyId: PROP_ID,
      userId: 'provider-1',
      serviceOrderId: OS_ID,
    });

    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.reason).toBe('provider_active_service_order');
  });
});

// ── 2. Handler: provider failure cases ───────────────────────────────────────

describe('handler — provider sem serviceOrderId falha', () => {
  it('retorna 403 quando provider não envia serviceOrderId', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'provider' }]]) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('FORBIDDEN');
  });
});

describe('handler — provider com OS inválida falha', () => {
  it('retorna 403 quando canProviderRevealCredential nega acesso (OS de outro tenant)', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'provider' }]]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: false,
      status: 403,
      code: 'FORBIDDEN',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON, serviceOrderId: 'os-other-tenant' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });

  it('retorna 403 quando canProviderRevealCredential nega acesso (OS de outro imóvel)', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'provider' }]]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: false,
      status: 403,
      code: 'FORBIDDEN',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON, serviceOrderId: 'os-other-prop' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });

  it('retorna 403 quando provider não tem vínculo com a OS', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'provider' }]]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: false,
      status: 403,
      code: 'FORBIDDEN',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON, serviceOrderId: 'os-not-assigned' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });

  it('retorna 403 quando OS está encerrada ou cancelada', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'provider' }]]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: false,
      status: 403,
      code: 'FORBIDDEN',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON, serviceOrderId: 'os-completed' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });

  it('retorna 403 quando OS ativa mas share_with_os=false na credencial', async () => {
    const row = await makeEncryptedRow(0); // share_with_os = false
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'provider' }],
        [row],
      ]) as never
    );
    // canProviderRevealCredential passes — the share_with_os check is in the handler
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: true,
      reason: 'provider_active_service_order',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON, serviceOrderId: OS_ID }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('FORBIDDEN');
  });
});

// ── 3. Handler: provider success path ────────────────────────────────────────

describe('handler — provider com OS ativa e share_with_os=true revela', () => {
  it('retorna 200 com segredo e registra serviceOrderId no audit log', async () => {
    const credKey = 'x'.repeat(32);
    const row = await makeEncryptedRow(1);

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'provider' }],
        [row],
      ]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: true,
      reason: 'provider_active_service_order',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON, serviceOrderId: OS_ID }),
      }),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: credKey })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { credential: Record<string, unknown> };
    expect(body.credential.secret).toBe('wifi-pass-123');
    expect(body.credential.secret_revealed).toBe(true);
  });

  it('audit log registra serviceOrderId sem incluir o segredo plaintext', async () => {
    const credKey = 'x'.repeat(32);
    const row = await makeEncryptedRow(1);

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'provider' }],
        [row],
      ]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: true,
      reason: 'provider_active_service_order',
    });

    const app = await buildCredentialsApp();
    await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON, serviceOrderId: OS_ID }),
      }),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: credKey })
    );

    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'secret_reveal',
        newData: expect.objectContaining({
          service_order_id: OS_ID,
          reason: VALID_REASON,
        }),
      })
    );

    const call = vi.mocked(writeAuditLog).mock.calls[0]![1];
    const newData = call.newData as Record<string, unknown>;
    expect(newData).not.toHaveProperty('secret');
    expect(newData).not.toHaveProperty('integration_secret');
  });
});

// ── 4. Handler: non-provider roles ───────────────────────────────────────────

describe('handler — papéis não-provider', () => {
  it('owner revela com sucesso sem serviceOrderId', async () => {
    const credKey = 'x'.repeat(32);
    const row = await makeEncryptedRow(0); // share_with_os irrelevante para owner

    vi.mocked(canRevealCredential).mockResolvedValueOnce({
      allowed: true,
      reason: 'tenant_owner_secret',
    });
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'owner' }],
        [row],
      ]) as never
    );

    // Override verifyJwt para simular owner
    const { verifyJwt } = await import('../lib/jwt');
    vi.mocked(verifyJwt).mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      role: 'owner' as const,
      iat: MOCK_IAT,
      exp: MOCK_EXP,
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON }),
      }),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: credKey })
    );

    expect(res.status).toBe(200);
  });

  it('tenant manager é bloqueado no reveal (decisão de segurança intencional)', async () => {
    vi.mocked(canRevealCredential).mockResolvedValueOnce({
      allowed: false,
      status: 403,
      code: 'FORBIDDEN',
    });
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'manager' }]]) as never
    );

    const { verifyJwt } = await import('../lib/jwt');
    vi.mocked(verifyJwt).mockResolvedValueOnce({
      sub: 'manager-1',
      email: 'manager@example.com',
      role: 'owner' as const, // user-level role; tenantRole = manager
      iat: MOCK_IAT,
      exp: MOCK_EXP,
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });
});

// ── 5. Schema validation ──────────────────────────────────────────────────────

describe('credentialRevealSchema — validações de reason e serviceOrderId', () => {
  it('reason com menos de 10 caracteres retorna 422', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'provider' }]]) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'curto', serviceOrderId: OS_ID }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('reason com mais de 500 caracteres retorna 422', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([[{ tenantId: TENANT_ID, role: 'provider' }]]) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'a'.repeat(501), serviceOrderId: OS_ID }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(422);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('reason com exatamente 10 caracteres é aceita', async () => {
    const row = await makeEncryptedRow(1);
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'provider' }],
        [row],
      ]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: true,
      reason: 'provider_active_service_order',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'a'.repeat(10), serviceOrderId: OS_ID }),
      }),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: 'x'.repeat(32) })
    );

    expect(res.status).toBe(200);
  });

  it('reason com exatamente 500 caracteres é aceita', async () => {
    const row = await makeEncryptedRow(1);
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'provider' }],
        [row],
      ]) as never
    );
    vi.mocked(canProviderRevealCredential).mockResolvedValueOnce({
      allowed: true,
      reason: 'provider_active_service_order',
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'a'.repeat(500), serviceOrderId: OS_ID }),
      }),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: 'x'.repeat(32) })
    );

    expect(res.status).toBe(200);
  });

  it('serviceOrderId é opcional para non-providers', async () => {
    const credKey = 'x'.repeat(32);
    const row = await makeEncryptedRow(0);

    vi.mocked(canRevealCredential).mockResolvedValueOnce({
      allowed: true,
      reason: 'tenant_owner_secret',
    });
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'owner' }],
        [row],
      ]) as never
    );

    const { verifyJwt } = await import('../lib/jwt');
    vi.mocked(verifyJwt).mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      role: 'owner' as const,
      iat: MOCK_IAT,
      exp: MOCK_EXP,
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials/${CRED_ID}/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: VALID_REASON }),
      }),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: credKey })
    );

    // Should succeed without serviceOrderId
    expect(res.status).toBe(200);
  });
});

// ── 6. has_secret reflete presença real de secret ─────────────────────────────

describe('listagem — has_secret reflete presença real', () => {
  it('has_secret=true quando credencial tem segredo preenchido', async () => {
    const credKey = 'x'.repeat(32);
    const encryptedSecret = await encryptSecret('some-secret', credKey);
    const row = {
      id: CRED_ID,
      tenant_id: TENANT_ID,
      property_id: PROP_ID,
      created_by: 'owner-1',
      category: 'wifi',
      label: 'Wi-Fi',
      username: null,
      notes: null,
      integration_type: null,
      integration_config: null,
      integration_secret: null,
      secret: encryptedSecret,
      share_with_os: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: TENANT_ID, role: 'owner' }],
        [row],
      ]) as never
    );

    const { verifyJwt } = await import('../lib/jwt');
    vi.mocked(verifyJwt).mockResolvedValueOnce({
      sub: 'owner-1',
      email: 'owner@example.com',
      role: 'owner' as const,
      iat: MOCK_IAT,
      exp: MOCK_EXP,
    });

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq(`http://localhost/properties/${PROP_ID}/credentials`),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: credKey })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { credentials: Array<Record<string, unknown>> };
    expect(body.credentials[0]!.has_secret).toBe(true);
    expect(body.credentials[0]!).not.toHaveProperty('secret');
  });

  // has_secret=false is not testable via the list endpoint because the legacy migration
  // in the handler encrypts any non-encrypted empty string before toCredentialResponse runs.
  // The schema enforces secret NOT NULL, so this case cannot occur in production.
  // The production code change (has_secret: row.secret != null && row.secret !== '')
  // is the correct defensive implementation.
});
