import { describe, expect, it } from 'vitest';
import {
  resolveChildTenant,
  resolvePropertyTenant,
  BACKFILL_STRATEGIES,
  CRITICAL_NULLABLE_TENANT_TABLES,
  TENANT_NOT_NULL_TABLES,
} from './backfill-diagnostics';

describe('resolveChildTenant - backfill de tabelas filhas', () => {
  it('nao preenche quando o registro ja tem tenant_id', () => {
    expect(resolveChildTenant({ recordTenantId: 'tenant-a', parentTenantId: 'tenant-a' }))
      .toEqual({ derivable: false, reason: 'already_set' });
  });

  it('nao preenche quando record tem tenant e parent e null', () => {
    expect(resolveChildTenant({ recordTenantId: 'tenant-a', parentTenantId: null }))
      .toEqual({ derivable: false, reason: 'already_set' });
  });

  it('nao preenche quando parent e null (registro orfao)', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: null }))
      .toEqual({ derivable: false, reason: 'parent_null' });
  });

  it('nao preenche quando parent e undefined', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: undefined }))
      .toEqual({ derivable: false, reason: 'parent_null' });
  });

  it('nao preenche quando parent e string vazia', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: '' }))
      .toEqual({ derivable: false, reason: 'parent_null' });
  });

  it('deriva tenant_id quando record e null e parent tem valor', () => {
    expect(resolveChildTenant({ recordTenantId: null, parentTenantId: 'tenant-a' }))
      .toEqual({ derivable: true, tenantId: 'tenant-a' });
  });

  it('deriva tenant_id quando record e undefined e parent tem valor', () => {
    expect(resolveChildTenant({ recordTenantId: undefined, parentTenantId: 'tenant-b' }))
      .toEqual({ derivable: true, tenantId: 'tenant-b' });
  });

  it('idempotencia: re-executar em registro ja preenchido nao altera nada', () => {
    const decision = resolveChildTenant({ recordTenantId: 'tenant-a', parentTenantId: 'tenant-a' });
    expect(decision.derivable).toBe(false);
    if (!decision.derivable) expect(decision.reason).toBe('already_set');
  });
});

describe('resolvePropertyTenant - backfill de properties via owner', () => {
  it('nao preenche quando a property ja tem tenant_id', () => {
    expect(resolvePropertyTenant({ propertyTenantId: 'tenant-a', ownerActiveTenantIds: ['tenant-a'] }))
      .toEqual({ derivable: false, reason: 'already_set' });
  });

  it('nao preenche quando owner nao tem nenhum tenant membership', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: [] }))
      .toEqual({ derivable: false, reason: 'no_membership' });
  });

  it('nao preenche quando owner pertence a mais de um tenant (ambiguo)', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: ['tenant-a', 'tenant-b'] }))
      .toEqual({ derivable: false, reason: 'ambiguous' });
  });

  it('nao preenche quando owner pertence a 3 tenants (ainda ambiguo)', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: ['t1', 't2', 't3'] }))
      .toEqual({ derivable: false, reason: 'ambiguous' });
  });

  it('deriva tenant_id quando property e null e owner tem exatamente 1 tenant', () => {
    expect(resolvePropertyTenant({ propertyTenantId: null, ownerActiveTenantIds: ['tenant-a'] }))
      .toEqual({ derivable: true, tenantId: 'tenant-a' });
  });

  it('idempotencia: property ja preenchida com tenant diferente nao e sobrescrita', () => {
    const decision = resolvePropertyTenant({
      propertyTenantId: 'tenant-original',
      ownerActiveTenantIds: ['tenant-novo'],
    });
    expect(decision.derivable).toBe(false);
    if (!decision.derivable) expect(decision.reason).toBe('already_set');
  });
});

describe('BACKFILL_STRATEGIES - cobertura de tabelas', () => {
  const tableNames = BACKFILL_STRATEGIES.map((strategy) => strategy.table);

  it('cobre as 20 tabelas com tenant_id nullable', () => {
    expect(tableNames).toHaveLength(20);
  });

  it('properties esta na lista', () => {
    expect(tableNames).toContain('properties');
  });

  it('todas as tabelas que dependem de service_orders sao executadas depois', () => {
    const serviceOrdersIdx = tableNames.indexOf('service_orders');
    const serviceBidsIdx = tableNames.indexOf('service_bids');
    const serviceMessagesIdx = tableNames.indexOf('service_messages');
    const shareLinksIdx = tableNames.indexOf('service_share_links');
    expect(serviceBidsIdx).toBeGreaterThan(serviceOrdersIdx);
    expect(serviceMessagesIdx).toBeGreaterThan(serviceOrdersIdx);
    expect(shareLinksIdx).toBeGreaterThan(serviceOrdersIdx);
  });

  it('bids e executado depois de service_requests', () => {
    const serviceRequestsIdx = tableNames.indexOf('service_requests');
    const bidsIdx = tableNames.indexOf('bids');
    expect(bidsIdx).toBeGreaterThan(serviceRequestsIdx);
  });

  it('nenhuma tabela aparece duas vezes', () => {
    const unique = new Set(tableNames);
    expect(unique.size).toBe(tableNames.length);
  });

  it('mantem audit_log fora das tabelas criticas com bloqueio de null futuro', () => {
    expect(CRITICAL_NULLABLE_TENANT_TABLES).toHaveLength(19);
    expect(CRITICAL_NULLABLE_TENANT_TABLES).not.toContain('audit_log');
  });

  it('marca tabelas operacionais antigas como criticas para impedir tenant null novo', () => {
    expect(CRITICAL_NULLABLE_TENANT_TABLES).toEqual([
      'properties',
      'rooms',
      'inventory_items',
      'service_orders',
      'documents',
      'expenses',
      'maintenance_schedules',
      'property_collaborators',
      'property_invites',
      'property_access_credentials',
      'service_requests',
      'audit_links',
      'provider_ratings',
      'pix_charges',
      'nfe_imports',
      'service_bids',
      'service_messages',
      'service_share_links',
      'bids',
    ]);
  });
});

describe('TENANT_NOT_NULL_TABLES - tabelas ja seguras', () => {
  it('technical_systems nao precisa de backfill (NOT NULL no schema)', () => {
    expect(TENANT_NOT_NULL_TABLES).toContain('technical_systems');
  });

  it('technical_points nao precisa de backfill (NOT NULL no schema)', () => {
    expect(TENANT_NOT_NULL_TABLES).toContain('technical_points');
  });

  it('inclui tabelas criadas depois da fundacao multi-tenant com tenant_id NOT NULL', () => {
    expect(TENANT_NOT_NULL_TABLES).toContain('document_ingestion_jobs');
    expect(TENANT_NOT_NULL_TABLES).toContain('warranties');
    expect(TENANT_NOT_NULL_TABLES).toContain('handover_checklist_items');
  });
});
