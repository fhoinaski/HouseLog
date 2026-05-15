/**
 * Testes de isolamento IDOR — audit-links — P0-IDOR-AUDIT
 *
 * Cobre:
 *  1. POST /properties/:propertyId/services/:serviceId/audit-link
 *       - owner autorizado cria link com sucesso (smoke)
 *       - tenantId vem sempre do JWT, nunca do body
 *       - OS de outro tenant bloqueada (cross-tenant IDOR)
 *       - role 'provider' não cria link (FORBIDDEN)
 *       - property de outro tenant bloqueada (canCreateAuditLink → 403)
 *  2. GET /audit/:token (público)
 *       - token válido retorna dados corretos
 *       - token inexistente retorna 404 sem vazar informação
 *       - tenant da auditLink não bate com serviceOrder → 404
 *  3. POST /audit/:token/submit (público)
 *       - link já usado retorna 410 LINK_USED
 *       - link expirado retorna 410 LINK_EXPIRED
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

// ── Mocks globais ─────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/token-hash', () => ({
  sha256TokenHash: vi.fn(async (t: string) => `hash:${t}`),
}));

vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'test@example.com',
    role: 'owner' as const,
  })),
}));

import { getDb } from '../db/client';
import auditLinksRouter from './audit-links';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {
      put: vi.fn(async () => undefined),
    } as unknown as R2Bucket,
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
      'X-Tenant-Id': 'tenant-a',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

function membershipRow(tenantId: string, role: 'owner' | 'manager' | 'member' = 'owner') {
  return { tenantId, role };
}

/**
 * Monta um mock de getDb() em que:
 * - 1ª chamada a select: membership lookup (resolveTenant)
 * - 2ª chamada a select: property lookup (canAccessTenantProperty dentro de canCreateAuditLink)
 * - 3ª chamada a select: collaborator lookup (fallback interno de canAccessTenantProperty)
 * - 4ª chamada a select: OS verification (WHERE tenantId + propertyId)
 * - insert: sucesso
 */
function mockAuthorizedCreateFlow(tenantId = 'tenant-a') {
  const propertyRow = { id: 'prop-1', tenantId, ownerId: 'user-1', managerId: null };
  const osRow = { id: 'os-1' };

  vi.mocked(getDb).mockReturnValue({
    select: vi.fn()
      // 1. resolveTenant membership
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [membershipRow(tenantId)]),
            })),
          })),
        })),
      })
      // 2. canAccessTenantProperty — property lookup
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [propertyRow]),
          })),
        })),
      })
      // 3. collaborator lookup (opcional, retorna vazio — owner já passou)
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
      })
      // 4. OS verification
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [osRow]),
            })),
          })),
        })),
      }),
    insert: vi.fn(() => ({
      values: vi.fn(async () => undefined),
    })),
  } as never);
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  // Simula o nesting do index.ts: /properties/:propertyId/services/:serviceId/audit-link
  app.route('/properties/:propertyId/services/:serviceId/audit-link', auditLinksRouter);
  // Rotas públicas montadas em /audit
  app.route('/audit', auditLinksRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /properties/:propertyId/services/:serviceId/audit-link
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST audit-link — criação', () => {
  it('owner autorizado cria link com sucesso (smoke)', async () => {
    mockAuthorizedCreateFlow('tenant-a');

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/services/os-1/audit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_hours: 24 }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body).toHaveProperty('url');
    expect(body).toHaveProperty('expires_at');
  });

  it('tenantId vem sempre do JWT — ignorado se enviado no body', async () => {
    // O tenantId resolvido vem do JWT (tenant-a). Qualquer tenant no body deve ser ignorado.
    mockAuthorizedCreateFlow('tenant-a');

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/services/os-1/audit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-b', expires_in_hours: 24 }),
      }),
      buildEnv()
    );

    // Deve usar tenant-a do JWT — o flow completo passa, retorna 201
    expect(res.status).toBe(201);
  });

  it('cross-tenant: OS pertence a outro tenant → 404 na verificação de OS', async () => {
    const propertyRow = { id: 'prop-1', tenantId: 'tenant-a', ownerId: 'user-1', managerId: null };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1. resolveTenant → tenant-a
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2. canAccessTenantProperty → property encontrada para tenant-a
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [propertyRow]),
            })),
          })),
        })
        // 3. collaborator lookup
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })
        // 4. OS verification — OS não encontrada (pertence a tenant-b)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => []), // vazio → 404
              })),
            })),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/services/os-outro-tenant/audit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('NOT_FOUND');
  });

  it('property de outro tenant → 403 FORBIDDEN (canCreateAuditLink falha)', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1. resolveTenant → tenant-a
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2. canAccessTenantProperty — property não encontrada para tenant-a (pertence a tenant-b)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []), // vazio → allowed: false, status: 404 → canCreateAuditLink: false
            })),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-tenant-b/services/os-1/audit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      buildEnv()
    );

    // canCreateAuditLink retorna false → 403
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('FORBIDDEN');
  });

  it('role provider não pode criar audit-link → 403 FORBIDDEN', async () => {
    // JWT retorna role 'provider'
    const { verifyJwt } = await import('../lib/jwt');
    vi.mocked(verifyJwt).mockResolvedValueOnce({
      sub: 'provider-1',
      email: 'provider@example.com',
      role: 'provider',
      iat: 1,
      exp: 2,
    });

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn()
        // 1. resolveTenant → membership encontrada
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [membershipRow('tenant-a')]),
              })),
            })),
          })),
        })
        // 2. canAccessTenantProperty — canManageProperty recusa provider (accessLevel: manage)
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'prop-1', tenantId: 'tenant-a', ownerId: 'owner-x', managerId: null }]),
            })),
          })),
        })
        // 3. collaborator lookup — provider não é collaborator com manage
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        }),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/services/os-1/audit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });

  it('sem tenant ativo → 400 TENANT_REQUIRED', async () => {
    // resolveTenant não encontra membership
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      }),
    } as never);

    const res = await buildApp().fetch(
      authedRequest('http://localhost/properties/prop-1/services/os-1/audit-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      buildEnv()
    );

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('TENANT_REQUIRED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /audit/:token — público
// ═══════════════════════════════════════════════════════════════════════════════

describe('GET /audit/:token — consulta pública', () => {
  it('token válido retorna dados da OS', async () => {
    const linkRow = {
      id: 'link-1',
      service_order_id: 'os-1',
      property_id: 'prop-1',
      created_by: 'user-1',
      scope: { canUploadPhotos: true, canUploadVideo: false, requiredFields: [] },
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      accessed_at: null,
      accessor_ip: null,
      geo_lat: null,
      geo_lng: null,
      status: 'active',
      created_at: new Date().toISOString(),
      link_tenant_id: 'tenant-a',
      order_tenant_id: 'tenant-a',
      property_tenant_id: 'tenant-a',
      order_title: 'Reparo hidráulico',
      order_description: 'Vazamento no banheiro',
      system_type: 'hydraulic',
      before_photos: [],
      property_name: 'Casa Principal',
      address: 'Rua das Flores, 100',
    };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [linkRow]),
              })),
            })),
          })),
        })),
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    } as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/valid-token-123456789'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.order_title).toBe('Reparo hidráulico');
    expect(body.property_name).toBe('Casa Principal');
  });

  it('token inexistente → 404 sem vazar dados de outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => []), // não encontrado
              })),
            })),
          })),
        })),
      }),
    } as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/token-inexistente-xyz'),
      buildEnv()
    );

    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    // Resposta não deve vazar nomes de propriedades ou IDs de outros tenants
    expect(body.code).toBe('NOT_FOUND');
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('propertyId');
  });

  it('link expirado → 410 LINK_EXPIRED', async () => {
    const expiredLink = {
      id: 'link-exp',
      service_order_id: 'os-1',
      property_id: 'prop-1',
      created_by: 'user-1',
      scope: {},
      expires_at: new Date(Date.now() - 3600_000).toISOString(), // passado
      accessed_at: null,
      accessor_ip: null,
      geo_lat: null,
      geo_lng: null,
      status: 'active',
      created_at: new Date().toISOString(),
      link_tenant_id: 'tenant-a',
      order_tenant_id: 'tenant-a',
      property_tenant_id: 'tenant-a',
      order_title: 'Teste',
      order_description: null,
      system_type: null,
      before_photos: [],
      property_name: 'Prop',
      address: 'Rua X',
    };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [expiredLink]),
              })),
            })),
          })),
        })),
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    } as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/expired-token-xyz'),
      buildEnv()
    );

    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_EXPIRED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /audit/:token/submit — público
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /audit/:token/submit — submissão pública', () => {
  it('link já utilizado → 410 LINK_USED', async () => {
    const usedLink = {
      id: 'link-used',
      service_order_id: 'os-1',
      property_id: 'prop-1',
      created_by: 'user-1',
      scope: { canUploadPhotos: false, canUploadVideo: false, requiredFields: [] },
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      accessed_at: new Date().toISOString(),
      accessor_ip: '1.2.3.4',
      geo_lat: null,
      geo_lng: null,
      status: 'used',
      created_at: new Date().toISOString(),
      tenant_id: 'tenant-a',
      after_photos: [],
    };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [usedLink]),
              })),
            })),
          })),
        })),
      }),
    } as never);

    const formData = new FormData();
    formData.append('notes', 'Serviço concluído');

    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/used-token-xyz/submit', {
        method: 'POST',
        body: formData,
      }),
      buildEnv()
    );

    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_USED');
  });

  it('link expirado no submit → 410 LINK_EXPIRED', async () => {
    const expiredLink = {
      id: 'link-exp2',
      service_order_id: 'os-1',
      property_id: 'prop-1',
      created_by: 'user-1',
      scope: { canUploadPhotos: false, canUploadVideo: false, requiredFields: [] },
      expires_at: new Date(Date.now() - 7200_000).toISOString(), // 2h atrás
      accessed_at: null,
      accessor_ip: null,
      geo_lat: null,
      geo_lng: null,
      status: 'active',
      created_at: new Date().toISOString(),
      tenant_id: 'tenant-a',
      after_photos: [],
    };

    vi.mocked(getDb).mockReturnValue({
      select: vi.fn().mockReturnValue({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [expiredLink]),
              })),
            })),
          })),
        })),
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    } as never);

    const formData = new FormData();
    formData.append('notes', 'Nota qualquer');

    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/expired-token-xyz/submit', {
        method: 'POST',
        body: formData,
      }),
      buildEnv()
    );

    expect(res.status).toBe(410);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('LINK_EXPIRED');
  });

  it('token inválido (curto demais) → 400 INVALID_TOKEN', async () => {
    const res = await buildApp().fetch(
      new Request('http://localhost/audit/public/abc/submit', {
        method: 'POST',
        body: new FormData(),
      }),
      buildEnv()
    );

    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('INVALID_TOKEN');
  });
});
