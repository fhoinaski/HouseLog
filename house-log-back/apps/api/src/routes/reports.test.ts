import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import reportsRoute from './reports';
import { getDb } from '../db/client';
import { writeAuditLog } from '../lib/audit';
import { assertPropertyAccess } from '../middleware/auth';

// ── Auth/tenant state ─────────────────────────────────────────────────────────

const authState = vi.hoisted(() => ({
  userId: 'user-1',
  userRole: 'owner' as string,
  tenantId: 'tenant-1',
  tenantRole: 'owner' as string,
  propertyAccess: true,
}));

vi.mock('../db/client', () => ({ getDb: vi.fn() }));
vi.mock('../lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }));

vi.mock('../middleware/auth', () => ({
  authMiddleware: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('userId', authState.userId);
    c.set('userRole', authState.userRole);
    await next();
  },
  resolveTenant: async (c: { set: (k: string, v: string) => void }, next: () => Promise<void>) => {
    c.set('tenantId', authState.tenantId);
    c.set('tenantRole', authState.tenantRole);
    await next();
  },
  assertPropertyAccess: vi.fn(async () => authState.propertyAccess),
}));

// ── Universal query chain helper ──────────────────────────────────────────────
// Any chain of Drizzle-like method calls is supported; when awaited it resolves
// to `value`. Also supports .limit(n).then(r => r[0]) patterns.

function makeChain(value: unknown): Record<string, unknown> {
  function fn(..._: unknown[]): typeof proxy {
    return proxy;
  }
  const proxy: Record<string, unknown> = new Proxy(fn as unknown as Record<string, unknown>, {
    get(_, key: string | symbol) {
      if (key === 'then') {
        return (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(value).then(onFulfilled, onRejected);
      }
      if (key === 'catch') return () => Promise.resolve(value);
      return fn;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const propDetails = {
  name: 'Apartamento Central',
  type: 'apt',
  address: 'Rua B, 456',
  city: 'São Paulo',
  area_m2: 90,
  year_built: 2015,
  structure: 'alvenaria',
  floors: 1,
  health_score: 82,
};

const room = { id: 'room-1', name: 'Sala', type: 'living', floor: 0, area_m2: 24 };

const inventoryItem = {
  name: 'Tinta Branca',
  category: 'paint',
  quantity: 5,
  unit: 'L',
  warranty_until: null,
  brand: 'Suvinil',
  room_id: 'room-1',
};

const warranty = {
  title: 'Garantia da porta',
  warranty_type: 'material',
  status: 'active',
  start_date: '2025-01-01',
  end_date: '2027-01-01',
  provider_name: 'Fornecedor X',
};

const renovation = {
  title: 'Pintura sala',
  category: 'painting',
  status: 'completed',
  started_at: '2025-03-01',
  completed_at: '2025-03-15',
  contractor_name: 'Pinturas Ltda',
  cost: 1200,
};

const serviceOrder = {
  title: 'Revisão elétrica',
  system_type: 'electrical',
  status: 'completed',
  priority: 'normal',
  completed_at: '2025-04-10',
  cost: 350,
  before_photos: ['tenant-1/properties/prop-1/services/os-1/before-private.jpg'],
  after_photos: ['tenant-1/properties/prop-1/services/os-1/after-private.jpg'],
};

const document = {
  title: 'Apólice de seguro',
  type: 'insurance',
  issue_date: '2025-01-01',
  expiry_date: '2026-01-01',
};

const maintenanceSchedule = {
  title: 'Inspeção elétrica',
  system_type: 'electrical',
  frequency: 'annual',
  last_done: '2025-04-01',
  next_due: '2026-04-01',
  responsible: 'Elétrica SP',
};

function buildDb(opts: {
  propertyCheckResult?: unknown[];
  propDetails?: unknown;
  tenantName?: string;
  issuerName?: string;
} = {}) {
  const propertyCheck = opts.propertyCheckResult ?? [{ id: 'prop-1' }];
  const prop = opts.propDetails ?? propDetails;
  const tenant = { name: opts.tenantName ?? 'Construtora Horizonte' };
  const issuer = { name: opts.issuerName ?? 'Eng. Ana Lima' };

  // Sequential responses: property check → prop details → tenant → issuer →
  // rooms → inventory → warranties → renovations → service orders → documents → maintenance
  const responses: unknown[] = [
    propertyCheck,
    [prop],
    [tenant],
    [issuer],
    [room],
    [inventoryItem],
    [warranty],
    [renovation],
    [serviceOrder],
    [document],
    [maintenanceSchedule],
  ];

  const select = vi.fn(() => makeChain(responses.shift() ?? []));
  return { select, update: vi.fn(() => makeChain(undefined)) };
}

function buildEnv() {
  return { DB: {} as D1Database, APP_URL: 'https://app.houselog.local' };
}

function buildApp() {
  const app = new Hono();
  app.route('/properties/:propertyId/report', reportsRoute);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /properties/:propertyId/report/dossie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.userId = 'user-1';
    authState.tenantId = 'tenant-1';
    authState.propertyAccess = true;
  });

  it('retorna 404 quando imóvel não pertence ao tenant', async () => {
    const db = buildDb({ propertyCheckResult: [] });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('NOT_FOUND');
    expect(vi.mocked(writeAuditLog)).not.toHaveBeenCalled();
  });

  it('retorna 403 quando usuário não tem acesso ao imóvel', async () => {
    authState.propertyAccess = false;
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(403);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('FORBIDDEN');
    expect(vi.mocked(writeAuditLog)).not.toHaveBeenCalled();
  });

  it('retorna payload completo com todas as seções', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { dossie: Record<string, unknown> };
    const dossie = body.dossie;

    // Property
    expect(dossie.property).toMatchObject({ name: 'Apartamento Central', type: 'apt', city: 'São Paulo' });
    // Tenant & issuer
    expect(dossie.tenant_name).toBe('Construtora Horizonte');
    expect(dossie.issuer_name).toBe('Eng. Ana Lima');
    // generated_at present
    expect(typeof dossie.generated_at).toBe('string');
    // All sections present as arrays
    expect(Array.isArray(dossie.rooms)).toBe(true);
    expect(Array.isArray(dossie.inventory_items)).toBe(true);
    expect(Array.isArray(dossie.warranties)).toBe(true);
    expect(Array.isArray(dossie.renovations)).toBe(true);
    expect(Array.isArray(dossie.service_orders)).toBe(true);
    expect(Array.isArray(dossie.photo_evidence)).toBe(true);
    expect(Array.isArray(dossie.documents)).toBe(true);
    expect(Array.isArray(dossie.maintenance_schedules)).toBe(true);
    expect(Array.isArray(dossie.timeline)).toBe(true);
  });

  it('não expõe URLs privadas de R2 nos documentos', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { dossie: { documents: Record<string, unknown>[] } };
    const doc = body.dossie.documents[0];
    expect(doc).toBeDefined();
    expect(doc).not.toHaveProperty('file_url');
    expect(doc).not.toHaveProperty('r2_key');
    expect(doc).not.toHaveProperty('ocr_data');
    // Only safe fields
    expect(doc).toHaveProperty('title');
    expect(doc).toHaveProperty('type');
  });

  it('enriquece itens de inventário com nome do ambiente', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { dossie: { inventory_items: Record<string, unknown>[] } };
    const item = body.dossie.inventory_items[0];
    expect(item).toBeDefined();
    expect(item!.room_name).toBe('Sala');
    expect(item!).not.toHaveProperty('room_id');
  });

  it('inclui evidencias fotograficas sem expor chaves privadas', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { dossie: { photo_evidence: Record<string, unknown>[]; service_orders: Record<string, unknown>[] } };
    expect(body.dossie.photo_evidence[0]).toMatchObject({
      service_title: serviceOrder.title,
      system_type: 'electrical',
      before_count: 1,
      after_count: 1,
    });
    expect(JSON.stringify(body.dossie)).not.toContain('before-private.jpg');
    expect(JSON.stringify(body.dossie)).not.toContain('after-private.jpg');
    expect(body.dossie.service_orders[0]).not.toHaveProperty('before_photos');
    expect(body.dossie.service_orders[0]).not.toHaveProperty('after_photos');
  });

  it('cria audit log com tenantId, propertyId e action correta', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    const auditCall = vi.mocked(writeAuditLog).mock.calls[0]![1]!;
    expect(auditCall.tenantId).toBe('tenant-1');
    expect(auditCall.propertyId).toBe('prop-1');
    expect(auditCall.action).toBe('property_dossie_generated');
    expect(auditCall.actorId).toBe('user-1');
    expect(auditCall.entityType).toBe('property');
    expect(auditCall.entityId).toBe('prop-1');
  });

  it('preview retorna payload sanitizado sem registrar exportacao', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie/preview',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { dossie: Record<string, unknown>; preview: { sections: Record<string, number> } };
    expect(body.dossie).toBeDefined();
    expect(body.preview.sections.photo_evidence).toBe(1);
    expect(vi.mocked(writeAuditLog)).not.toHaveBeenCalled();
  });

  it('exportacao PDF cria audit log explicito sem retornar key R2', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie/export',
      { method: 'POST' },
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { dossie: Record<string, unknown>; export: Record<string, unknown> };
    expect(body.export).toMatchObject({ mode: 'client_pdf', storage: 'browser_download' });
    expect(JSON.stringify(body)).not.toContain('r2_key');
    expect(JSON.stringify(body)).not.toContain('tenant-1/properties/prop-1/services/os-1');
    expect(vi.mocked(writeAuditLog)).toHaveBeenCalledOnce();
    expect(vi.mocked(writeAuditLog).mock.calls[0]![1]!.action).toBe('property_dossie_pdf_exported');
  });

  it('tenant A não pode gerar dossiê do imóvel de tenant B', async () => {
    // tenant-2 is the active tenant but property belongs to tenant-1 → DB returns []
    authState.tenantId = 'tenant-2';
    const db = buildDb({ propertyCheckResult: [] });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(vi.mocked(writeAuditLog)).not.toHaveBeenCalled();
  });

  it('tenant A nÃ£o pode exportar PDF do imÃ³vel de tenant B', async () => {
    authState.tenantId = 'tenant-2';
    const db = buildDb({ propertyCheckResult: [] });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie/export',
      { method: 'POST' },
      buildEnv()
    );

    expect(res.status).toBe(404);
    expect(vi.mocked(writeAuditLog)).not.toHaveBeenCalled();
  });

  it('timeline é ordenada do mais recente para o mais antigo', async () => {
    const db = buildDb();
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { dossie: { timeline: { date: string }[] } };
    const timeline = body.dossie.timeline;
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i - 1]!.date >= timeline[i]!.date).toBe(true);
    }
  });

  it('retorna seções vazias quando imóvel não tem dados', async () => {
    const responses = [
      [{ id: 'prop-1' }],
      [propDetails],
      [{ name: 'Tenant X' }],
      [{ name: 'Usuário Y' }],
      [],  // rooms
      [],  // inventory
      [],  // warranties
      [],  // renovations
      [],  // service orders
      [],  // documents
      [],  // maintenance
    ];
    const select = vi.fn(() => makeChain(responses.shift() ?? []));
    vi.mocked(getDb).mockReturnValue({ select, update: vi.fn(() => makeChain(undefined)) } as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/dossie',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { dossie: Record<string, unknown[]> };
    expect(body.dossie.rooms).toHaveLength(0);
    expect(body.dossie.inventory_items).toHaveLength(0);
    expect(body.dossie.warranties).toHaveLength(0);
    expect(body.dossie.timeline).toHaveLength(0);
  });
});

// ── Health score ──────────────────────────────────────────────────────────────
// Query order inside computeHealthScore (Promise.all):
//   0: property check  →  [{id}] or []
//   1: maint stats     →  [{total, overdue}]
//   2: svc stats       →  [{total, open, urgent, preventive}]
//   3: age             →  [{year_built}]
//   4: doc completeness→  [{has_insurance, has_deed}]
//   5: warranty health →  [{expiring_30, expiring_90}]

type MaintStats = { total: number; overdue: number };
type SvcStats = { total: number; open: number; urgent: number; preventive: number };
type AgeRow = { year_built: number | null };
type DocRow = { has_insurance: number; has_deed: number };
type WarrRow = { expiring_30: number; expiring_90: number };

function buildHealthDb(opts: {
  propertyFound?: boolean;
  maint?: MaintStats;
  svc?: SvcStats;
  age?: AgeRow;
  doc?: DocRow;
  warr?: WarrRow;
} = {}) {
  const responses: unknown[] = [
    opts.propertyFound !== false ? [{ id: 'prop-1' }] : [],
    [opts.maint  ?? { total: 5,  overdue: 0 }],
    [opts.svc    ?? { total: 10, open: 0, urgent: 0, preventive: 6 }],
    [opts.age    ?? { year_built: 2015 }],
    [opts.doc    ?? { has_insurance: 1, has_deed: 1 }],
    [opts.warr   ?? { expiring_30: 0, expiring_90: 0 }],
  ];
  const select = vi.fn(() => makeChain(responses.shift() ?? []));
  return { select, update: vi.fn(() => makeChain(undefined)) };
}

describe('GET /properties/:propertyId/report/health-score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.propertyAccess = true;
  });

  it('retorna 404 quando imóvel não pertence ao tenant', async () => {
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeChain([])),
      update: vi.fn(() => makeChain(undefined)),
    } as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(404);
  });

  it('retorna 403 quando usuário não tem acesso', async () => {
    authState.propertyAccess = false;
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeChain([{ id: 'prop-1' }])),
      update: vi.fn(() => makeChain(undefined)),
    } as unknown as ReturnType<typeof getDb>);
    vi.mocked(assertPropertyAccess).mockResolvedValueOnce(false);

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(403);
  });

  it('imóvel sem problemas retorna score 100 e breakdown completo', async () => {
    // All perfect: maint ok, svc ok (60% preventive → max), docs ok, no expiring warranties
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb() as unknown as ReturnType<typeof getDb>
    );

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { score: number; label: string; breakdown: Record<string, number> };
    expect(body.score).toBe(100);
    expect(body.label).toBe('Excelente');
    expect(body.breakdown).toMatchObject({
      maintenance_compliance: 25,
      service_backlog: 20,
      preventive_ratio: 15,
      age_penalty: 15,
      document_completeness: 15,
      warranty_health: 10,
    });
  });

  it('manutenção 100% vencida reduz maintenance_compliance para 0', async () => {
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb({ maint: { total: 5, overdue: 5 } }) as unknown as ReturnType<typeof getDb>
    );

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { score: number; breakdown: Record<string, number> };
    expect(body.breakdown.maintenance_compliance).toBe(0);
    expect(body.score).toBeLessThan(100);
  });

  it('OS urgente aberta reduz service_backlog significativamente', async () => {
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb({
        svc: { total: 8, open: 4, urgent: 3, preventive: 2 },
      }) as unknown as ReturnType<typeof getDb>
    );

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { score: number; breakdown: Record<string, number> };
    // openRatio=0.5 → base=10; urgentPenalty=min(9,10)=9 → svcScore=max(0,10-9)=1
    expect(body.breakdown.service_backlog).toBe(1);
    expect(body.score).toBeLessThan(100);
  });

  it('garantia vencendo em ≤30 dias reduz warranty_health', async () => {
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb({ warr: { expiring_30: 2, expiring_90: 0 } }) as unknown as ReturnType<typeof getDb>
    );

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { score: number; breakdown: Record<string, number> };
    // penalty = min(2*3,6)+0 = 6 → warrantyScore = max(0, 10-6) = 4
    expect(body.breakdown.warranty_health).toBe(4);
    expect(body.score).toBeLessThan(100);
  });

  it('garantia vencendo entre 31 e 90 dias aplica penalidade menor', async () => {
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb({ warr: { expiring_30: 0, expiring_90: 3 } }) as unknown as ReturnType<typeof getDb>
    );

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { score: number; breakdown: Record<string, number> };
    // penalty = 0 + min(3,4) = 3 → warrantyScore = max(0, 10-3) = 7
    expect(body.breakdown.warranty_health).toBe(7);
  });

  it('score nunca excede 100', async () => {
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb() as unknown as ReturnType<typeof getDb>
    );
    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );
    const body = await res.json() as { score: number };
    expect(body.score).toBeLessThanOrEqual(100);
  });

  it('score nunca fica abaixo de 0 mesmo com penalidades extremas', async () => {
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb({
        maint: { total: 20, overdue: 20 },
        svc:   { total: 20, open: 20, urgent: 20, preventive: 0 },
        age:   { year_built: 1900 },
        doc:   { has_insurance: 0, has_deed: 0 },
        warr:  { expiring_30: 100, expiring_90: 100 },
      }) as unknown as ReturnType<typeof getDb>
    );

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { score: number };
    expect(body.score).toBeGreaterThanOrEqual(0);
  });

  it('breakdown contém todos os 6 fatores explicativos', async () => {
    vi.mocked(getDb).mockReturnValue(
      buildHealthDb() as unknown as ReturnType<typeof getDb>
    );

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    const body = await res.json() as { breakdown: Record<string, number> };
    const keys = Object.keys(body.breakdown);
    expect(keys).toContain('maintenance_compliance');
    expect(keys).toContain('service_backlog');
    expect(keys).toContain('preventive_ratio');
    expect(keys).toContain('age_penalty');
    expect(keys).toContain('document_completeness');
    expect(keys).toContain('warranty_health');
    // All factor values are non-negative
    for (const v of Object.values(body.breakdown)) {
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it('tenant A não pode ver score do imóvel de tenant B (propriedade não encontrada)', async () => {
    authState.tenantId = 'tenant-2';
    vi.mocked(getDb).mockReturnValue({
      select: vi.fn(() => makeChain([])),
      update: vi.fn(() => makeChain(undefined)),
    } as unknown as ReturnType<typeof getDb>);

    const res = await buildApp().request(
      '/properties/prop-1/report/health-score',
      { method: 'GET' },
      buildEnv()
    );

    expect(res.status).toBe(404);
  });
});
