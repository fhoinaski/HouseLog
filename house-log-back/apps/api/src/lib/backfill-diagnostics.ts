// P0-14 - Helpers de diagnostico de backfill de tenant_id.
// Logica pura, sem acesso a DB; testavel sem D1.

export type BackfillDecision =
  | { derivable: false; reason: 'already_set' | 'parent_null' | 'record_null_no_parent' }
  | { derivable: true; tenantId: string };

/**
 * Decide se um registro filho pode receber tenant_id via backfill.
 * Regra central: so preenche se o registro esta null e o parent ja tem
 * tenant_id. Nunca sobrescreve valor existente.
 */
export function resolveChildTenant(input: {
  recordTenantId: string | null | undefined;
  parentTenantId: string | null | undefined;
}): BackfillDecision {
  if (input.recordTenantId) {
    return { derivable: false, reason: 'already_set' };
  }
  if (!input.parentTenantId) {
    return { derivable: false, reason: 'parent_null' };
  }
  return { derivable: true, tenantId: input.parentTenantId };
}

export type PropertyBackfillDecision =
  | { derivable: false; reason: 'already_set' | 'no_membership' | 'ambiguous' }
  | { derivable: true; tenantId: string };

/**
 * Decide se uma property pode receber tenant_id pelo owner.
 * Seguro apenas quando o owner pertence a exatamente 1 tenant ativo.
 * Ambiguo (>1 tenant) fica NULL para investigacao humana.
 */
export function resolvePropertyTenant(input: {
  propertyTenantId: string | null | undefined;
  ownerActiveTenantIds: string[];
}): PropertyBackfillDecision {
  if (input.propertyTenantId) {
    return { derivable: false, reason: 'already_set' };
  }
  if (input.ownerActiveTenantIds.length === 0) {
    return { derivable: false, reason: 'no_membership' };
  }
  if (input.ownerActiveTenantIds.length > 1) {
    return { derivable: false, reason: 'ambiguous' };
  }
  const tenantId = input.ownerActiveTenantIds[0];
  if (!tenantId) return { derivable: false, reason: 'no_membership' };
  return { derivable: true, tenantId };
}

export const BACKFILL_STRATEGIES: Array<{
  table: string;
  derivationPath: string;
  criticalNotNullCandidate?: boolean;
  notes?: string;
}> = [
  {
    table: 'properties',
    derivationPath: 'owner_id -> tenant_members(status=active, count=1) -> tenant_id',
    criticalNotNullCandidate: true,
    notes: 'Ambiguous if owner belongs to >1 active tenant; left NULL and reported.',
  },
  { table: 'rooms', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'inventory_items', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'service_orders', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'documents', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'expenses', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'maintenance_schedules', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'property_collaborators', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'property_invites', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'property_access_credentials', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'service_requests', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'audit_links', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'provider_ratings', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'pix_charges', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  { table: 'nfe_imports', derivationPath: 'property_id -> properties.tenant_id', criticalNotNullCandidate: true },
  {
    table: 'service_bids',
    derivationPath: 'service_id -> service_orders.tenant_id',
    criticalNotNullCandidate: true,
    notes: 'Run after service_orders backfill.',
  },
  {
    table: 'service_messages',
    derivationPath: 'service_order_id -> service_orders.tenant_id',
    criticalNotNullCandidate: true,
    notes: 'Run after service_orders backfill.',
  },
  {
    table: 'service_share_links',
    derivationPath: 'service_id -> service_orders.tenant_id',
    criticalNotNullCandidate: true,
    notes: 'Run after service_orders backfill.',
  },
  {
    table: 'bids',
    derivationPath: 'service_request_id -> service_requests.tenant_id',
    criticalNotNullCandidate: true,
    notes: 'Run after service_requests backfill.',
  },
  {
    table: 'audit_log',
    derivationPath: 'property_id -> properties.tenant_id',
    notes: 'Legitimately nullable for legacy/global audit events without property scope.',
  },
];

export const TENANT_NOT_NULL_TABLES = [
  'tenants',
  'tenant_members',
  'technical_systems',
  'technical_points',
  'document_ingestion_jobs',
  'document_extractions',
  'document_extraction_reviews',
  'document_extraction_candidates',
  'warranties',
  'renovations',
  'handover_packages',
  'handover_checklist_items',
] as const;

export const CRITICAL_NULLABLE_TENANT_TABLES = BACKFILL_STRATEGIES
  .filter((strategy) => strategy.criticalNotNullCandidate)
  .map((strategy) => strategy.table);
