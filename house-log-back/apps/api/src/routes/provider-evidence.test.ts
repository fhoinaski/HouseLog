/**
 * Testes do endpoint POST /provider/services/:id/photos
 *
 * Cobre:
 *  1. Provider atribuído com OS em status aprovado consegue enviar foto
 *  2. Provider não atribuído recebe 404
 *  3. Cross-tenant bloqueado (OS de outro tenant retorna 404)
 *  4. Cross-property bloqueado (property de outro tenant → OS não encontrada)
 *  5. OS em status incompatível (completed) retorna 404
 *  6. R2 key nunca vaza na resposta
 *  7. Audit log não contém R2 key nem signed URL
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/r2', () => ({
  preparePrivateUpload: vi.fn(async (file: File) => ({ ok: true, buffer: await file.arrayBuffer(), mimeType: file.type, size: file.size })),
  buildR2Key: vi.fn(() => 'prop-a/photos/evidence-123.jpg'),
  uploadToR2: vi.fn(async () => undefined),
}));
vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'provider-1',
    email: 'provider@example.com',
    role: 'provider' as const,
  })),
}));
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(async () => undefined),
  emailOsStatusChanged: vi.fn(() => ({})),
  emailServiceAssigned: vi.fn(() => ({})),
}));
vi.mock('../lib/ai', () => ({
  extractLabelData: vi.fn(),
  diagnoseImage: vi.fn(),
  transcribeAudio: vi.fn(),
  classifyDocument: vi.fn(),
}));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import { buildR2Key, uploadToR2 } from '../lib/r2';
import providerRouter from './provider';

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

function authed(url: string, opts: RequestInit = {}, role: 'provider' | 'admin' = 'provider'): Request {
  return new Request(url, {
    ...opts,
    headers: {
      Authorization: 'Bearer test-token',
      'X-Mock-Role': role,
      ...((opts.headers as Record<string, string>) ?? {}),
    },
  });
}

function buildDb(
  selectCalls: unknown[][],
  extra?: {
    updateWhere?: ReturnType<typeof vi.fn>;
  }
) {
  let i = 0;

  function chain(rows: unknown[]) {
    const query = {
      where: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      leftJoin: vi.fn(() => query),
      orderBy: vi.fn(async () => rows),
      limit: vi.fn(async () => rows),
    };
    return query;
  }

  return {
    select: vi.fn(() => {
      const rows = selectCalls[i++] ?? [];
      return {
        from: vi.fn(() => chain(rows)),
      };
    }),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: extra?.updateWhere ?? vi.fn(async () => undefined),
      })),
    })),
  };
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/provider', providerRouter);
  return app;
}

function makeImageFd(): FormData {
  const fd = new FormData();
  fd.append('file', new File(['fake-image-bytes'], 'evidence.jpg', { type: 'image/jpeg' }));
  return fd;
}

function tenantRow(tenantId = 'tenant-a') {
  return { tenantId, role: 'provider' };
}

function orderRow(overrides: Partial<{
  id: string;
  property_id: string;
  assigned_to: string | null;
  deleted_at: string | null;
  status: string;
  after_photos: string[] | null;
}> = {}) {
  return {
    id: 'os-1',
    property_id: 'prop-a',
    assigned_to: 'provider-1',
    deleted_at: null,
    status: 'approved',
    after_photos: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. Provider atribuído com OS aprovada consegue enviar foto
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /provider/services/:id/photos — provider atribuído', () => {
  it('retorna 200 com url e type=after para provider atribuído com OS approved', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],       // resolveTenant
      [orderRow()],        // OS query
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-1/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { url: string; type: string };
    expect(body.type).toBe('after');
    expect(body.url).toContain('/api/v1/provider/services/os-1/media/');
    expect(uploadToR2).toHaveBeenCalledOnce();
  });

  it('retorna 200 para OS em status in_progress', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow({ status: 'in_progress' })],
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-1/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. Provider não atribuído recebe 404
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /provider/services/:id/photos — provider não atribuído', () => {
  it('retorna 404 quando provider não está atribuído à OS', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],  // resolveTenant
      [],             // OS query — nenhuma linha (assignedTo !== userId no WHERE)
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-999/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(uploadToR2).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. Cross-tenant bloqueado
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /provider/services/:id/photos — isolamento cross-tenant', () => {
  it('retorna 404 para OS pertencente a outro tenant', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow('tenant-a')],  // resolveTenant → tenant-a
      [],                        // OS query com tenantId=tenant-a → vazio (OS é do tenant-b)
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-from-tenant-b/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(uploadToR2).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4. Cross-property bloqueado (property deletada / de outro tenant)
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /provider/services/:id/photos — isolamento cross-property', () => {
  it('retorna 404 quando property pertence a outro tenant (innerJoin falha)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],  // resolveTenant
      [],              // OS innerJoin properties → sem resultado (property de outro tenant)
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-orphan/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(uploadToR2).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 5. OS em status incompatível retorna 404
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /provider/services/:id/photos — status da OS', () => {
  it('retorna 403 para OS com status completed', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow({ status: 'completed' })],
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-1/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(403);
    expect(uploadToR2).not.toHaveBeenCalled();
  });

  it('retorna 403 para OS com status requested', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow({ status: 'requested' })],
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-1/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(403);
    expect(uploadToR2).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 6. R2 key nunca vaza na resposta
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /provider/services/:id/photos — segurança da resposta', () => {
  it('resposta não contém R2 key bruta', async () => {
    const mockKey = 'prop-a/photos/evidence-123.jpg';
    vi.mocked(buildR2Key).mockReturnValue(mockKey);
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow()],
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-1/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(mockKey);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 7. Audit log não contém R2 key nem signed URL
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /provider/services/:id/photos — audit log', () => {
  it('audit log não contém R2 key nem signed URL', async () => {
    const mockKey = 'prop-a/photos/evidence-123.jpg';
    vi.mocked(buildR2Key).mockReturnValue(mockKey);
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow()],
    ]) as never);

    await buildApp().fetch(
      authed('http://localhost/provider/services/os-1/photos', { method: 'POST', body: makeImageFd() }),
      buildEnv()
    );

    expect(writeAuditLog).toHaveBeenCalledOnce();
    const [, auditPayload] = vi.mocked(writeAuditLog).mock.calls[0] as [unknown, { newData: Record<string, unknown> }];
    const newDataStr = JSON.stringify(auditPayload.newData);
    expect(newDataStr).not.toContain(mockKey);
    expect(newDataStr).not.toContain('signed');
    expect(newDataStr).not.toContain('https://');
    expect(auditPayload.newData.tenantId).toBeUndefined();
  });
});
describe('GET /provider/services/:id - evidencias privadas', () => {
  it('retorna URLs provider para evidencias sem expor R2 key bruta', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [tenantRow()],
      [orderRow({ after_photos: ['prop-a/photos/evidence-123.jpg'] })],
      [],
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/provider/services/os-1'),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { order: { after_photos: string[]; can_upload_evidence: boolean } };
    expect(body.order.after_photos).toEqual(['/api/v1/provider/services/os-1/media/prop-a%2Fphotos%2Fevidence-123.jpg']);
    expect(JSON.stringify(body)).not.toContain('"prop-a/photos/evidence-123.jpg"');
    expect(body.order.can_upload_evidence).toBe(true);
  });
});
