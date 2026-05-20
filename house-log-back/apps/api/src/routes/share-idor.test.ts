/**
 * Testes de isolamento IDOR — share.ts (TD-010)
 *
 * Cobre canCreateShareLink migrado para authorization.ts:
 *  - cross-tenant IDOR: propertyId pertence a outro tenant → 404
 *  - service cross-property IDOR: serviceId não pertence à property → 404
 *  - acesso negado por role insuficiente → 403
 *  - criação autorizada retorna 201 com url e expires_at
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

// ── Mocks globais ─────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../lib/jwt', () => ({
  resolveJwtSecret: vi.fn(() => 'test-secret-key-minimum-32-chars-ok'),
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'test@example.com',
    role: 'owner' as const,
  })),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../lib/token-hash', () => ({
  sha256TokenHash: vi.fn(async (t: string) => `hash-of-${t}`),
  publicTokenPlaceholder: vi.fn((id: string) => `placeholder-${id}`),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-token-32chars-padding-xxxxx'),
}));

import { getDb } from '../db/client';
import { verifyJwt } from '../lib/jwt';
import shareRouter from './share';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
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

function authedRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    ...options,
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

function membershipRow(tenantId: string, role: 'owner' | 'manager' = 'owner') {
  return { tenantId, role };
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/', shareRouter);
  return app;
}

const POST_URL = 'http://localhost/properties/prop-1/services/service-1/share-link';

function postShareLink(body: Record<string, unknown> = {}) {
  return authedRequest(POST_URL, { method: 'POST', body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-tenant IDOR: property pertence a outro tenant
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /properties/:propertyId/services/:serviceId/share-link — cross-tenant IDOR', () => {
  it('retorna 404 quando propertyId pertence a outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2ª: canAccessTenantProperty — property fetch com tenantId filter → vazia
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(postShareLink(), buildEnv());

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-property IDOR: serviceId não pertence à property
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /properties/:propertyId/services/:serviceId/share-link — cross-property IDOR', () => {
  it('retorna 404 quando serviceId não pertence à property do tenant', async () => {
    const propertyRow = { tenantId: 'tenant-a', ownerId: 'user-1', managerId: null };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant membership
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2ª: canAccessTenantProperty — property encontrada no tenant
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [propertyRow]) })),
          })),
        })
        // 3ª: canAccessTenantProperty — collaborator lookup → não é colaborador (ownerId já deu acesso)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        // 4ª: canCreateShareLink — service order fetch → vazia (pertence a outra property)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(postShareLink(), buildEnv());

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('NOT_FOUND');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Acesso negado — provider não pode criar share links (property-level FORBIDDEN)
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /properties/:propertyId/services/:serviceId/share-link — acesso insuficiente', () => {
  it('retorna 403 quando userRole é provider (bloqueado por canUseTenantPropertyAccess)', async () => {
    const propertyRow = { tenantId: 'tenant-a', ownerId: 'user-owner', managerId: null };

    // Provider JWT — providers são bloqueados antes de qualquer check de collaborador
    vi.mocked(verifyJwt).mockResolvedValueOnce({
      sub: 'user-1',
      email: 'test@example.com',
      role: 'provider' as const,
      iat: 1,
      exp: 2,
    });

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant membership — provider pode ser membro de tenant
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a', 'manager')]),
              })),
            })),
          })),
        })
        // 2ª: canAccessTenantProperty — property fetch
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [propertyRow]) })),
          })),
        })
        // 3ª: canAccessTenantProperty — collaborator lookup (isProviderRole bloqueia antes do retorno)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(postShareLink(), buildEnv());

    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('FORBIDDEN');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Criação autorizada — fluxo completo
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /properties/:propertyId/services/:serviceId/share-link — criação autorizada', () => {
  it('retorna 201 com url e expires_at quando acesso é válido', async () => {
    const propertyRow = { tenantId: 'tenant-a', ownerId: 'user-1', managerId: null };
    const serviceRow = { id: 'service-1' };
    const insertValuesSpy = vi.fn(async () => undefined);

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1ª: resolveTenant
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2ª: property fetch
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [propertyRow]) })),
          })),
        })
        // 3ª: collaborator lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        // 4ª: service order fetch — encontrada
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [serviceRow]) })),
          })),
        })
        // 5ª: check existing share link → nenhum ativo
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => []),
              })),
            })),
          })),
        }),
      insert: vi.fn(() => ({ values: insertValuesSpy })),
    } as never);

    const res = await buildApp().fetch(
      postShareLink({ expires_hours: 48 }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(typeof body.url).toBe('string');
    expect(typeof body.expires_at).toBe('string');
    expect(insertValuesSpy).toHaveBeenCalledOnce();

    const [inserted] = insertValuesSpy.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(inserted.tenantId).toBe('tenant-a');
    expect(inserted.serviceId).toBe('service-1');
  });
});
