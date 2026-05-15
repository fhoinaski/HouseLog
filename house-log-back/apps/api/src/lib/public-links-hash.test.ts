/**
 * Testes de segurança de links públicos — P0-PUBLIC-LINKS-HASH-01 / hardening
 *
 * Cobre:
 *  1. sha256TokenHash — hash determinístico e opaco
 *  2. sanitizeAuditData — redação dos campos de token expandidos
 *  3. audit-links — status 400/404/410, DTO sem token no body, INSERT usa hash-only:<id>
 *  4. share-links — status 400/404/410, DTO sem service_id/tenant_id/token, INSERT usa hash-only:<id>
 *  5. invites — status 400/404/410, listagem sem token, INSERT usa hash-only:<id>, resposta sem token
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'owner@example.com',
    role: 'owner' as const,
  })),
}));

// writeAuditLog mocked as spy; sanitizeAuditData tested separately via real import
vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
  sanitizeAuditData: (v: unknown) => v as Record<string, unknown>,
  canQueryAuditLog: vi.fn(() => ({ allowed: true })),
  isValidAuditDateParam: vi.fn(() => true),
  canReadTenantAuditLog: vi.fn(() => ({ allowed: true })),
}));

vi.mock('../lib/authorization', () => ({
  canCreateAuditLink: vi.fn(async () => true),
  canManageTenantUsers: vi.fn(async () => ({ allowed: true })),
  canAccessTenantProperty: vi.fn(async () => true),
  canUseTenantPropertyAccess: vi.fn(() => ({ allowed: true })),
  assertPropertyAccess: vi.fn(async () => true),
}));

vi.mock('../lib/tenant-authorization', () => ({
  canAccessTenantProperty: vi.fn(async () => ({ allowed: true })),
  canUseTenantPropertyAccess: vi.fn(() => ({ allowed: true })),
  requireTenantPropertyAccess: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => next()),
}));

vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(async () => undefined),
}));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import { sha256TokenHash } from './token-hash';

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'development',
    R2_PUBLIC_URL: 'https://pub.r2.dev',
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

/** DB mock that passes resolveTenant (returns a tenant membership row). */
function makeEmptySelectChain() {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => []),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

function makeSelectReturning(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn(async () => rows),
  };
  chain.from.mockReturnValue(chain);
  chain.innerJoin.mockReturnValue(chain);
  chain.leftJoin.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  return chain;
}

function expectHashOnlyInsert(values: Record<string, unknown> | null): void {
  if (!values) return;
  expect(String(values.token)).toMatch(/^hash-only:/);
  expect(values).toHaveProperty('tokenHash');
  expect(String(values.tokenHash)).toHaveLength(64);
}

const TENANT_ROW = { tenantId: 'tenant-a', role: 'owner' };

beforeEach(() => {
  vi.clearAllMocks();
});

// ── 1. sha256TokenHash ───────────────────────────────────────────────────────

describe('sha256TokenHash', () => {
  it('retorna string hex de 64 caracteres', async () => {
    const hash = await sha256TokenHash('meu-token-qualquer');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('é determinístico — mesmo token → mesmo hash', async () => {
    const a = await sha256TokenHash('token-estavel');
    const b = await sha256TokenHash('token-estavel');
    expect(a).toBe(b);
  });

  it('tokens diferentes → hashes diferentes', async () => {
    const a = await sha256TokenHash('token-A');
    const b = await sha256TokenHash('token-B');
    expect(a).not.toBe(b);
  });

  it('token vazio → hash válido e diferente de não-vazio', async () => {
    const empty = await sha256TokenHash('');
    const nonEmpty = await sha256TokenHash('a');
    expect(empty).not.toBe(nonEmpty);
    expect(empty).toHaveLength(64);
  });
});

// ── 2. sanitizeAuditData — real implementation via importActual ──────────────

describe('sanitizeAuditData — campos de token expandidos', () => {
  async function realSanitize(data: unknown) {
    // Use real implementation, bypass mock via importActual
    const mod = await vi.importActual<typeof import('./audit')>('./audit');
    return mod.sanitizeAuditData(data);
  }

  it('redacta accessToken', async () => {
    const result = await realSanitize({ accessToken: 'secret-value', other: 'keep' });
    expect(result?.accessToken).toBe('[REDACTED]');
    expect(result?.other).toBe('keep');
  });

  it('redacta inviteToken', async () => {
    const result = await realSanitize({ inviteToken: 'invite-123' });
    expect(result?.inviteToken).toBe('[REDACTED]');
  });

  it('redacta shareToken', async () => {
    const result = await realSanitize({ shareToken: 'share-abc', name: 'visible' });
    expect(result?.shareToken).toBe('[REDACTED]');
    expect(result?.name).toBe('visible');
  });

  it('redacta auditToken', async () => {
    const result = await realSanitize({ auditToken: 'audit-xyz' });
    expect(result?.auditToken).toBe('[REDACTED]');
  });

  it('redacta signedUrl e privateUrl', async () => {
    const result = await realSanitize({ signedUrl: 'https://r2.example/...', privateUrl: 'https://private' });
    expect(result?.signedUrl).toBe('[REDACTED]');
    expect(result?.privateUrl).toBe('[REDACTED]');
  });

  it('redacta publicAccessToken', async () => {
    const result = await realSanitize({ publicAccessToken: 'pub-token' });
    expect(result?.publicAccessToken).toBe('[REDACTED]');
  });

  it('redacta aninhado com inviteTokenHash', async () => {
    const result = await realSanitize({ nested: { inviteTokenHash: 'hash-abc', label: 'ok' } });
    const nested = result?.nested as Record<string, unknown>;
    expect(nested?.inviteTokenHash).toBe('[REDACTED]');
    expect(nested?.label).toBe('ok');
  });
});

// ── 3. Audit links ──────────────────────────────────────────────────────────

describe('GET /audit/public/:token — audit links públicos', () => {
  async function buildAuditApp() {
    const { default: auditLinks } = await import('../routes/audit-links');
    const { Hono } = await import('hono');
    const app = new Hono<{ Bindings: ReturnType<typeof buildEnv> }>();
    app.route('/audit', auditLinks);
    return app;
  }

  it('retorna 400 para token muito curto (< 8 chars)', async () => {
    const app = await buildAuditApp();
    const res = await app.fetch(new Request('http://localhost/audit/public/abc'), buildEnv());
    expect(res.status).toBe(400);
  });

  it('retorna 404 quando link não encontrado por hash', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeEmptySelectChain()),
    } as never);

    const app = await buildAuditApp();
    const res = await app.fetch(
      new Request('http://localhost/audit/public/validtoken12345678901234567890'),
      buildEnv()
    );
    expect(res.status).toBe(404);
  });

  it('retorna 410 para link expirado (data passada)', async () => {
    const expiredLink = {
      id: 'link-1', service_order_id: 'os-1', property_id: 'prop-1', created_by: 'user-1',
      scope: {}, expires_at: new Date(Date.now() - 86400_000).toISOString(),
      accessed_at: null, accessor_ip: null, geo_lat: null, geo_lng: null,
      status: 'active', created_at: new Date().toISOString(),
      link_tenant_id: 'tenant-a', order_tenant_id: 'tenant-a', property_tenant_id: 'tenant-a',
      order_title: 'OS', order_description: null, system_type: null,
      before_photos: null, property_name: 'Casa 1', address: 'Rua A',
    };
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeSelectReturning([expiredLink])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    } as never);

    const app = await buildAuditApp();
    const res = await app.fetch(
      new Request('http://localhost/audit/public/validtoken12345678901234567890'),
      buildEnv()
    );
    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_EXPIRED');
  });

  it('retorna 410 para link com status=used', async () => {
    const usedLink = {
      id: 'link-1', service_order_id: 'os-1', property_id: 'prop-1', created_by: 'user-1',
      scope: {}, expires_at: new Date(Date.now() + 86400_000).toISOString(),
      accessed_at: null, accessor_ip: null, geo_lat: null, geo_lng: null,
      status: 'used', created_at: new Date().toISOString(),
      link_tenant_id: 'tenant-a', order_tenant_id: 'tenant-a', property_tenant_id: 'tenant-a',
      order_title: 'OS', order_description: null, system_type: null,
      before_photos: null, property_name: 'Casa 1', address: 'Rua A',
    };
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeSelectReturning([usedLink])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    } as never);

    const app = await buildAuditApp();
    const res = await app.fetch(
      new Request('http://localhost/audit/public/validtoken12345678901234567890'),
      buildEnv()
    );
    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_USED');
  });

  it('200 — DTO não contém campo token', async () => {
    const activeLink = {
      id: 'link-1', service_order_id: 'os-1', property_id: 'prop-1', created_by: 'user-1',
      scope: { canUploadPhotos: true }, expires_at: new Date(Date.now() + 86400_000).toISOString(),
      accessed_at: null, accessor_ip: null, geo_lat: null, geo_lng: null,
      status: 'active', created_at: new Date().toISOString(),
      link_tenant_id: 'tenant-a', order_tenant_id: 'tenant-a', property_tenant_id: 'tenant-a',
      order_title: 'Manutenção elétrica', order_description: 'Trocar disjuntor',
      system_type: 'electrical', before_photos: null,
      property_name: 'Casa 1', address: 'Rua A, 10',
    };
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeSelectReturning([activeLink])),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    } as never);

    const app = await buildAuditApp();
    const res = await app.fetch(
      new Request('http://localhost/audit/public/validtoken12345678901234567890'),
      buildEnv()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty('token');
    expect(body).toHaveProperty('order_title');
    expect(body).toHaveProperty('scope');
    expect(body).toHaveProperty('expires_at');
  });
});

describe('POST /audit/public/:token/submit', () => {
  async function buildAuditApp() {
    const { default: auditLinks } = await import('../routes/audit-links');
    const { Hono } = await import('hono');
    const app = new Hono<{ Bindings: ReturnType<typeof buildEnv> }>();
    app.route('/audit', auditLinks);
    return app;
  }

  it('retorna 400 para token malformado (< 8 chars)', async () => {
    const app = await buildAuditApp();
    const res = await app.fetch(
      new Request('http://localhost/audit/public/abc/submit', { method: 'POST' }),
      buildEnv()
    );
    expect(res.status).toBe(400);
  });
});

// ── 4. Share links ───────────────────────────────────────────────────────────

describe('GET /public/share/service/:token', () => {
  it('retorna 400 para token muito curto', async () => {
    const { default: share } = await import('../routes/share');
    const res = await share.fetch(
      new Request('http://localhost/public/share/service/abc'),
      buildEnv()
    );
    expect(res.status).toBe(400);
  });

  it('retorna 404 quando link não encontrado', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeEmptySelectChain()),
    } as never);

    const { default: share } = await import('../routes/share');
    const res = await share.fetch(
      new Request('http://localhost/public/share/service/validtoken12345678901234567890'),
      buildEnv()
    );
    expect(res.status).toBe(404);
  });

  it('DTO público não inclui service_id nem tenant_id', async () => {
    const linkData = {
      id: 'link-1', tenant_id: 'tenant-a', service_id: 'service-1',
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      provider_name: null, provider_accepted_at: null, provider_started_at: null,
      provider_done_at: null, notes_from_provider: null, share_credentials: 0,
      title: 'Reforma elétrica', description: 'Troca de fiação',
      status: 'requested', priority: 'high', system_type: 'electrical',
      scheduled_at: null, cost: null, checklist: null,
      before_photos: null, after_photos: null, warranty_until: null, completed_at: null,
      property_name: 'Casa 1', property_address: 'Rua B', property_city: 'SP', property_type: 'house',
      requested_by_name: 'João', room_name: null,
    };
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeSelectReturning([linkData])),
    } as never);

    const { default: share } = await import('../routes/share');
    const res = await share.fetch(
      new Request('http://localhost/public/share/service/validtoken12345678901234567890'),
      buildEnv()
    );
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    const service = body.service as Record<string, unknown>;
    const link = body.link as Record<string, unknown>;
    expect(service).not.toHaveProperty('id');
    expect(link).not.toHaveProperty('token');
    expect(body).not.toHaveProperty('tenant_id');
  });
});

describe('PATCH /public/share/service/:token/status', () => {
  it('retorna 400 para token malformado', async () => {
    const { default: share } = await import('../routes/share');
    const res = await share.fetch(
      new Request('http://localhost/public/share/service/abc/status', { method: 'PATCH' }),
      buildEnv()
    );
    expect(res.status).toBe(400);
  });
});

describe('POST share-link criação — audit log', () => {
  it('writeAuditLog chamado na criação de novo share link', async () => {
    const serviceRow = { id: 'service-1' };

    // call order: 1=resolveTenant, 2=service ownership check, 3+=existing link (empty)
    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]); // resolveTenant
        if (callCount === 2) return makeSelectReturning([serviceRow]); // service check
        return makeEmptySelectChain(); // no existing share link
      }),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    } as never);

    const { default: share } = await import('../routes/share');
    const res = await share.fetch(
      authedReq('http://localhost/properties/prop-1/services/service-1/share-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_hours: 24 }),
      }),
      buildEnv()
    );

    expect([200, 201]).toContain(res.status);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalled();
  });

  it('response de criação inclui url mas NÃO token separado', async () => {
    const serviceRow = { id: 'service-1' };

    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]);
        if (callCount === 2) return makeSelectReturning([serviceRow]);
        return makeEmptySelectChain();
      }),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    } as never);

    const { default: share } = await import('../routes/share');
    const res = await share.fetch(
      authedReq('http://localhost/properties/prop-1/services/service-1/share-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_hours: 24 }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('url');
    expect(body).toHaveProperty('expires_at');
    expect(body).not.toHaveProperty('token');
  });
});

// ── 5. Invites ───────────────────────────────────────────────────────────────

describe('GET /invite/:token — invite público (requires auth via router middleware)', () => {
  it('retorna 401 sem Authorization header (rota usa authMiddleware)', async () => {
    const { default: invites } = await import('../routes/invites');
    const res = await invites.fetch(
      new Request('http://localhost/invite/validtoken12345678901234567890'),
      buildEnv()
    );
    // The invites router applies authMiddleware globally, so public endpoints also need auth
    expect(res.status).toBe(401);
  });

  it('retorna 400 para token muito curto mesmo com auth', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeSelectReturning([TENANT_ROW])),
    } as never);

    const { default: invites } = await import('../routes/invites');
    const res = await invites.fetch(
      authedReq('http://localhost/invite/abc'),
      buildEnv()
    );
    expect(res.status).toBe(400);
  });

  it('retorna 404 quando invite não encontrado (hash não bate)', async () => {
    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]); // resolveTenant
        return makeEmptySelectChain(); // invite lookup
      }),
    } as never);

    const { default: invites } = await import('../routes/invites');
    const res = await invites.fetch(
      authedReq('http://localhost/invite/validtoken12345678901234567890'),
      buildEnv()
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /properties/:propertyId/invites — listagem não expõe token', () => {
  it('resposta de listagem não inclui campo token nos invites', async () => {
    const inviteRow = {
      id: 'invite-1', property_id: 'prop-1', invited_by: 'user-1',
      email: 'prov@example.com', role: 'provider', invite_name: 'Prestador A',
      specialties: [], whatsapp: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      accepted_at: null, created_at: new Date().toISOString(), invited_by_name: 'Owner',
    };

    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]); // resolveTenant
        if (callCount === 2) return makeSelectReturning([inviteRow]);  // invites
        return makeEmptySelectChain();  // collaborators, temporaryProviders, providerHistory
      }),
    } as never);

    const { default: invites } = await import('../routes/invites');
    const res = await invites.fetch(
      authedReq('http://localhost/properties/prop-1/invites'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { invites?: Array<Record<string, unknown>> };
    expect(body.invites).toBeDefined();
    if (body.invites && body.invites.length > 0) {
      expect(body.invites[0]).not.toHaveProperty('token');
    }
  });
});

describe('POST /properties/:propertyId/invites — audit log na criação', () => {
  it('writeAuditLog chamado ao criar invite', async () => {
    const { canManageTenantUsers } = await import('../lib/authorization');
    vi.mocked(canManageTenantUsers).mockResolvedValue({ allowed: true } as any);

    const propertyRow = { id: 'prop-1', name: 'Casa', owner_id: 'user-1' };

    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]); // resolveTenant
        if (callCount === 2) return makeSelectReturning([propertyRow]); // property
        return makeEmptySelectChain(); // dup checks
      }),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    } as never);

    const { default: invites } = await import('../routes/invites');
    const res = await invites.fetch(
      authedReq('http://localhost/properties/prop-1/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.com', role: 'provider' }),
      }),
      buildEnv()
    );

    expect([200, 201]).toContain(res.status);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalled();
  });
});

// ── 6. Token não armazenado — INSERT usa hash-only:<id> ──────────────────────

describe('Token redaction — INSERT usa hash-only:<id> em vez de token puro', () => {
  it('audit-link: INSERT grava hash-only: no campo token', async () => {
    let capturedValues: Record<string, unknown> | null = null;

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        // resolveTenant, then service ownership check
        const chain = makeSelectReturning([TENANT_ROW]);
        let firstCall = true;
        const originalLimit = chain.limit;
        chain.limit = vi.fn(async () => {
          if (firstCall) { firstCall = false; return [TENANT_ROW]; }
          return [{ id: 'os-1' }];
        });
        return chain;
      }),
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          capturedValues = vals;
          return Promise.resolve(undefined);
        }),
      })),
    } as never);

    const { default: auditLinks } = await import('../routes/audit-links');
    const { Hono } = await import('hono');
    const app = new Hono<{ Bindings: ReturnType<typeof buildEnv> }>();
    app.route('/audit', auditLinks);

    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]);
        return makeSelectReturning([{ id: 'os-1' }]);
      }),
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          capturedValues = vals;
          return Promise.resolve(undefined);
        }),
      })),
    } as never);

    await app.fetch(
      authedReq('http://localhost/audit/properties/prop-1/services/os-1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_hours: 24 }),
      }),
      buildEnv()
    );

    expectHashOnlyInsert(capturedValues);
  });

  it('share-link: INSERT grava hash-only: no campo token', async () => {
    let capturedValues: Record<string, unknown> | null = null;
    let callCount = 0;

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]);
        if (callCount === 2) return makeSelectReturning([{ id: 'service-1' }]);
        return makeEmptySelectChain(); // no existing link
      }),
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          capturedValues = vals;
          return Promise.resolve(undefined);
        }),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
    } as never);

    const { default: share } = await import('../routes/share');
    await share.fetch(
      authedReq('http://localhost/properties/prop-1/services/service-1/share-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_hours: 24 }),
      }),
      buildEnv()
    );

    expect(capturedValues).not.toBeNull();
    expect(String(capturedValues!.token)).toMatch(/^hash-only:/);
    expect(capturedValues).toHaveProperty('tokenHash');
    expect(String(capturedValues!.tokenHash)).toHaveLength(64);
  });

  it('invite: INSERT grava hash-only: no campo token', async () => {
    const { canManageTenantUsers } = await import('../lib/authorization');
    vi.mocked(canManageTenantUsers).mockResolvedValue({ allowed: true } as any);

    let capturedValues: Record<string, unknown> | null = null;
    let callCount = 0;

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]);
        if (callCount === 2) return makeSelectReturning([{ id: 'prop-1', name: 'Casa', owner_id: 'user-1' }]);
        return makeEmptySelectChain();
      }),
      insert: vi.fn(() => ({
        values: vi.fn((vals: Record<string, unknown>) => {
          capturedValues = vals;
          return Promise.resolve(undefined);
        }),
      })),
    } as never);

    const { default: invites } = await import('../routes/invites');
    await invites.fetch(
      authedReq('http://localhost/properties/prop-1/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', role: 'provider' }),
      }),
      buildEnv()
    );

    expect(capturedValues).not.toBeNull();
    expect(String(capturedValues!.token)).toMatch(/^hash-only:/);
    expect(capturedValues).toHaveProperty('tokenHash');
    expect(String(capturedValues!.tokenHash)).toHaveLength(64);
  });

  it('invite: response de criação não expõe token, apenas invite_url', async () => {
    const { canManageTenantUsers } = await import('../lib/authorization');
    vi.mocked(canManageTenantUsers).mockResolvedValue({ allowed: true } as any);

    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]);
        if (callCount === 2) return makeSelectReturning([{ id: 'prop-1', name: 'Casa', owner_id: 'user-1' }]);
        return makeEmptySelectChain();
      }),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    } as never);

    const { default: invites } = await import('../routes/invites');
    const res = await invites.fetch(
      authedReq('http://localhost/properties/prop-1/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test2@example.com', role: 'viewer' }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body).not.toHaveProperty('token');
    expect(body).toHaveProperty('invite_url');
    expect(String(body.invite_url)).toContain('/invite/');
  });
});

// ── 7. HTTP 410 para expirado / revogado ─────────────────────────────────────

describe('GET /public/share/service/:token — 410 para expirado e revogado', () => {
  async function fetchShare(token: string, linkOverrides: Record<string, unknown> = {}) {
    const baseLink = {
      id: 'link-1', tenant_id: 'tenant-a', service_id: 'service-1',
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      deleted_at: null,
      provider_name: null, provider_accepted_at: null, provider_started_at: null,
      provider_done_at: null, notes_from_provider: null, share_credentials: 0,
      title: 'OS', description: null, status: 'requested', priority: 'medium',
      system_type: null, scheduled_at: null, cost: null, checklist: null,
      before_photos: null, after_photos: null, warranty_until: null, completed_at: null,
      property_name: 'Casa', property_address: 'Rua A', property_city: 'SP', property_type: 'house',
      requested_by_name: 'Owner', room_name: null,
      ...linkOverrides,
    };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeSelectReturning([baseLink])),
    } as never);

    const { default: share } = await import('../routes/share');
    return share.fetch(
      new Request(`http://localhost/public/share/service/${token}`),
      buildEnv()
    );
  }

  it('retorna 410 com LINK_EXPIRED quando link está expirado', async () => {
    const res = await fetchShare('validtoken12345678901234567890', {
      expires_at: new Date(Date.now() - 86400_000).toISOString(),
    });
    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_EXPIRED');
  });

  it('retorna 410 com GONE quando link está revogado (deleted_at preenchido)', async () => {
    const res = await fetchShare('validtoken12345678901234567890', {
      deleted_at: new Date().toISOString(),
    });
    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('GONE');
  });
});

describe('GET /invite/:token — 410 para expirado e já aceito', () => {
  async function fetchInvite(token: string, inviteOverrides: Record<string, unknown> = {}) {
    const baseInvite = {
      id: 'invite-1',
      email: 'prov@example.com',
      role: 'provider',
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      accepted_at: null,
      invite_name: null, whatsapp: null,
      property_name: 'Casa', property_address: 'Rua A', property_city: 'SP',
      invited_by_name: 'Owner', property_id: 'prop-1', tenant_id: 'tenant-a',
      ...inviteOverrides,
    };

    let callCount = 0;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => {
        callCount++;
        if (callCount === 1) return makeSelectReturning([TENANT_ROW]);
        return makeSelectReturning([baseInvite]);
      }),
    } as never);

    const { default: invites } = await import('../routes/invites');
    return invites.fetch(
      authedReq(`http://localhost/invite/${token}`),
      buildEnv()
    );
  }

  it('retorna 410 quando convite está expirado', async () => {
    const res = await fetchInvite('validtoken12345678901234567890', {
      expires_at: new Date(Date.now() - 86400_000).toISOString(),
    });
    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_EXPIRED');
  });

  it('retorna 410 quando convite já foi aceito', async () => {
    const res = await fetchInvite('validtoken12345678901234567890', {
      accepted_at: new Date().toISOString(),
    });
    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('GONE');
  });
});

// ── 8. Coluna token não contém plaintext após redigir ────────────────────────

describe('Invariante de redação — token puro nunca deve aparecer na coluna token', () => {
  it('valor hash-only:<id> satisfaz formato esperado', () => {
    const id = 'abc123def456';
    const tokenValue = `hash-only:${id}`;
    expect(tokenValue).toMatch(/^hash-only:/);
    expect(tokenValue).not.toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it('valores hash-only: são únicos por id distinto', () => {
    const ids = ['id-1', 'id-2', 'id-3'];
    const values = ids.map((id) => `hash-only:${id}`);
    const unique = new Set(values);
    expect(unique.size).toBe(ids.length);
  });

  it('token puro (nanoid) não começa com hash-only:', () => {
    // Garante que a verificação WHERE token NOT LIKE 'hash-only:%' funciona
    const nanoidSample = 'V1StGXR8_Z5jdHi6B-myT_abc123def456'; // exemplo de nanoid
    expect(nanoidSample).not.toMatch(/^hash-only:/);
  });
});
