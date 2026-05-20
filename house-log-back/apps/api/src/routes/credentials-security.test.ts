import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';
import { encryptSecret } from '../lib/credential-crypto';

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/jwt', () => ({
  resolveJwtSecret: vi.fn(() => 'test-secret-key-minimum-32-chars-ok'),
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'owner@example.com',
    role: 'owner' as const,
  })),
}));

vi.mock('../lib/authorization', () => ({
  canListCredentials: vi.fn(async () => true),
  canCreateCredential: vi.fn(async () => true),
  canUpdateCredential: vi.fn(async () => true),
  canDeleteCredential: vi.fn(async () => true),
  canGenerateTemporaryCredentialAccess: vi.fn(async () => true),
  canRevealCredential: vi.fn(async () => ({ allowed: true, reason: 'ok' })),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../middleware/rateLimit', () => ({
  applyRateLimit: vi.fn(async () => true),
}));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';

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
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => terminal),
      })),
      where: vi.fn(() => terminal),
    })),
  };
}

function makeDbSequence(
  selectCalls: unknown[][],
  extra?: {
    insertValues?: ReturnType<typeof vi.fn>;
    updateSet?: ReturnType<typeof vi.fn>;
  }
) {
  let index = 0;

  return {
    select: vi.fn(() => makeSelectChain(selectCalls[index++] ?? [])),
    insert: vi.fn(() => ({
      values: extra?.insertValues ?? vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: extra?.updateSet ?? vi.fn(() => ({ where: vi.fn(async () => undefined) })),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('credentials security hardening', () => {
  it('cria credencial com segredo e senha de integracao criptografados', async () => {
    const insertValues = vi.fn(async () => undefined);
    const row = {
      id: 'cred-1',
      tenant_id: 'tenant-a',
      property_id: 'prop-1',
      created_by: 'user-1',
      category: 'smart_lock',
      label: 'Fechadura principal',
      username: 'ssid',
      secret: 'v1:stored-main-secret',
      notes: 'nota',
      integration_type: 'intelbras',
      integration_config: { host: 'controller.local', username: 'admin' },
      integration_secret: 'v1:stored:secret',
      share_with_os: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence(
        [
          [{ tenantId: 'tenant-a', role: 'owner' }],
          [row],
        ],
        { insertValues }
      ) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq('http://localhost/properties/prop-1/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'smart_lock',
          label: 'Fechadura principal',
          secret: 'lock-pin-123',
          integration_type: 'intelbras',
          integration_config: {
            host: 'controller.local',
            username: 'admin',
            password: 'intelbras-super-secret',
          },
        }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(insertValues).toHaveBeenCalledOnce();
    const [inserted] = insertValues.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(inserted.secret).not.toBe('lock-pin-123');
    expect(String(inserted.secret)).toMatch(/^v1:/);
    expect(inserted.integrationConfig).toEqual({
      host: 'controller.local',
      username: 'admin',
    });
    expect(inserted.integrationSecret).not.toBe('intelbras-super-secret');
    expect(String(inserted.integrationSecret)).toMatch(/^v1:/);

    const body = await res.json() as { credential: Record<string, unknown> };
    expect(body.credential.integration_config).toEqual({
      host: 'controller.local',
      username: 'admin',
    });
    expect(JSON.stringify(body)).not.toContain('intelbras-super-secret');
  });

  it('listagem nao retorna password legado no integration_config', async () => {
    const updateWhere = vi.fn(async () => undefined);
    const updateSet = vi.fn(() => ({ where: updateWhere }));

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence(
        [
          [{ tenantId: 'tenant-a', role: 'owner' }],
          [{
            id: 'cred-1',
            tenant_id: 'tenant-a',
            property_id: 'prop-1',
            created_by: 'user-1',
            category: 'smart_lock',
            label: 'Fechadura principal',
            username: 'admin',
            secret: 'legacy-main-secret',
            notes: null,
            integration_type: 'intelbras',
            integration_config: { host: 'controller.local', username: 'admin', password: 'legacy-plain' },
            integration_secret: null,
            share_with_os: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }],
        ],
        { updateSet }
      ) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq('http://localhost/properties/prop-1/credentials'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { credentials: Array<Record<string, unknown>> };
    expect(body.credentials[0]?.integration_config).toEqual({
      host: 'controller.local',
      username: 'admin',
    });
    expect(body.credentials[0]?.has_integration_secret).toBe(true);
    expect(JSON.stringify(body)).not.toContain('legacy-plain');
    expect(updateSet).toHaveBeenCalled();
  });

  it('reveal retorna segredo apenas no endpoint explicito e audita a acao', async () => {
    const credKey = 'x'.repeat(32);
    const encryptedSecret = await encryptSecret('wifi-secret-123', credKey);
    const encryptedIntegrationSecret = await encryptSecret('intelbras-secret-456', credKey);

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: 'tenant-a', role: 'owner' }],
        [{
          id: 'cred-1',
          tenant_id: 'tenant-a',
          property_id: 'prop-1',
          created_by: 'user-1',
          category: 'wifi',
          label: 'Wi-Fi principal',
          username: 'HouseNet',
          notes: null,
          integration_type: 'intelbras',
          integration_config: { host: 'controller.local', username: 'admin' },
          integration_secret: encryptedIntegrationSecret,
          secret: encryptedSecret,
          share_with_os: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      ]) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq('http://localhost/properties/prop-1/credentials/cred-1/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Atendimento tecnico agendado' }),
      }),
      buildEnv({ CREDENTIALS_ENCRYPTION_KEY: credKey })
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { credential: Record<string, unknown> };
    expect(body.credential.secret).toBe('wifi-secret-123');
    expect(body.credential.integration_secret).toBe('intelbras-secret-456');
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'secret_reveal',
        tenantId: 'tenant-a',
        propertyId: 'prop-1',
      })
    );
  });

  it('reveal cross-tenant retorna 404 sem vazar segredo', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeDbSequence([
        [{ tenantId: 'tenant-a', role: 'owner' }],
        [],
      ]) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq('http://localhost/properties/prop-1/credentials/cred-tenant-b/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Atendimento tecnico agendado' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    const raw = await res.text();
    expect(raw).not.toContain('secret');
    expect(raw).not.toContain('intelbras');
  });

  it('update recriptografa senha de integracao e nao a retorna na resposta', async () => {
    const updateSet = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const existing = {
      id: 'cred-1',
      tenant_id: 'tenant-a',
      property_id: 'prop-1',
      created_by: 'user-1',
      category: 'smart_lock',
      label: 'Fechadura principal',
      username: 'admin',
      secret: 'v1:stored-main-secret',
      notes: null,
      integration_type: 'intelbras',
      integration_config: { host: 'controller.local', username: 'admin' },
      integration_secret: null,
      share_with_os: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence(
        [
          [{ tenantId: 'tenant-a', role: 'owner' }],
          [existing],
          [{ ...existing, integration_secret: 'v1:stored:secret' }],
        ],
        { updateSet }
      ) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq('http://localhost/properties/prop-1/credentials/cred-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_type: 'intelbras',
          integration_config: {
            host: 'controller.local',
            username: 'admin',
            password: 'new-integration-secret',
          },
        }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalled();
    const [patch] = updateSet.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(patch.integrationConfig).toEqual({
      host: 'controller.local',
      username: 'admin',
    });
    expect(String(patch.integrationSecret)).toMatch(/^v1:/);

    const body = await res.json() as { credential: Record<string, unknown> };
    expect(JSON.stringify(body)).not.toContain('new-integration-secret');
  });
});
