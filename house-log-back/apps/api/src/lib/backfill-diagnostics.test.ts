import { describe, expect, it } from 'vitest';
import {
  resolveChildTenant,
  resolvePropertyTenant,
  BACKFILL_STRATEGIES,
  TENANT_NOT_NULL_TABLES,
} from './backfill-diagnostics';

describe('resolveChildTenant — backfill de tabelas filhas', () => {
  it('não preenche quando o registro já tem tenant_id', () => {
    expect(resolveChildTenant({ recordTenantId: 'tenant-a', parentTenantId: 'tenant-a' }))
      .toEqual({ derivable: false, reason: 'already_set' });
  });

  it('não preenche quando record tem tenant e parent é null', () => {
    expect(resolveChildTenant({ recordTenantId: 'tenant-a', parentTenantId: null }))
      .toEqual({ derivable: false, reason: 'already_set' });
  });

  it('não preenche quando parent é null (registro órfão)', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: null }))
      .toEqual({ derivable: false, reason: 'parent_null' });
  });

  it('não preenche quando parent é undefined', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: undefined }))
      .toEqual({ derivable: false, reason: 'parent_null' });
  });

  it('não preenche quando parent é string vazia', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: '' }))
      .toEqual({ derivable: false, reason: 'parent_null' });
  });

  it('deriva tenant_id quando record é null e parent tem valor', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: 'tenant-a' }))
      .toEqual({ derivable: true, tenantId: 'tenant-a' });
  });

  it('deriva tenant_id quando record é undefined e parent tem valor', () => {
    expect(resolveChildTenant({ recordTenantId: undefined, parentTenantId: 'tenant-b' }))
      .toEqual({ derivable: true, tenantId: 'tenant-b' });
  });

  it('idempotência: re-executar em registro já preenchido não altera nada', () => {
    const decision = resolveChildTenant({ recordTenantId: 'tenant-a', parentTenantId: 'tenant-a' });
    expect(decision.derivable).toBe(false);
    if (!decision.derivable) expect(decision.reason).toBe('already_set');
  });
});

describe('resolvePropertyTenant — backfill de properties via owner', () => {
  it('não preenche quando a property já tem tenant_id', () => {
    expect(resolvePropertyTenant({ propertyTenantId: 'tenant-a', ownerActiveTenantIds: ['tenant-a'] }))
      .toEqual({ derivable: false, reason: 'already_set' });
  });

  it('não preenche quando owner não tem nenhum tenant membership', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: [] }))
      .toEqual({ derivable: false, reason: 'no_membership' });
  });

  it('não preenche quando owner pertence a mais de um tenant (ambíguo)', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: ['tenant-a', 'tenant-b'] }))
      .toEqual({ derivable: false, reason: 'ambiguous' });
  });

  it('não preenche quando owner pertence a 3 tenants (ainda ambíguo)', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: ['t1', 't2', 't3'] }))
      .toEqual({ derivable: false, reason: 'ambiguous' });
  });

  it('deriva tenant_id quando property é null e owner tem exatamente 1 tenant', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: ['tenant-a'] }))
      .toEqual({ derivable: true, tenantId: 'tenant-a' });
  });

  it('idempotência: property já preenchida com tenant diferente não é sobrescrita', () => {
    const decision = resolvePropertyTenant({
      propertyTenantId: 'tenant-original',
      ownerActiveTenantIds: ['tenant-novo'],
    });
    expect(decision.derivable).toBe(false);
    if (!decision.derivable) expect(decision.reason).toBe('already_set');
  });
});

describe('BACKFILL_STRATEGIES — cobertura de tabelas', () => {
  const tableNames = BACKFILL_STRATEGIES.map((s) => s.table);

  it('cobre as 20 tabelas com tenant_id nullable', () => {
    expect(tableNames).toHaveLength(20);
  });

  it('properties está na lista', () => {
    expect(tableNames).toContain('properties');
  });

  it('todas as tabelas que dependem de service_orders são executadas depois', () => {
    const serviceOrdersIdx  = tableNames.indexOf('service_orders');
    const serviceBidsIdx    = tableNames.indexOf('service_bids');
    const serviceMessagesIdx = tableNames.indexOf('service_messages');
    const shareLinksIdx     = tableNames.indexOf('service_share_links');
    expect(serviceBidsIdx).toBeGreaterThan(serviceOrdersIdx);
    expect(serviceMessagesIdx).toBeGreaterThan(serviceOrdersIdx);
    expect(shareLinksIdx).toBeGreaterThan(serviceOrdersIdx);
  });

  it('bids é executado depois de service_requests', () => {
    const srIdx   = tableNames.indexOf('service_requests');
    const bidsIdx = tableNames.indexOf('bids');
    expect(bidsIdx).toBeGreaterThan(srIdx);
  });

  it('nenhuma tabela aparece duas vezes', () => {
    const unique = new Set(tableNames);
    expect(unique.size).toBe(tableNames.length);
  });
});

describe('TENANT_NOT_NULL_TABLES — tabelas já seguras', () => {
  it('technical_systems não precisa de backfill (NOT NULL no schema)', () => {
    expect(TENANT_NOT_NULL_TABLES).toContain('technical_systems');
  });

  it('technical_points não precisa de backfill (NOT NULL no schema)', () => {
    expect(TENANT_NOT_NULL_TABLES).toContain('technical_points');
  });
});
