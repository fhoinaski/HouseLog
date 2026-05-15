/**
 * Testes de isolamento de mídia — P0-MEDIA-ISOLATION
 *
 * Cobre os requisitos de segurança R2:
 *  1. Tenant A não baixa documento do tenant B
 *  2. Tenant A não acessa evidência de serviço do tenant B
 *  3. Provider sem vínculo não acessa evidência
 *  4. Upload registra tenantId do contexto JWT (nunca do client)
 *  5. Delete valida tenantId
 *  6. Listagem filtra por tenantId
 *  7. Erro não vaza path interno do bucket
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';
import { isUuidV4 } from '../lib/id';

// ── Mocks globais ─────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/r2', () => ({
  validatePrivateUpload: vi.fn(() => ({ ok: true })),
  buildR2Key: vi.fn(() => 'prop-a/documents/1234567890.pdf'),
  uploadToR2: vi.fn(async () => undefined),
  extractR2KeyFromPublicUrl: vi.fn((url: string) => url),
  deleteFromR2: vi.fn(async () => undefined),
}));
vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'test@example.com',
    role: 'owner' as const,
  })),
}));
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(async () => undefined),
  emailOsStatusChanged: vi.fn(() => ({})),
  emailServiceAssigned: vi.fn(() => ({})),
}));

import { getDb } from '../db/client';
import documentsRouter from './documents';
import servicesRouter from './services';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEnv(overrides: Partial<Bindings> = {}): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {
      get: vi.fn(async () => null),
      put: vi.fn(async () => undefined),
      delete: vi.fn(async () => undefined),
    } as unknown as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'development',
    R2_PUBLIC_URL: '',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
    ...overrides,
  };
}

function authed(url: string, opts: RequestInit = {}): Request {
  return new Request(url, {
    ...opts,
    headers: {
      Authorization: 'Bearer test-token',
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

/** Membership row returned by resolveTenant */
function membership(tenantId: string, role: 'owner' | 'manager' = 'owner') {
  return { tenantId, role };
}

/**
 * Builds a Drizzle-like DB mock that sequences through `selectCalls` in order.
 * Handles the common Drizzle chaining patterns used in this codebase:
 *   .select().from().where().limit()
 *   .select().from().innerJoin().where().limit()
 *   .select().from().innerJoin().where().orderBy().limit()
 *   .select().from().where().orderBy().limit()
 */
function buildDb(
  selectCalls: unknown[][],
  extra?: {
    insertValues?: ReturnType<typeof vi.fn>;
    updateWhere?: ReturnType<typeof vi.fn>;
  }
) {
  let i = 0;

  function terminal(rows: unknown[]) {
    return { limit: vi.fn(async () => rows) };
  }

  function whereResult(rows: unknown[]) {
    return {
      limit: vi.fn(async () => rows),
      // orderBy must return a chainable object (not a direct Promise) so .limit() can be called on it
      orderBy: vi.fn(() => terminal(rows)),
    };
  }

  return {
    select: vi.fn(() => {
      const rows = selectCalls[i++] ?? [];
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => whereResult(rows)),
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => whereResult(rows)),
            leftJoin: vi.fn(() => ({ where: vi.fn(() => whereResult(rows)) })),
          })),
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => whereResult(rows)),
          })),
          orderBy: vi.fn(async () => rows),
          limit: vi.fn(async () => rows),
        })),
      };
    }),
    insert: vi.fn(() => ({
      values: extra?.insertValues ?? vi.fn(async () => undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: extra?.updateWhere ?? vi.fn(async () => undefined),
      })),
    })),
  };
}

beforeEach(() => { vi.clearAllMocks(); });

// ════════════════════════════════════════════════════════════════════════════════
// 1 + 7. Tenant A não baixa documento do tenant B + Erro não vaza path do bucket
// ════════════════════════════════════════════════════════════════════════════════

describe('GET /:propertyId/documents/:id/download — isolamento cross-tenant', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/documents', documentsRouter);
    return app;
  }

  it('retorna 404 quando propertyId pertence a outro tenant (tenant A vs tenant B)', async () => {
    // resolveTenant → tenant-a; ensureTenantProperty → [] (prop-b não pertence a tenant-a)
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],  // resolveTenant
      [],                         // ensureTenantProperty — prop-b não encontrada para tenant-a
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-b/documents/doc-1/download'),
      buildEnv()
    );

    expect(res.status).toBe(404);
    // Resposta de erro não deve conter path interno do bucket R2
    const raw = await res.text();
    expect(raw).not.toMatch(/r2\.dev|cloudflarestorage|\.pdf|prop-b\/documents/);
  });

  it('retorna 404 quando documento pertence a outro tenant mas property existe no tenant-a', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],                                           // resolveTenant
      [{ id: 'prop-a' }],                                                // ensureTenantProperty
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],   // assertPropertyAccess property
      [],                                                                  // assertPropertyAccess collaborator
      [],                                                                  // document query → doc não pertence ao tenant-a
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/documents/doc-from-tenant-b/download'),
      buildEnv()
    );

    expect(res.status).toBe(404);
    const raw = await res.text();
    expect(raw).not.toMatch(/r2\.dev|cloudflarestorage/);
  });

  it('retorna 404 de GET/:id sem vazar key R2 no body do erro', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ id: 'prop-a' }],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],  // collaborator
      [],  // document not found
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/documents/nonexistent'),
      buildEnv()
    );

    expect(res.status).toBe(404);
    const raw = await res.text();
    // Erro não deve expor keys R2 internas (ex: prop-a/documents/xyz.pdf)
    expect(raw).not.toMatch(/\.pdf|\.jpg|\.mp4/);
    expect(raw).not.toMatch(/r2\.dev|cloudflarestorage/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. Tenant A não acessa evidência de serviço do tenant B + prefixo de property
// ════════════════════════════════════════════════════════════════════════════════

describe('GET /:propertyId/services/:id/media/* — isolamento cross-tenant e prefixo de chave', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/services', servicesRouter);
    return app;
  }

  it('retorna 404 quando propertyId pertence a outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],  // resolveTenant
      [],                         // getTenantPropertyContext — prop-b não encontrada para tenant-a
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-b/services/svc-1/media/prop-b%2Fphotos%2F123.jpg'),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });

  it('retorna 404 quando chave R2 tem prefixo de outra property (defense-in-depth)', async () => {
    // Tenant e property corretos, mas key tem prefixo de prop-b — deve ser rejeitada
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ id: 'prop-a' }],                                                // getTenantPropertyContext
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],  // canViewServiceOrder property
      [],                                                                 // collaborator lookup
    ]) as never);

    // key começa com prop-b/ em vez de prop-a/
    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/services/svc-1/media/prop-b%2Fphotos%2F123.jpg'),
      buildEnv()
    );

    expect(res.status).toBe(404);
    // Erro não deve expor a key do bucket
    const raw = await res.text();
    expect(raw).not.toMatch(/prop-b\/photos/);
  });

  it('retorna 404 quando key pertence ao prefixo correto mas não está registrada na OS', async () => {
    const orderRow = {
      before_photos: ['prop-a/photos/other.jpg'],  // not the requested key
      after_photos: null,
      video_url: null,
      audio_url: null,
    };

    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ id: 'prop-a' }],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],  // collaborator
      [orderRow],  // service order — allowedKeys doesn't include the requested key
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/services/svc-1/media/prop-a%2Fphotos%2Fnot-in-os.jpg'),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. Provider sem vínculo não acessa evidência
// ════════════════════════════════════════════════════════════════════════════════

describe('GET /:propertyId/services/:id/media/* — provider sem vínculo', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/services', servicesRouter);
    return app;
  }

  it('retorna 403 quando usuário não tem acesso à property (provider sem vínculo)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ id: 'prop-a' }],  // getTenantPropertyContext OK
      [],                    // canViewServiceOrder — property not found for this user (not owner/manager/collaborator)
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/services/svc-1/media/prop-a%2Fphotos%2F123.jpg'),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4. Upload registra tenantId do JWT (nunca do client)
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /:propertyId/documents — upload injeta tenantId do JWT', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/documents', documentsRouter);
    return app;
  }

  it('armazena tenantId do JWT no insert; file_url no response é o endpoint autenticado', async () => {
    const insertValuesSpy = vi.fn(async () => undefined);

    const docRow = {
      id: 'doc-new',
      property_id: 'prop-a',
      service_id: null,
      type: 'contract',
      title: 'Contrato',
      file_url: 'prop-a/documents/1234567890.pdf', // raw key
      file_size: 1024,
      ocr_data: null,
      vendor_cnpj: null,
      amount: null,
      issue_date: null,
      expiry_date: null,
      uploaded_by: 'user-1',
      created_at: new Date().toISOString(),
      deleted_at: null,
    };

    // Calls para upload (em ordem de select()):
    // 0: resolveTenant (innerJoin)
    // 1: ensureTenantProperty (where)
    // 2: canUploadDocument → assertPropertyAccess: property (where)
    // 3: canUploadDocument → assertPropertyAccess: collaborator (where)
    // 4: re-fetch após insert (where)
    vi.mocked(getDb).mockReturnValue({
      ...buildDb(
        [
          [membership('tenant-a')],
          [{ id: 'prop-a' }],
          [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
          [],
          [docRow],
        ],
        { insertValues: insertValuesSpy }
      ),
    } as never);

    const fd = new FormData();
    fd.append('file', new File(['%PDF-1.4'], 'contract.pdf', { type: 'application/pdf' }));
    fd.append('meta', JSON.stringify({ type: 'contract', title: 'Contrato' }));

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/documents', { method: 'POST', body: fd }),
      buildEnv()
    );

    expect(res.status).toBe(201);

    // insert deve ter sido chamado com tenantId do JWT (não do cliente)
    expect(insertValuesSpy).toHaveBeenCalledOnce();
    const insertCalls = insertValuesSpy.mock.calls as unknown as Array<Array<Record<string, unknown>>>;
    const insertArg = insertCalls[0]?.[0] ?? {};
    expect(insertArg?.tenantId).toBe('tenant-a');
    expect(insertArg?.propertyId).toBe('prop-a');
    expect(isUuidV4(String(insertArg?.id))).toBe(true);

    // file_url no response deve ser o endpoint autenticado, não a key R2 bruta
    const body = await res.json() as { document: Record<string, unknown> };
    expect(body.document.file_url).toMatch(/^\/api\/v1\/properties\/prop-a\/documents\/doc-new\/download/);
    expect(body.document.file_url).not.toMatch(/prop-a\/documents\/.*\.pdf/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 5. Delete valida tenantId
// ════════════════════════════════════════════════════════════════════════════════

describe('DELETE /:propertyId/documents/:id — valida tenantId', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/documents', documentsRouter);
    return app;
  }

  it('retorna 404 quando documento não pertence ao tenant ativo', async () => {
    const updateWhereSpy = vi.fn(async () => undefined);

    // canDeleteDocument → assertPropertyAccess: property + collaborator
    // document lookup com tenantId=tenant-a → [] (doc pertence ao tenant-b)
    vi.mocked(getDb).mockReturnValue({
      ...buildDb(
        [
          [membership('tenant-a')],
          [{ id: 'prop-a' }],                                               // ensureTenantProperty
          [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],  // canDeleteDocument property
          [],                                                                 // collaborator
          [],                                                                 // document not found for tenant-a
        ],
        { updateWhere: updateWhereSpy }
      ),
    } as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/documents/doc-tenant-b', { method: 'DELETE' }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    // Soft-delete NÃO deve ser executado
    expect(updateWhereSpy).not.toHaveBeenCalled();
    // Erro não deve expor path do bucket
    const raw = await res.text();
    expect(raw).not.toMatch(/\.pdf|r2\.dev|cloudflarestorage/);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 6. Listagem filtra por tenantId
// ════════════════════════════════════════════════════════════════════════════════

describe('GET /:propertyId/documents — listagem filtra por tenantId', () => {
  function buildApp() {
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/properties/:propertyId/documents', documentsRouter);
    return app;
  }

  it('retorna apenas documentos do tenant ativo e file_url como endpoint autenticado', async () => {
    const docOfTenantA = {
      id: 'doc-a',
      property_id: 'prop-a',
      service_id: null,
      type: 'contract',
      title: 'Contrato Tenant A',
      file_url: 'prop-a/documents/123.pdf',  // raw R2 key stored in DB
      file_size: 1024,
      ocr_data: null,
      vendor_cnpj: null,
      amount: null,
      issue_date: null,
      expiry_date: null,
      uploaded_by: 'user-1',
      created_at: new Date().toISOString(),
      deleted_at: null,
      uploader_name: 'User A',
    };

    // Calls (em ordem):
    // 0: resolveTenant
    // 1: ensureTenantProperty
    // 2: assertPropertyAccess property
    // 3: assertPropertyAccess collaborator
    // 4: documents listing (innerJoin + where + orderBy + limit)
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ id: 'prop-a' }],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
      [docOfTenantA],
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/documents'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<Record<string, unknown>> };
    expect(body.data).toHaveLength(1);

    // file_url deve ser o endpoint autenticado (não a key bruta)
    const url = body.data[0]?.file_url as string;
    expect(url).toMatch(/^\/api\/v1\/properties\/prop-a\/documents\/doc-a\/download/);
    expect(url).not.toMatch(/prop-a\/documents\/123\.pdf/);
  });

  it('retorna 404 quando property não pertence ao tenant ativo', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],  // resolveTenant
      [],                         // ensureTenantProperty — prop-b não encontrada para tenant-a
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-b/documents'),
      buildEnv()
    );

    expect(res.status).toBe(404);
  });
});
