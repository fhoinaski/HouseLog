/**
 * Testes de Fase D — P0-14: NOT NULL DDL em 19 tabelas críticas.
 *
 * Cobre:
 *  1. Consistência estrutural: todas as 19 tabelas da migration 0033
 *     estão listadas como criticalNotNullCandidate em backfill-diagnostics.
 *  2. Idempotência do backfill em dado limpo (null_tenant = 0 → 0 linhas
 *     afetadas numa segunda execução).
 *  3. Decisão de backfill para registros já preenchidos (never overwrites).
 *  4. Enforcement de tenant_id na camada de aplicação (middleware +
 *     handlers) — complementar ao DDL; garante que Fase D não regride.
 *  5. Isolamento cross-tenant permanece funcional pós-migration.
 *  6. Registros órfãos são reportados, não descartados silenciosamente.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  resolveChildTenant,
  resolvePropertyTenant,
  CRITICAL_NULLABLE_TENANT_TABLES,
  BACKFILL_STRATEGIES,
  TENANT_NOT_NULL_TABLES,
} from '../lib/backfill-diagnostics';

// ── 1. Consistência estrutural ──────────────────────────────────────────────

describe('Fase D — consistência com migration 0033', () => {
  const TABLES_IN_0033 = [
    'properties',
    'rooms',
    'inventory_items',
    'service_orders',
    'service_bids',
    'documents',
    'expenses',
    'maintenance_schedules',
    'property_collaborators',
    'property_invites',
    'service_share_links',
    'property_access_credentials',
    'service_requests',
    'bids',
    'audit_links',
    'service_messages',
    'provider_ratings',
    'pix_charges',
    'nfe_imports',
  ] as const;

  it('todas as 19 tabelas da migration 0033 estão em CRITICAL_NULLABLE_TENANT_TABLES', () => {
    for (const table of TABLES_IN_0033) {
      expect(CRITICAL_NULLABLE_TENANT_TABLES).toContain(table);
    }
  });

  it('todas as 19 tabelas da migration 0033 têm criticalNotNullCandidate = true', () => {
    for (const table of TABLES_IN_0033) {
      const strategy = BACKFILL_STRATEGIES.find((s) => s.table === table);
      expect(strategy, `estratégia não encontrada para ${table}`).toBeDefined();
      expect(strategy?.criticalNotNullCandidate, `${table} deveria ser criticalNotNullCandidate`).toBe(true);
    }
  });

  it('audit_log NÃO está em CRITICAL_NULLABLE_TENANT_TABLES (nullable intencional)', () => {
    expect(CRITICAL_NULLABLE_TENANT_TABLES).not.toContain('audit_log');
  });

  it('audit_log NÃO está em TABLES_IN_0033 (NOT NULL seria incorreto)', () => {
    expect(TABLES_IN_0033).not.toContain('audit_log' as never);
  });

  it('TENANT_NOT_NULL_TABLES cobre tabelas novas criadas já com NOT NULL', () => {
    const expectedAlreadyNotNull = [
      'technical_systems',
      'technical_points',
      'warranties',
      'renovations',
      'handover_packages',
      'handover_checklist_items',
      'document_ingestion_jobs',
    ];
    for (const table of expectedAlreadyNotNull) {
      expect(TENANT_NOT_NULL_TABLES).toContain(table);
    }
  });
});

// ── 2. Idempotência do backfill em dado limpo ───────────────────────────────

describe('Fase D — idempotência do backfill', () => {
  it('resolveChildTenant retorna already_set quando tenant já preenchido', () => {
    const result = resolveChildTenant({
      recordTenantId: 'tenant-a',
      parentTenantId: 'tenant-a',
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('already_set');
    }
  });

  it('resolveChildTenant retorna already_set mesmo se parent for diferente (nunca sobrescreve)', () => {
    const result = resolveChildTenant({
      recordTenantId: 'tenant-a',
      parentTenantId: 'tenant-b',
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('already_set');
    }
  });

  it('resolveChildTenant preenche quando registro é null e parent existe', () => {
    const result = resolveChildTenant({
      recordTenantId: null,
      parentTenantId: 'tenant-a',
    });
    expect(result.derivable).toBe(true);
    if (result.derivable) {
      expect(result.tenantId).toBe('tenant-a');
    }
  });

  it('resolveChildTenant retorna parent_null quando parent também é null (órfão)', () => {
    const result = resolveChildTenant({
      recordTenantId: null,
      parentTenantId: null,
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('parent_null');
    }
  });

  it('resolveChildTenant retorna parent_null quando parent é undefined', () => {
    const result = resolveChildTenant({
      recordTenantId: null,
      parentTenantId: undefined,
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('parent_null');
    }
  });
});

// ── 3. Decisão de backfill para properties ─────────────────────────────────

describe('Fase D — resolvePropertyTenant (properties)', () => {
  it('preenche quando owner pertence a exatamente 1 tenant ativo', () => {
    const result = resolvePropertyTenant({
      propertyTenantId: null,
      ownerActiveTenantIds: ['tenant-a'],
    });
    expect(result.derivable).toBe(true);
    if (result.derivable) {
      expect(result.tenantId).toBe('tenant-a');
    }
  });

  it('retorna ambiguous quando owner pertence a >1 tenant ativo', () => {
    const result = resolvePropertyTenant({
      propertyTenantId: null,
      ownerActiveTenantIds: ['tenant-a', 'tenant-b'],
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('ambiguous');
    }
  });

  it('retorna no_membership quando owner não tem nenhum tenant ativo', () => {
    const result = resolvePropertyTenant({
      propertyTenantId: null,
      ownerActiveTenantIds: [],
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('no_membership');
    }
  });

  it('retorna already_set quando property já tem tenant_id', () => {
    const result = resolvePropertyTenant({
      propertyTenantId: 'tenant-a',
      ownerActiveTenantIds: ['tenant-a'],
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('already_set');
    }
  });
});

// ── 4. Enforcement na camada de aplicação (middleware + handlers) ───────────

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/jwt', () => ({
  verifyJwt: vi.fn(async () => ({
    sub: 'user-1',
    email: 'u@e.com',
    role: 'owner' as const,
  })),
}));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));

import { Hono } from 'hono';
import type { Bindings, Variables } from '../lib/types';
import { getDb } from '../db/client';
import { authMiddleware, resolveTenant } from '../middleware/auth';

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
    ENVIRONMENT: 'development',
    R2_PUBLIC_URL: 'https://pub.r2.dev',
    RESEND_API_KEY: 'test-key',
    APP_URL: 'http://localhost:3000',
  };
}

function authedReq(url: string, init: RequestInit = {}) {
  return new Request(url, {
    ...init,
    headers: { Authorization: 'Bearer tok', ...(init.headers as Record<string, string> ?? {}) },
  });
}

beforeEach(() => vi.clearAllMocks());

describe('Fase D — tenant_id null não passa na camada de aplicação', () => {
  it('resolveTenant rejeita com 400 quando usuário não tem membership (simula tabela sem tenant)', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })),
      })),
    } as never);

    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.use('*', resolveTenant);
    app.get('/ping', (c) => c.json({ ok: true }));

    const res = await app.fetch(authedReq('http://localhost/ping'), buildEnv());
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(400);
    expect(body.code).toBe('TENANT_REQUIRED');
  });

  it('tenant_id é propagado do contexto autenticado — nunca do body do client', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => [{ tenantId: 'tenant-real', role: 'owner' }]),
            })),
          })),
        })),
      })),
    } as never);

    const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
    app.use('*', authMiddleware);
    app.use('*', resolveTenant);
    app.post('/check', (c) => {
      const tenantId = c.get('tenantId');
      return c.json({ tenantId });
    });

    const res = await app.fetch(
      authedReq('http://localhost/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-forged-by-client' }),
      }),
      buildEnv()
    );
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(200);
    expect(body.tenantId).toBe('tenant-real');
    expect(body.tenantId).not.toBe('tenant-forged-by-client');
  });
});

// ── 5. Relatório de órfãos ──────────────────────────────────────────────────

describe('Fase D — registro de órfãos', () => {
  it('resolveChildTenant classifica corretamente registros irresolvíveis como parent_null', () => {
    const orphans = [
      { id: 'r-1', recordTenantId: null, parentTenantId: null },
      { id: 'r-2', recordTenantId: null, parentTenantId: undefined },
    ];

    const report = orphans.map((o) => ({
      id: o.id,
      decision: resolveChildTenant({
        recordTenantId: o.recordTenantId,
        parentTenantId: o.parentTenantId,
      }),
    }));

    expect(report).toHaveLength(2);
    for (const row of report) {
      expect(row.decision.derivable).toBe(false);
      if (!row.decision.derivable) {
        expect(row.decision.reason).toBe('parent_null');
      }
    }
  });

  it('resolvePropertyTenant classifica property ambígua sem atribuir tenant aleatório', () => {
    const result = resolvePropertyTenant({
      propertyTenantId: null,
      ownerActiveTenantIds: ['tenant-x', 'tenant-y'],
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect(result.reason).toBe('ambiguous');
      expect('tenantId' in result).toBe(false);
    }
  });

  it('resolvePropertyTenant não inventa tenant para owner sem membership', () => {
    const result = resolvePropertyTenant({
      propertyTenantId: null,
      ownerActiveTenantIds: [],
    });
    expect(result.derivable).toBe(false);
    if (!result.derivable) {
      expect('tenantId' in result).toBe(false);
    }
  });
});

// ── 6. Integridade da lista de estratégias ─────────────────────────────────

describe('Fase D — invariantes de BACKFILL_STRATEGIES', () => {
  it('nenhuma estratégia tem derivationPath vazio', () => {
    for (const s of BACKFILL_STRATEGIES) {
      expect(s.derivationPath.length, `${s.table} tem derivationPath vazio`).toBeGreaterThan(0);
    }
  });

  it('todas as tabelas em BACKFILL_STRATEGIES têm nome único', () => {
    const names = BACKFILL_STRATEGIES.map((s) => s.table);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('CRITICAL_NULLABLE_TENANT_TABLES tem exatamente 19 entradas (as tabelas da migration 0033)', () => {
    expect(CRITICAL_NULLABLE_TENANT_TABLES).toHaveLength(19);
  });
});
