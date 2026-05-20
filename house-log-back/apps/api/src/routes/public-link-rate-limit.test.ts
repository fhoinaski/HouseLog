import { beforeEach, describe, expect, it, vi } from 'vitest';
import auditLinks from './audit-links';
import share from './share';
import invites from './invites';
import publicHandover from './public-handover';
import { writeAuditLog } from '../lib/audit';
import { getPublicLinkRateLimitKey } from '../lib/public-link-rate-limit';
import { sha256TokenHash } from '../lib/token-hash';
import type { Bindings } from '../lib/types';

vi.mock('../db/client', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => []),
          })),
        })),
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
  })),
}));

vi.mock('../lib/audit', () => ({
  writeAuditLog: vi.fn(async () => undefined),
}));

vi.mock('../lib/jwt', () => ({
  resolveJwtSecret: vi.fn(() => 'test-secret-key-minimum-32-chars-ok'),
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'owner@example.com',
    role: 'owner' as const,
  })),
}));

function blockingKv(capturedKeys: string[]): KVNamespace {
  return {
    get: vi.fn(async (key: string) => {
      capturedKeys.push(key);
      return '999';
    }),
    put: vi.fn(async () => undefined),
  } as unknown as KVNamespace;
}

function allowingKv(capturedKeys: string[] = []): KVNamespace {
  return {
    get: vi.fn(async (key: string) => {
      capturedKeys.push(key);
      return null;
    }),
    put: vi.fn(async () => undefined),
  } as unknown as KVNamespace;
}

function buildEnv(kv: KVNamespace): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {
      put: vi.fn(async () => undefined),
    } as unknown as R2Bucket,
    KV: kv,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'development',
    R2_PUBLIC_URL: 'https://pub.r2.dev',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
  };
}

async function expectRateLimited(response: Response) {
  expect(response.status).toBe(429);
  const body = await response.json() as { code?: string; error?: string };
  expect(body.code).toBe('RATE_LIMITED');
  expect(JSON.stringify(body)).not.toContain('public-token-secret');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('public link granular rate limiting', () => {
  it('usa hash prefix na chave e nunca token plaintext', async () => {
    const tokenHash = await sha256TokenHash('public-token-secret');

    const key = getPublicLinkRateLimitKey({
      flow: 'audit',
      action: 'read',
      ip: '203.0.113.10',
      tokenHash,
    });

    expect(key).toBe(`rl:public:audit:read:203.0.113.10:${tokenHash.slice(0, 16)}`);
    expect(key).not.toContain('public-token-secret');
    expect(key).not.toContain(tokenHash);
  });

  it('limita audit link GET antes de processar token publico', async () => {
    const keys: string[] = [];
    const response = await auditLinks.fetch(
      new Request('http://localhost/public/public-token-secret', {
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      buildEnv(blockingKv(keys))
    );

    await expectRateLimited(response);
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain('public-token-secret');
    expect(vi.mocked(writeAuditLog)).not.toHaveBeenCalled();
  });

  it('limita audit link submit/upload com limite de mutacao', async () => {
    const keys: string[] = [];
    const response = await auditLinks.fetch(
      new Request('http://localhost/public/public-token-secret/submit', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      buildEnv(blockingKv(keys))
    );

    await expectRateLimited(response);
    expect(keys[0]).toContain('rl:public:audit:mutate:');
  });

  it('limita service share GET', async () => {
    const keys: string[] = [];
    const response = await share.fetch(
      new Request('http://localhost/public/share/service/public-token-secret', {
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      buildEnv(blockingKv(keys))
    );

    await expectRateLimited(response);
    expect(keys[0]).toContain('rl:public:share:read:');
  });

  it('limita service share PATCH com chave de mutacao', async () => {
    const keys: string[] = [];
    const response = await share.fetch(
      new Request('http://localhost/public/share/service/public-token-secret/status', {
        method: 'PATCH',
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      buildEnv(blockingKv(keys))
    );

    await expectRateLimited(response);
    expect(keys[0]).toContain('rl:public:share:mutate:');
  });

  it('invite GET invalido retorna resposta publica uniforme', async () => {
    const response = await invites.fetch(
      new Request('http://localhost/invite/abc', {
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      buildEnv(allowingKv())
    );

    expect(response.status).toBe(404);
    const body = await response.json() as { code?: string; error?: string };
    expect(body).toEqual({ error: 'Convite indisponivel', code: 'PUBLIC_LINK_UNAVAILABLE' });
  });

  it('handover GET respeita rate limit granular', async () => {
    const keys: string[] = [];
    const response = await publicHandover.fetch(
      new Request('http://localhost/handover/public-token-secret', {
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
      }),
      buildEnv(blockingKv(keys))
    );

    await expectRateLimited(response);
    expect(keys[0]).toContain('rl:public:handover:read:');
  });

  it('handover accept respeita rate limit granular de mutacao', async () => {
    const keys: string[] = [];
    const response = await publicHandover.fetch(
      new Request('http://localhost/handover/public-token-secret/accept', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '203.0.113.10',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acceptedByName: 'Maria',
          acceptedByEmail: 'maria@example.com',
        }),
      }),
      buildEnv(blockingKv(keys))
    );

    await expectRateLimited(response);
    expect(keys[0]).toContain('rl:public:handover:mutate:');
  });

});
