/**
 * Testes do endpoint POST /:propertyId/inventory/:itemId/label-ocr
 *
 * Cobre:
 *  1. Tenant sem acesso não executa OCR (403)
 *  2. Item de outro tenant retorna 404 (isolamento cross-tenant)
 *  3. Imagem com MIME inválido é rejeitada (422)
 *  4. Arquivo vazio é rejeitado (422)
 *  5. IA retorna campos com confidence — response inclui extraction
 *  6. Falha da IA retorna 503 sem quebrar o servidor
 *  7. OCR nunca salva automaticamente (update não é chamado)
 *  8. Audit log é registrado com tenantId, propertyId e actorId
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../lib/types';
import type { LabelExtractResult } from '../lib/ai';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock('../lib/r2', () => ({
  validatePrivateUpload: vi.fn(() => ({ ok: true })),
  buildR2Key: vi.fn(() => 'prop-a/inventory/1234567890.jpg'),
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
vi.mock('../lib/ai', () => ({
  extractLabelData: vi.fn(),
  diagnoseImage: vi.fn(),
  transcribeAudio: vi.fn(),
  classifyDocument: vi.fn(),
}));
vi.mock('../lib/email', () => ({
  sendEmail: vi.fn(async () => undefined),
  emailOsStatusChanged: vi.fn(() => ({})),
  emailServiceAssigned: vi.fn(() => ({})),
}));

import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import { extractLabelData } from '../lib/ai';
import inventoryRouter from './inventory';

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function membership(tenantId: string, role: 'owner' | 'manager' = 'owner') {
  return { tenantId, role };
}

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

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/properties/:propertyId/inventory', inventoryRouter);
  return app;
}

function makeImageFd(): FormData {
  const fd = new FormData();
  fd.append('file', new File(['fake-image-bytes'], 'label.jpg', { type: 'image/jpeg' }));
  return fd;
}

const goodExtraction: LabelExtractResult = {
  manufacturer: 'Bosch',
  model: 'GBH 2-28',
  serialNumber: 'SN-987654',
  capacity: '2.8 J',
  voltage: '220V',
  manufactureDate: '2023-06-01',
  warrantyUntil: '2025-06-01',
  confidence: 0.88,
  rawExtractedText: 'Bosch GBH 2-28 SN-987654 220V ...',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. Tenant sem acesso retorna 403
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /:propertyId/inventory/:itemId/label-ocr — controle de acesso', () => {
  it('retorna 403 quando usuário não tem acesso à property (assertPropertyAccess falha)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],  // resolveTenant
      [],                         // assertPropertyAccess: property not found for user → forbidden
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/label-ocr', {
        method: 'POST',
        body: makeImageFd(),
      }),
      buildEnv()
    );

    expect(res.status).toBe(403);
    // IA não deve ter sido chamada
    expect(extractLabelData).not.toHaveBeenCalled();
  });

  // 2. Item de outro tenant (cross-tenant isolation)
  it('retorna 404 quando item pertence a outro tenant (isolamento cross-tenant)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],                                          // resolveTenant
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],  // assertPropertyAccess: property
      [],                                                                 // assertPropertyAccess: collaborator
      [],                                                                 // item query → não encontrado para tenant-a
    ]) as never);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-from-tenant-b/label-ocr', {
        method: 'POST',
        body: makeImageFd(),
      }),
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(extractLabelData).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 3 + 4. Validação de arquivo
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /:propertyId/inventory/:itemId/label-ocr — validação de arquivo', () => {
  function buildDbWithAccess() {
    return buildDb([
      [membership('tenant-a')],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],                  // collaborator
      [{ id: 'item-1' }], // item found
    ]) as never;
  }

  it('rejeita MIME inválido com 422', async () => {
    vi.mocked(getDb).mockReturnValue(buildDbWithAccess());

    const fd = new FormData();
    fd.append('file', new File(['pdf-content'], 'doc.pdf', { type: 'application/pdf' }));

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/label-ocr', {
        method: 'POST',
        body: fd,
      }),
      buildEnv()
    );

    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('INVALID_FILE_TYPE');
    expect(extractLabelData).not.toHaveBeenCalled();
  });

  it('rejeita arquivo vazio com 422', async () => {
    vi.mocked(getDb).mockReturnValue(buildDbWithAccess());

    const fd = new FormData();
    fd.append('file', new File([], 'empty.jpg', { type: 'image/jpeg' }));

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/label-ocr', {
        method: 'POST',
        body: fd,
      }),
      buildEnv()
    );

    expect(res.status).toBe(422);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('EMPTY_FILE');
    expect(extractLabelData).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 5. IA retorna campos com confidence
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /:propertyId/inventory/:itemId/label-ocr — extração bem-sucedida', () => {
  it('retorna extraction com campos e confidence quando IA tem sucesso', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
      [{ id: 'item-1' }],
    ]) as never);

    vi.mocked(extractLabelData).mockResolvedValue(goodExtraction);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/label-ocr', {
        method: 'POST',
        body: makeImageFd(),
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { extraction: LabelExtractResult };
    expect(body.extraction.manufacturer).toBe('Bosch');
    expect(body.extraction.model).toBe('GBH 2-28');
    expect(body.extraction.serialNumber).toBe('SN-987654');
    expect(body.extraction.confidence).toBe(0.88);
    expect(typeof body.extraction.rawExtractedText).toBe('string');
  });

  // 7. OCR nunca salva automaticamente
  it('não chama update no DB após extração (nunca salva automaticamente)', async () => {
    const updateWhereSpy = vi.fn(async () => undefined);

    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
      [{ id: 'item-1' }],
    ], { updateWhere: updateWhereSpy }) as never);

    vi.mocked(extractLabelData).mockResolvedValue(goodExtraction);

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/label-ocr', {
        method: 'POST',
        body: makeImageFd(),
      }),
      buildEnv()
    );

    expect(res.status).toBe(200);
    // Update NÃO deve ter sido chamado — usuário deve confirmar antes
    expect(updateWhereSpy).not.toHaveBeenCalled();
  });

  // 8. Audit log é registrado
  it('registra audit log com tenantId, propertyId e actorId', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
      [{ id: 'item-1' }],
    ]) as never);

    vi.mocked(extractLabelData).mockResolvedValue(goodExtraction);

    await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/label-ocr', {
        method: 'POST',
        body: makeImageFd(),
      }),
      buildEnv()
    );

    expect(writeAuditLog).toHaveBeenCalledOnce();
    const [, auditArg] = vi.mocked(writeAuditLog).mock.calls[0] as [unknown, Record<string, unknown>];
    expect(auditArg.tenantId).toBe('tenant-a');
    expect(auditArg.propertyId).toBe('prop-a');
    expect(auditArg.actorId).toBe('user-1');
    expect(auditArg.action).toBe('label_ocr');
    expect(auditArg.entityId).toBe('item-1');
    // rawExtractedText não deve ser incluído no audit log (potencialmente longo/sensível)
    const newData = auditArg.newData as Record<string, unknown>;
    expect(newData).not.toHaveProperty('rawExtractedText');
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 6. Falha da IA retorna 503 sem quebrar o servidor
// ════════════════════════════════════════════════════════════════════════════════

describe('POST /:propertyId/inventory/:itemId/label-ocr — falha da IA', () => {
  it('retorna 503 quando extractLabelData lança exceção (IA indisponível)', async () => {
    vi.mocked(getDb).mockReturnValue(buildDb([
      [membership('tenant-a')],
      [{ tenantId: 'tenant-a', ownerId: 'user-1', managerId: null }],
      [],
      [{ id: 'item-1' }],
    ]) as never);

    vi.mocked(extractLabelData).mockRejectedValue(new Error('AI service unavailable'));

    const res = await buildApp().fetch(
      authed('http://localhost/properties/prop-a/inventory/item-1/label-ocr', {
        method: 'POST',
        body: makeImageFd(),
      }),
      buildEnv()
    );

    expect(res.status).toBe(503);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('AI_ERROR');
    // Audit log NÃO deve ter sido registrado quando IA falha (nenhum dado a auditar)
    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});
