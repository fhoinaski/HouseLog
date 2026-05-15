/**
 * Testes de cobertura de audit log — P0-AUDIT-COVERAGE
 *
 * Verifica que todas as ações críticas registram writeAuditLog com:
 * - tenantId presente em eventos com escopo de tenant
 * - actorId presente
 * - payload sensível não vaza (pix_key, password, etc.)
 * - ações de acesso/falha de autenticação geram evento auditável
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { writeAuditLog } from '../lib/audit';
import { getDb } from '../db/client';

// ── Mocks globais ──────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));

vi.mock('../lib/jwt', () => ({
  signJwt: vi.fn(async () => 'access-token-mock'),
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
  verifyPassword: vi.fn(async (_plain: string, _hash: string) => true),
  verifyJwt: vi.fn(async () => ({ sub: 'user-1', email: 'test@example.com', role: 'owner' })),
}));

vi.mock('../lib/refresh', () => ({
  issueRefreshToken: vi.fn(async () => ({
    token: 'jti-mock.raw-mock-token-value-48chars',
    jti: 'jti-mock',
    familyId: 'family-mock',
    expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  })),
  rotateRefreshToken: vi.fn(async () => ({
    userId: 'user-1',
    token: 'jti-rotated.raw-rotated-token-value-48chars',
    jti: 'jti-rotated',
    familyId: 'family-mock',
    expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  })),
  revokeRefreshToken: vi.fn(async () => undefined),
  revokeAllForUser: vi.fn(async () => undefined),
}));

vi.mock('../lib/totp', () => ({
  generateSecret: vi.fn(() => 'totp-secret'),
  otpauthUri: vi.fn(() => 'otpauth://totp/test'),
  totpVerify: vi.fn(async () => false),
  generateBackupCodes: vi.fn(() => []),
}));

vi.mock('../lib/provider-categories', () => ({
  normalizeProviderCategories: vi.fn((cats: string[]) => cats),
}));

vi.mock('../lib/pix', () => ({
  validatePixKey: vi.fn(() => true),
  buildBrCode: vi.fn(() => '00020126...brcode'),
}));

vi.mock('../lib/nfe', () => ({
  parseNfeXml: vi.fn(() => ({
    chaveAcesso: '12345678901234567890123456789012345678901234',
    cnpjEmitente: '12345678000195',
    nomeEmitente: 'Empresa Teste',
    valorTotal: 150.0,
    dataEmissao: '2026-05-14',
    items: [{ descricao: 'Produto A', quantidade: 1, valorUnitario: 150.0 }],
  })),
}));

vi.mock('../lib/r2', () => ({
  buildR2Key: vi.fn(({ propertyId, filename }: { propertyId: string; filename: string }) => `${propertyId}/documents/${filename}`),
  extractR2KeyFromPublicUrl: vi.fn(() => 'prop-1/documents/file.pdf'),
  validatePrivateUpload: vi.fn(() => ({ ok: true })),
  preparePrivateUpload: vi.fn(async (file: File) => ({ ok: true, buffer: await file.arrayBuffer(), mimeType: file.type, size: file.size })),
  uploadToR2: vi.fn(async () => undefined),
}));

vi.mock('../lib/r2-presigned', () => ({
  generateR2PresignedPutUrl: vi.fn(async () => 'https://r2.example.com/presigned-put'),
}));

const authState = vi.hoisted(() => ({
  userId: 'user-1',
  userRole: 'owner' as string,
  tenantId: 'tenant-1',
  tenantRole: 'owner' as string,
  propertyAccess: true,
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    c: { set: (k: string, v: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('userId', authState.userId);
    c.set('userRole', authState.userRole);
    await next();
  },
  resolveTenant: async (
    c: { set: (k: string, v: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('tenantId', authState.tenantId);
    c.set('tenantRole', authState.tenantRole);
    await next();
  },
  assertPropertyAccess: vi.fn(async () => authState.propertyAccess),
}));

vi.mock('../lib/authorization', () => ({
  canAccessProperty: vi.fn(async () => true),
  canCreateServiceRequest: vi.fn(async () => true),
  canCreateServiceOrder: vi.fn(async () => true),
  canApproveBudget: vi.fn(async () => ({ allowed: true, status: 200, code: 'OK' })),
  canSendServiceMessage: vi.fn(() => true),
  canSendInternalServiceMessage: vi.fn(() => true),
  canViewServiceMessages: vi.fn(() => true),
  canViewInternalServiceMessages: vi.fn(() => true),
  canDeleteDocument: vi.fn(async () => ({ allowed: true, status: 200, code: 'OK' })),
  canSubmitProviderProposal: vi.fn(async () => ({ allowed: true })),
}));

import type { Bindings } from '../lib/types';

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: { send: vi.fn(async () => undefined) } as unknown as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'development',
    R2_PUBLIC_URL: '',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    R2_ACCOUNT_ID: 'account-id',
    R2_BUCKET_NAME: 'houselog-assets-dev',
    R2_ACCESS_KEY_ID: 'key-id',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.userId = 'user-1';
  authState.userRole = 'owner';
  authState.tenantId = 'tenant-1';
  authState.tenantRole = 'owner';
  authState.propertyAccess = true;
});

// ── AUTH: login_failed ─────────────────────────────────────────────────────────

describe('POST /auth/login — login_failed', () => {
  it('registra login_failed quando usuário não existe — sem dados sensíveis', async () => {
    const { verifyPassword } = await import('../lib/jwt');
    vi.mocked(verifyPassword); // not reached

    const emptyDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    };
    vi.mocked(getDb).mockReturnValue(emptyDb as never);

    const auth = (await import('./auth')).default;
    const req = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
      body: JSON.stringify({ email: 'ghost@example.com', password: 'wrong' }),
    });
    const res = await auth.fetch(req, buildEnv());

    expect(res.status).toBe(401);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('login_failed');
    expect(opts.actorIp).toBe('1.2.3.4');

    // Nenhum campo sensível no payload de audit
    const payload = JSON.stringify(opts);
    expect(payload).not.toContain('wrong');
    expect(payload).not.toContain('password');
  });

  it('registra login_failed quando senha é incorreta — sem hash da senha', async () => {
    const { verifyPassword } = await import('../lib/jwt');
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const userRow = {
      id: 'user-1',
      email: 'test@example.com',
      password_hash: 'hashed:password',
    };
    const dbWithUser = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => [userRow]) })),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    };
    vi.mocked(getDb).mockReturnValue(dbWithUser as never);

    const auth = (await import('./auth')).default;
    const req = new Request('http://localhost/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrongpassword' }),
    });
    const res = await auth.fetch(req, buildEnv());

    expect(res.status).toBe(401);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('login_failed');
    expect(opts.entityId).toBe('user-1');

    // password_hash não deve vazar
    const payload = JSON.stringify(opts);
    expect(payload).not.toContain('hashed:password');
    expect(payload).not.toContain('wrongpassword');
  });
});

// ── AUTH: logout ───────────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  it('registra logout com actorId correto', async () => {
    const { verifyJwt } = await import('../lib/jwt');
    vi.mocked(verifyJwt).mockResolvedValue({ sub: 'user-1', email: 'test@example.com', role: 'owner' } as never);

    const auth = (await import('./auth')).default;
    const req = new Request('http://localhost/logout', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer valid-token',
        'CF-Connecting-IP': '5.6.7.8',
      },
    });
    const res = await auth.fetch(req, buildEnv());

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('logout');
    expect(opts.actorId).toBe('user-1');
    expect(opts.entityId).toBe('user-1');
    expect(opts.actorIp).toBe('5.6.7.8');
  });
});

// ── AUTH: token_refreshed ──────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  it('registra token_refreshed após rotação bem-sucedida', async () => {
    const { verifyJwt } = await import('../lib/jwt');
    vi.mocked(verifyJwt); // not used in this path

    const userRow = { id: 'user-1', email: 'test@example.com', role: 'owner' as const };
    const refreshDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => [userRow]) })),
        })),
      })),
    };
    vi.mocked(getDb).mockReturnValue(refreshDb as never);

    const auth = (await import('./auth')).default;
    const req = new Request('http://localhost/refresh', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '9.10.11.12',
        Cookie: 'houselog_refresh=jti-mock.raw-mock-token-value-48chars',
      },
    });
    const res = await auth.fetch(req, buildEnv());

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('token_refreshed');
    expect(opts.actorId).toBe('user-1');
    expect(opts.actorIp).toBe('9.10.11.12');

    // O token bruto nunca deve aparecer no audit
    const payload = JSON.stringify(opts);
    expect(payload).not.toContain('jti-rotated');
    expect(payload).not.toContain('raw-rotated');
  });
});

// ── FINANCE: pix_charge_created ────────────────────────────────────────────────

describe('POST /properties/:propertyId/finance/pix', () => {
  function buildFinanceApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    return import('./finance').then(({ default: financeRoute }) => {
      app.route('/properties/:propertyId/finance', financeRoute);
      return app;
    });
  }

  function createPixDb() {
    return {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: 'prop-1', tenantId: 'tenant-1' }]),
          })),
        })),
      })),
    };
  }

  it('registra pix_charge_created com tenantId e sem pix_key no payload', async () => {
    vi.mocked(getDb).mockReturnValue(createPixDb() as never);
    const app = await buildFinanceApp();

    const res = await app.fetch(
      new Request('http://localhost/properties/prop-1/finance/pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '2.3.4.5',
        },
        body: JSON.stringify({
          pix_key: '11999887766',
          pix_key_type: 'phone',
          amount_cents: 5000,
          merchant_name: 'Empresa',
          merchant_city: 'São Paulo',
          expires_in_minutes: 30,
        }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('pix_charge_created');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.propertyId).toBe('prop-1');
    expect(opts.actorId).toBe('user-1');

    // pix_key nunca deve aparecer no payload de audit
    const auditPayload = JSON.stringify(opts.newData ?? {});
    expect(auditPayload).not.toContain('11999887766');
    expect(auditPayload).not.toContain('pix_key');
  });

  it('registra pix_mark_paid com tenantId', async () => {
    const markPaidDb = {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{ id: 'prop-1' }]),
          })),
        })),
      })),
    };
    vi.mocked(getDb).mockReturnValue(markPaidDb as never);
    const app = await buildFinanceApp();

    const res = await app.fetch(
      new Request('http://localhost/properties/prop-1/finance/pix/charge-1/mark-paid', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '2.3.4.5' },
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('pix_mark_paid');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.entityId).toBe('charge-1');
  });

  it('registra nfe_imported com tenantId', async () => {
    const nfeDb = {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })), // no duplicate
          })),
        }),
    };
    vi.mocked(getDb).mockReturnValue(nfeDb as never);
    const app = await buildFinanceApp();

    const xmlPayload = '<nfeProc><NFe><infNFe Id="NFe12345678901234567890123456789012345678901234"><ide><cNF>01234567</cNF></ide></infNFe></NFe></nfeProc>';

    const res = await app.fetch(
      new Request('http://localhost/properties/prop-1/finance/nfe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '3.4.5.6',
        },
        body: JSON.stringify({ xml: xmlPayload }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('nfe_imported');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.propertyId).toBe('prop-1');
  });
});

// ── SERVICE REQUESTS: create e convert_to_service ─────────────────────────────

describe('POST /properties/:propertyId/service-requests', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    return import('./service-requests').then(({ default: route }) => {
      app.route('/properties/:propertyId/service-requests', route);
      return app;
    });
  }

  function createRequestDb(requestId: string) {
    const requestRow = {
      id: requestId,
      title: 'Vazamento',
      description: null,
      status: 'OPEN',
      mediaUrls: [],
      createdAt: new Date().toISOString(),
    };
    return {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => [requestRow]) })),
        })),
      })),
    };
  }

  it('registra create com tenantId e propertyId ao criar service_request', async () => {
    vi.mocked(getDb).mockImplementation(() => createRequestDb('req-1') as never);
    const app = await buildApp();

    const res = await app.fetch(
      new Request('http://localhost/properties/prop-1/service-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '4.5.6.7',
        },
        body: JSON.stringify({ title: 'Vazamento na pia', media: [] }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('create');
    expect(opts.entityType).toBe('service_request');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.propertyId).toBe('prop-1');
    expect(opts.actorId).toBe('user-1');
  });
});

// ── SERVICE REQUEST BIDS: bid_accepted ─────────────────────────────────────────

describe('PATCH /properties/:propertyId/service-requests/:srId/bids/:bidId/accept', () => {
  function buildBidsApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    return import('./service-request-bids').then(({ default: route }) => {
      app.route('/properties/:propertyId/service-requests/:serviceRequestId/bids', route);
      return app;
    });
  }

  function createBidsAcceptDb() {
    return {
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'prop-1', tenantId: 'tenant-1', ownerId: 'user-1', propertyName: 'Casa', propertyAddress: 'Rua A' }]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'req-1', propertyId: 'prop-1' }]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ id: 'user-1', name: 'Owner' }]),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [{
                  id: 'bid-1',
                  serviceRequestId: 'req-1',
                  providerId: 'provider-1',
                  amount: 1500,
                  scope: 'Trocar torneira',
                  status: 'PENDING',
                  providerName: 'Prestador',
                  providerEmail: 'prov@test.com',
                }]),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{
                id: 'bid-1',
                serviceRequestId: 'req-1',
                providerId: 'provider-1',
                amount: 1500,
                scope: 'Trocar torneira',
                status: 'ACCEPTED',
                updatedAt: new Date().toISOString(),
              }]),
            })),
          })),
        })
        .mockReturnValue({
          from: vi.fn(() => ({
            // count(*) query — no .limit() call; where() must be directly awaitable
            where: vi.fn(() => Object.assign(Promise.resolve([{ totalRejected: 2 }]), {
              limit: vi.fn(async () => [{ totalRejected: 2 }]),
            })),
          })),
        }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
      })),
    };
  }

  it('registra bid_accepted com tenantId e propertyId', async () => {
    vi.mocked(getDb).mockReturnValue(createBidsAcceptDb() as never);
    const app = await buildBidsApp();

    const res = await app.fetch(
      new Request('http://localhost/properties/prop-1/service-requests/req-1/bids/bid-1/accept', {
        method: 'PATCH',
        headers: { 'CF-Connecting-IP': '5.6.7.8' },
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('bid_accepted');
    expect(opts.entityId).toBe('bid-1');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.propertyId).toBe('prop-1');
    expect(opts.actorId).toBe('user-1');
  });
});

// ── MESSAGES: message_created e message_deleted ────────────────────────────────

describe('POST/DELETE /services/:serviceOrderId/messages', () => {
  function buildMessagesApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    return import('./messages').then(({ default: route }) => {
      app.route('/services', route);
      return app;
    });
  }

  function createMessagesDb(ops: { deletedRows?: number } = {}) {
    const soRow = {
      tenant_id: 'tenant-1',
      property_id: 'prop-1',
      assigned_to: null,
      requested_by: 'user-1',
      owner_id: 'user-1',
      manager_id: null,
    };
    return {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      run: vi.fn(async () => ({ meta: { changes: ops.deletedRows ?? 1 } })),
      select: vi.fn()
        .mockReturnValueOnce({
          // loadParticipants — uses innerJoin
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn(() => ({
                limit: vi.fn(async () => [soRow]),
              })),
            })),
          })),
        })
        .mockReturnValue({
          // activeBidders query — no innerJoin, no .limit(); where() must be awaitable
          from: vi.fn(() => ({
            where: vi.fn(() => Object.assign(Promise.resolve([]), {
              limit: vi.fn(async () => []),
            })),
          })),
        }),
    };
  }

  it('registra message_created com tenantId e propertyId', async () => {
    vi.mocked(getDb).mockReturnValue(createMessagesDb() as never);
    const app = await buildMessagesApp();

    const res = await app.fetch(
      new Request('http://localhost/services/so-1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': '6.7.8.9',
        },
        body: JSON.stringify({ body: 'Olá, segue o relatório.', internal: false, attachments: [] }),
      }),
      buildEnv()
    );

    expect(res.status).toBe(201);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('message_created');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.propertyId).toBe('prop-1');
    expect(opts.actorId).toBe('user-1');
  });

  it('registra message_deleted com tenantId e propertyId', async () => {
    vi.mocked(getDb).mockReturnValue(createMessagesDb() as never);
    const app = await buildMessagesApp();

    const res = await app.fetch(
      new Request('http://localhost/services/so-1/messages/msg-1', {
        method: 'DELETE',
        headers: { 'CF-Connecting-IP': '6.7.8.9' },
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('message_deleted');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.propertyId).toBe('prop-1');
    expect(opts.entityId).toBe('msg-1');
  });
});

// ── DOCUMENTS: document_downloaded ────────────────────────────────────────────

describe('GET /properties/:propertyId/documents/:id/download', () => {
  function buildDocApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    return import('./documents').then(({ default: route }) => {
      app.route('/properties/:propertyId/documents', route);
      return app;
    });
  }

  function createDownloadEnv(): Bindings {
    const fakeObject = {
      body: new ReadableStream(),
      httpEtag: 'etag-1',
      writeHttpMetadata: (headers: Headers) => {
        headers.set('content-type', 'application/pdf');
      },
    };
    return {
      ...buildEnv(),
      STORAGE: {
        get: vi.fn(async () => fakeObject),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        head: vi.fn(),
        createMultipartUpload: vi.fn(),
      } as unknown as R2Bucket,
    };
  }

  function createDownloadDb() {
    const docRow = {
      id: 'doc-1',
      file_url: 'prop-1/documents/file.pdf',
      title: 'Manual',
      service_id: 'so-1',
    };
    return {
      select: vi.fn()
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'prop-1' }]) })),
          })),
        })
        .mockReturnValueOnce({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [docRow]) })),
          })),
        })
        .mockReturnValue({
          from: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'so-1' }]) })),
          })),
        }),
    };
  }

  it('registra document_downloaded com tenantId ao servir arquivo', async () => {
    vi.mocked(getDb).mockReturnValue(createDownloadDb() as never);
    const app = await buildDocApp();

    const res = await app.fetch(
      new Request('http://localhost/properties/prop-1/documents/doc-1/download', {
        headers: { 'CF-Connecting-IP': '7.8.9.10' },
      }),
      createDownloadEnv()
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const [, opts] = vi.mocked(writeAuditLog).mock.calls[0]!;
    expect(opts.action).toBe('document_downloaded');
    expect(opts.tenantId).toBe('tenant-1');
    expect(opts.propertyId).toBe('prop-1');
    expect(opts.entityId).toBe('doc-1');
    expect(opts.actorId).toBe('user-1');
    expect(opts.actorIp).toBe('7.8.9.10');

    // R2 key nunca deve aparecer no payload
    const payload = JSON.stringify(opts);
    expect(payload).not.toContain('r2Key');
    expect(payload).not.toContain('fileUrl');
  });
});

// ── CROSS-CUTTING: tenantId obrigatório em eventos com escopo de tenant ─────────

describe('Eventos com escopo de tenant incluem tenantId', () => {
  it('pix_charge_created inclui tenantId', async () => {
    const pixDb = {
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'prop-1' }]) })),
        })),
      })),
    };
    vi.mocked(getDb).mockReturnValue(pixDb as never);

    const app = new Hono<{ Bindings: Bindings }>();
    const { default: finance } = await import('./finance');
    app.route('/properties/:propertyId/finance', finance);

    await app.fetch(
      new Request('http://localhost/properties/prop-1/finance/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pix_key: 'chave@pix.com',
          pix_key_type: 'email',
          amount_cents: 1000,
          merchant_name: 'Loja',
          merchant_city: 'RJ',
          expires_in_minutes: 60,
        }),
      }),
      buildEnv()
    );

    const calls = vi.mocked(writeAuditLog).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    for (const [, opts] of calls) {
      if (opts.entityType === 'pix_charge') {
        expect(opts.tenantId).toBeTruthy();
      }
    }
  });
});
