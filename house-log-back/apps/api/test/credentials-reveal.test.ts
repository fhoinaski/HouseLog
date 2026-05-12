import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import credentialsRoute from '../src/routes/credentials';
import { getDb } from '../src/db/client';
import { writeAuditLog } from '../src/lib/audit';

const authState = vi.hoisted(() => ({
  userId: 'user-1',
  userRole: 'owner' as 'admin' | 'owner' | 'provider' | 'temp_provider',
  tenantId: 'tenant-1',
  tenantRole: 'owner' as 'owner' | 'manager' | 'provider' | 'temp_provider',
}));

vi.mock('../src/db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../src/lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../src/middleware/rateLimit', () => ({
  applyRateLimit: vi.fn(async () => true),
}));

vi.mock('../src/middleware/auth', () => ({
  authMiddleware: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('userId', authState.userId);
    c.set('userRole', authState.userRole);
    await next();
  },
  resolveTenant: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('tenantId', authState.tenantId);
    c.set('tenantRole', authState.tenantRole);
    await next();
  },
}));

function buildApp() {
  const app = new Hono();
  app.route('/properties/:propertyId/credentials', credentialsRoute);
  return app;
}

function buildEnv() {
  return {
    DB: {},
    KV: {},
    JWT_SECRET: 'jwt-secret-for-tests',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  };
}

function createDb(responses: Array<Array<Record<string, unknown>>>) {
  const queue = [...responses];
  const limit = vi.fn(async () => queue.shift() ?? []);
  const orderBy = vi.fn(async () => queue.shift() ?? []);
  const where = vi.fn(() => ({ limit, orderBy }));
  const from = vi.fn(() => ({ where }));
  return { select: vi.fn(() => ({ from })) };
}

function revealRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/properties/property-1/credentials/cred-1/reveal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.20' },
    body: JSON.stringify(body),
  });
}

function listRequest() {
  return new Request('http://localhost/properties/property-1/credentials', {
    method: 'GET',
    headers: { 'CF-Connecting-IP': '203.0.113.20' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.userId = 'user-1';
  authState.userRole = 'owner';
  authState.tenantId = 'tenant-1';
  authState.tenantRole = 'owner';
});

describe('credentials secret reveal hardening', () => {
  it('bloqueia GET sem revelar segredo', async () => {
    const db = createDb([]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(new Request('http://localhost/properties/property-1/credentials/cred-1/secret', { method: 'GET' }), buildEnv());

    expect(response.status).toBe(405);
    expect(await response.json()).toMatchObject({ code: 'METHOD_NOT_ALLOWED' });
  });

  it('exige motivo no POST de revelação', async () => {
    const db = createDb([]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revealRequest({ reason: 'curto' }), buildEnv());

    expect(response.status).toBe(422);
    expect((await response.json()) as { code: string }).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('revela segredo para usuario autorizado no tenant ativo', async () => {
    const db = createDb([
      [{ tenantId: 'tenant-1', ownerId: 'user-1', managerId: null }],
      [],
      [{
        id: 'cred-1',
        property_id: 'property-1',
        created_by: 'user-1',
        category: 'wifi',
        label: 'Wi-Fi Casa',
        username: 'admin',
        notes: null,
        integration_type: null,
        integration_config: null,
        share_with_os: 0,
        created_at: '2026-05-11T10:00:00.000Z',
        updated_at: '2026-05-11T10:00:00.000Z',
        secret: 'plain-secret',
      }],
    ]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revealRequest({ reason: 'Compartilhar o acesso com a equipe' }), buildEnv());
    const body = (await response.json()) as { credential: { secret: string; secret_revealed: boolean } };

    expect(response.status).toBe(200);
    expect(body.credential.secret).toBe('plain-secret');
    expect(body.credential.secret_revealed).toBe(true);

    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledTimes(1);
    const [, auditInput] = vi.mocked(writeAuditLog).mock.calls[0] ?? [];
    expect(JSON.stringify(auditInput)).not.toContain('plain-secret');
    expect(JSON.stringify(auditInput)).not.toContain('token');
    expect(JSON.stringify(auditInput)).not.toContain('hash');
  });

  it('nega usuario sem permissao', async () => {
    authState.userRole = 'provider';
    authState.tenantRole = 'provider';
    const db = createDb([[{ tenantId: 'tenant-1', ownerId: 'owner-1', managerId: null }], []]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revealRequest({ reason: 'Motivo valido para auditoria' }), buildEnv());

    expect(response.status).toBe(403);
  });

  it('nao revela existencia de recurso de outro tenant', async () => {
    authState.tenantId = 'tenant-2';
    authState.tenantRole = 'owner';
    const db = createDb([[]]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(revealRequest({ reason: 'Motivo valido para auditoria' }), buildEnv());

    expect(response.status).toBe(404);
  });

  it('nao expõe segredo na listagem de credenciais', async () => {
    const db = createDb([
      [{ tenantId: 'tenant-1', ownerId: 'user-1', managerId: null }],
      [],
      [{
        id: 'cred-1',
        property_id: 'property-1',
        created_by: 'user-1',
        category: 'wifi',
        label: 'Wi-Fi Casa',
        username: 'admin',
        notes: null,
        integration_type: null,
        integration_config: null,
        share_with_os: 1,
        created_at: '2026-05-11T10:00:00.000Z',
        updated_at: '2026-05-11T10:00:00.000Z',
      }],
    ]);
    vi.mocked(getDb).mockReturnValue(db as never);

    const response = await buildApp().fetch(listRequest(), buildEnv());
    const body = (await response.json()) as { credentials: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(body.credentials[0]).not.toHaveProperty('secret');
    expect(body.credentials[0]).toMatchObject({ has_secret: true });
  });
});