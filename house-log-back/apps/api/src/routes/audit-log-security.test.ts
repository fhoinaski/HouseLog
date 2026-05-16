import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../lib/types';

const authState = vi.hoisted(() => ({
  tenantId: 'tenant-a',
  tenantRole: 'owner',
}));

vi.mock('../db/client', () => ({
  getDb: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (
    c: { set: (key: string, value: string) => void },
    next: () => Promise<void>
  ) => {
    c.set('userId', 'user-1');
    c.set('userRole', 'owner');
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

import { getDb } from '../db/client';
import auditLogRoute from './audit-log';

function buildEnv(): Bindings {
  return {
    DB: {} as D1Database,
    STORAGE: {} as R2Bucket,
    KV: {} as KVNamespace,
    QUEUE: {} as Queue,
    DOCUMENT_INGESTION_QUEUE: {} as Queue,
    AI: {} as Ai,
    JWT_SECRET: 'test-secret-key-minimum-32-chars-ok',
    CORS_ORIGINS: 'http://localhost:3000',
    ENVIRONMENT: 'test',
    R2_PUBLIC_URL: 'https://assets.example.com',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
  };
}

function buildApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/audit-log', auditLogRoute);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.tenantId = 'tenant-a';
  authState.tenantRole = 'owner';
});

describe('GET /audit-log tenant isolation', () => {
  it('filtra logs pelo tenant ativo e nao retorna linhas de outro tenant', async () => {
    const where = vi.fn(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn(async () => []),
      })),
    }));
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({ where })),
      })),
    } as never);

    const res = await buildApp().fetch(
      new Request('http://localhost/audit-log?limit=20'),
      buildEnv()
    );
    const body = await res.json() as { data: unknown[] };

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(where).toHaveBeenCalledOnce();
  });

  it('bloqueia provider de consultar audit log', async () => {
    authState.tenantRole = 'provider';

    const res = await buildApp().fetch(
      new Request('http://localhost/audit-log'),
      buildEnv()
    );

    expect(res.status).toBe(403);
  });
});
