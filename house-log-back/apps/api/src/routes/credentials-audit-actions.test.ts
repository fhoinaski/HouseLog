import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

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
  updateSet: ReturnType<typeof vi.fn>
) {
  let index = 0;

  return {
    select: vi.fn(() => makeSelectChain(selectCalls[index++] ?? [])),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: updateSet,
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

describe('credential audit actions', () => {
  it('update registra audit log sem senha ou token completo', async () => {
    const updateSet = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const existing = {
      id: 'cred-1',
      property_id: 'prop-1',
      created_by: 'user-1',
      category: 'smart_lock',
      label: 'Fechadura principal',
      username: 'admin',
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
        updateSet
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
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'credential_updated',
        tenantId: 'tenant-a',
        propertyId: 'prop-1',
        entityType: 'property_access_credential',
        entityId: 'cred-1',
        actorId: 'user-1',
      })
    );
    const auditPayload = JSON.stringify(vi.mocked(writeAuditLog).mock.calls);
    expect(auditPayload).not.toContain('new-integration-secret');
    expect(auditPayload).not.toContain('password');
    expect(auditPayload).not.toContain('integrationSecret');
  });

  it('delete registra audit log sem segredo', async () => {
    const updateSet = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
    const existing = {
      id: 'cred-1',
      property_id: 'prop-1',
      created_by: 'user-1',
      category: 'wifi',
      label: 'Wi-Fi principal',
      username: 'HouseNet',
      notes: null,
      integration_type: null,
      integration_config: null,
      integration_secret: 'v1:stored:secret',
      share_with_os: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    vi.mocked(getDb).mockReturnValue(
      makeDbSequence(
        [
          [{ tenantId: 'tenant-a', role: 'owner' }],
          [existing],
        ],
        updateSet
      ) as never
    );

    const app = await buildCredentialsApp();
    const res = await app.fetch(
      authedReq('http://localhost/properties/prop-1/credentials/cred-1', {
        method: 'DELETE',
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      deletedAt: expect.any(String),
    }));
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'credential_deleted',
        tenantId: 'tenant-a',
        propertyId: 'prop-1',
        entityType: 'property_access_credential',
        entityId: 'cred-1',
        actorId: 'user-1',
      })
    );
    const auditPayload = JSON.stringify(vi.mocked(writeAuditLog).mock.calls);
    expect(auditPayload).not.toContain('v1:stored:secret');
    expect(auditPayload).not.toContain('token');
  });
});
