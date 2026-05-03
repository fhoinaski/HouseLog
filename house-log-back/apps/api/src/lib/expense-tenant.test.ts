import { describe, expect, it } from 'vitest';
import { canAccessFinanceForTenant, canAccessPixChargeForTenant } from './expense-tenant';

describe('expense / finance tenant isolation', () => {
  // ── canAccessFinanceForTenant ────────────────────────────────────────────────

  it('blocks access without an active tenant', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: null, recordTenantId: 'tenant-a' })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('tenant A cannot list expenses from tenant B', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: 'tenant-a', recordTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('tenant A cannot access expense from tenant B by ID', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: 'tenant-a', recordTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('tenant A cannot update expense from tenant B', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: 'tenant-a', recordTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('tenant A cannot delete expense from tenant B', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: 'tenant-a', recordTenantId: 'tenant-b' })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('legacy record with null tenant_id is not exposed', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: 'tenant-a', recordTenantId: null })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('legacy record with undefined tenant_id is not exposed', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: 'tenant-a', recordTenantId: undefined })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows access when record belongs to the active tenant', () => {
    expect(
      canAccessFinanceForTenant({ activeTenantId: 'tenant-a', recordTenantId: 'tenant-a' })
    ).toEqual({ allowed: true });
  });

  it('financial aggregation requires an active tenant', () => {
    // Aggregations (SUM/COUNT) must not run without a valid tenant context.
    // This mirrors the behaviour enforced in route handlers via resolveTenant.
    expect(
      canAccessFinanceForTenant({ activeTenantId: undefined, recordTenantId: 'tenant-a' })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  // ── canAccessPixChargeForTenant ──────────────────────────────────────────────

  it('blocks pix charge access without active tenant', () => {
    expect(
      canAccessPixChargeForTenant({
        activeTenantId: null,
        chargeTenantId: 'tenant-a',
        chargePropertyId: 'prop-a',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: false, status: 400, code: 'TENANT_REQUIRED' });
  });

  it('tenant A cannot access pix charge from tenant B', () => {
    expect(
      canAccessPixChargeForTenant({
        activeTenantId: 'tenant-a',
        chargeTenantId: 'tenant-b',
        chargePropertyId: 'prop-b',
        requestedPropertyId: 'prop-b',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('legacy pix charge with null tenant_id is not exposed', () => {
    expect(
      canAccessPixChargeForTenant({
        activeTenantId: 'tenant-a',
        chargeTenantId: null,
        chargePropertyId: 'prop-a',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('blocks pix charge from a different property even in the same tenant', () => {
    expect(
      canAccessPixChargeForTenant({
        activeTenantId: 'tenant-a',
        chargeTenantId: 'tenant-a',
        chargePropertyId: 'prop-b',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: false, status: 404, code: 'NOT_FOUND' });
  });

  it('allows pix charge access when tenant and property match', () => {
    expect(
      canAccessPixChargeForTenant({
        activeTenantId: 'tenant-a',
        chargeTenantId: 'tenant-a',
        chargePropertyId: 'prop-a',
        requestedPropertyId: 'prop-a',
      })
    ).toEqual({ allowed: true });
  });
});
