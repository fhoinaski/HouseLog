import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import { documents, properties, propertyCollaborators, serviceOrders } from '../db/schema';
import {
  canAccessTenantProperty,
  type TenantPropertyAccessDecision,
  listAccessibleTenantPropertyIds,
  type TenantPropertyAccessLevel,
} from './tenant-authorization';
import type { Role, TenantRole } from './types';

export type AuthorizationSubject = {
  userId: string;
  role: Role;
};

export type PropertyAuthorizationInput = AuthorizationSubject & {
  propertyId: string;
  tenantId?: string | null;
  tenantRole?: TenantRole | null;
  accessLevel?: TenantPropertyAccessLevel;
  assignedProviderId?: string | null;
};

export type TenantScopedDecision = TenantPropertyAccessDecision;

export type AuditLogDecision =
  | { allowed: true }
  | { allowed: false; status: 400 | 403; code: 'TENANT_REQUIRED' | 'FORBIDDEN' };

export type ProviderProposalAuthorizationInput = AuthorizationSubject & {
  propertyId: string;
  serviceOrderId: string;
  serviceOrderStatus?: string;
  assignedProviderId?: string | null;
  hasExistingPendingProposal?: boolean;
};

export type ProviderOpportunityAuthorizationInput = AuthorizationSubject & {
  serviceOrderStatus?: string;
  assignedProviderId?: string | null;
  deletedAt?: string | null;
  serviceOrderSystemType?: string | null;
  providerCategories?: string[];
  requestedSystemType?: string | null;
};

export type AssignedProviderServiceAuthorizationInput = AuthorizationSubject & {
  assignedProviderId?: string | null;
  deletedAt?: string | null;
};

export type ServiceMessageAuthorizationInput = AuthorizationSubject & {
  propertyOwnerId: string;
  propertyManagerId?: string | null;
  requestedById: string;
  assignedProviderId?: string | null;
  hasActiveProviderBid?: boolean;
  hasPropertyAccess?: boolean;
};

function isPropertyDashboardRole(role: Role): boolean {
  return role !== 'provider' && role !== 'temp_provider';
}

async function resolvePropertyBoolean(
  db: D1Database,
  input: PropertyAuthorizationInput,
  accessLevel: TenantPropertyAccessLevel
): Promise<boolean> {
  const decision = await canAccessTenantProperty(db, {
    tenantId: input.tenantId,
    tenantRole: input.tenantRole,
    propertyId: input.propertyId,
    userId: input.userId,
    userRole: input.role,
    accessLevel,
    assignedProviderId: input.assignedProviderId,
  });
  return decision.allowed;
}

async function resolvePropertyDecision(
  db: D1Database,
  input: PropertyAuthorizationInput,
  accessLevel: TenantPropertyAccessLevel
): Promise<TenantScopedDecision> {
  return canAccessTenantProperty(db, {
    tenantId: input.tenantId,
    tenantRole: input.tenantRole,
    propertyId: input.propertyId,
    userId: input.userId,
    userRole: input.role,
    accessLevel,
    assignedProviderId: input.assignedProviderId,
  });
}

export async function canViewProperty(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return resolvePropertyDecision(db, input, input.accessLevel ?? 'view');
}

export async function canManageProperty(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return resolvePropertyDecision(db, input, 'manage');
}

export async function canDeleteDocument(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return canManageProperty(db, input);
}

export async function canAccessDocument(
  db: D1Database,
  input: PropertyAuthorizationInput & {
    documentId: string;
    accessLevel?: Extract<TenantPropertyAccessLevel, 'view' | 'manage'>;
  }
): Promise<TenantScopedDecision> {
  const propertyDecision = await resolvePropertyDecision(db, input, input.accessLevel ?? 'view');
  if (!propertyDecision.allowed) return propertyDecision;
  if (!input.tenantId) return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };

  const drizzle = getDb(db);
  const [document] = await drizzle
    .select({ serviceId: documents.serviceId })
    .from(documents)
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.tenantId, input.tenantId),
        eq(documents.propertyId, input.propertyId),
        isNull(documents.deletedAt)
      )
    )
    .limit(1);

  if (!document) return { allowed: false, status: 404, code: 'NOT_FOUND' };
  if (!document.serviceId) return { allowed: true, reason: 'document_property_access' };

  const [serviceOrder] = await drizzle
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .where(
      and(
        eq(serviceOrders.id, document.serviceId),
        eq(serviceOrders.tenantId, input.tenantId),
        eq(serviceOrders.propertyId, input.propertyId),
        isNull(serviceOrders.deletedAt)
      )
    )
    .limit(1);

  if (!serviceOrder) return { allowed: false, status: 404, code: 'NOT_FOUND' };
  return { allowed: true, reason: 'document_service_order_access' };
}

export async function canRevealCredential(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return resolvePropertyDecision(db, input, 'secret');
}

// Statuses that represent an active engagement where a provider may access credentials.
// 'approved' = bid accepted, provider confirmed. 'in_progress' = work underway.
// User policy used 'accepted'/'scheduled' — actual schema enums are 'approved'/'in_progress'.
// 'requested', 'completed', 'verified' are intentionally excluded.
const PROVIDER_REVEAL_ALLOWED_STATUSES = ['approved', 'in_progress'] as const;

export async function canProviderRevealCredential(
  db: D1Database,
  input: {
    tenantId: string;
    propertyId: string;
    userId: string;
    serviceOrderId: string;
  }
): Promise<TenantScopedDecision> {
  const drizzle = getDb(db);
  const [os] = await drizzle
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .where(
      and(
        eq(serviceOrders.id, input.serviceOrderId),
        eq(serviceOrders.tenantId, input.tenantId),
        eq(serviceOrders.propertyId, input.propertyId),
        eq(serviceOrders.assignedTo, input.userId),
        inArray(serviceOrders.status, [...PROVIDER_REVEAL_ALLOWED_STATUSES]),
        isNull(serviceOrders.deletedAt)
      )
    )
    .limit(1);

  if (!os) return { allowed: false, status: 403, code: 'FORBIDDEN' };
  return { allowed: true, reason: 'provider_active_service_order' };
}

export type ShareLinkAuthorizationInput = PropertyAuthorizationInput & {
  serviceOrderId: string;
};

// Requires manage-level property access AND verifies the service order belongs
// to the same tenant+property. Encapsulates both gates so routes don't inline them.
export async function canCreateShareLink(
  db: D1Database,
  input: ShareLinkAuthorizationInput
): Promise<TenantScopedDecision> {
  const propertyDecision = await resolvePropertyDecision(db, input, 'manage');
  if (!propertyDecision.allowed) return propertyDecision;

  const drizzle = getDb(db);
  const [os] = await drizzle
    .select({ id: serviceOrders.id })
    .from(serviceOrders)
    .where(
      and(
        eq(serviceOrders.id, input.serviceOrderId),
        eq(serviceOrders.tenantId, input.tenantId!),
        eq(serviceOrders.propertyId, input.propertyId),
        isNull(serviceOrders.deletedAt)
      )
    )
    .limit(1);

  if (!os) return { allowed: false, status: 404, code: 'NOT_FOUND' };
  return { allowed: true, reason: 'share_link_manager' };
}

export async function canManageServiceOrder(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return canManageProperty(db, input);
}

export async function canApproveBudget(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return canManageProperty(db, input);
}

export async function canManageHandoverPackage(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return canManageProperty(db, input);
}

export async function canRevokeHandoverPackage(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return canManageProperty(db, input);
}

export async function canManageTenantUsers(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return canManageProperty(db, input);
}

export async function canInviteUser(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<TenantScopedDecision> {
  return canManageTenantUsers(db, input);
}

export function canViewAuditLog(input: {
  tenantId?: string | null;
  tenantRole?: TenantRole | null;
}): AuditLogDecision {
  if (!input.tenantId || !input.tenantRole) {
    return { allowed: false, status: 400, code: 'TENANT_REQUIRED' };
  }
  if (input.tenantRole === 'owner' || input.tenantRole === 'manager') {
    return { allowed: true };
  }
  return { allowed: false, status: 403, code: 'FORBIDDEN' };
}

export async function canAccessProperty(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return resolvePropertyBoolean(db, input, input.accessLevel ?? 'view');
}

export async function canRevealCredentialSecret(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canRevealCredential(db, input)).allowed;
}

export async function canListCredentials(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canViewProperty(db, input)).allowed;
}

export async function canCreateCredential(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageProperty(db, input)).allowed;
}

export async function canUpdateCredential(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageProperty(db, input)).allowed;
}

export async function canDeleteCredential(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageProperty(db, input)).allowed;
}

export async function canGenerateTemporaryCredentialAccess(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canRevealCredential(db, input)).allowed;
}

export async function canCreateAuditLink(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canMarkMaintenanceDone(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canUploadDocument(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageProperty(db, input)).allowed;
}

export async function canRequestDocumentOCR(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canViewProperty(db, input)).allowed;
}

export function canRequestDocumentIngestionRole(input: {
  role: Role;
  tenantId?: string | null;
  tenantRole?: TenantRole | null;
}): boolean {
  if (!input.tenantId) return false;
  if (input.role === 'provider' || input.role === 'temp_provider') return false;
  if (input.role === 'admin') return true;
  if (input.role === 'owner') return true;
  return input.tenantRole === 'owner' || input.tenantRole === 'manager';
}

export function canRequestDocumentIngestionDecision(input: {
  role: Role;
  tenantId?: string | null;
  tenantRole?: TenantRole | null;
  hasPropertyAccess: boolean;
}): boolean {
  if (!canRequestDocumentIngestionRole(input)) return false;
  return input.hasPropertyAccess;
}

export async function canRequestDocumentIngestion(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  const hasPropertyAccess = await canAccessProperty(db, input);
  return canRequestDocumentIngestionDecision({
    role: input.role,
    tenantId: input.tenantId,
    tenantRole: input.tenantRole,
    hasPropertyAccess,
  });
}

export async function canCreateServiceOrder(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return resolvePropertyBoolean(db, input, 'open_service_order');
}

export async function canCreateServiceRequest(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return resolvePropertyBoolean(db, input, 'open_service_order');
}

export async function canViewServiceOrder(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canViewProperty(db, input)).allowed;
}

export async function canMutateServiceOrder(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canUpdateServiceOrder(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canChangeServiceOrderStatus(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canUploadServiceEvidence(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canUpdateServiceOrderChecklist(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canDeleteServiceOrder(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canCloseServiceOrderWithEvidence(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canManageServiceOrder(db, input)).allowed;
}

export async function canSearchProperty(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return (await canViewProperty(db, input)).allowed;
}

export async function canSearchServiceOrders(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canSearchProperty(db, input);
}

export async function canSearchDocuments(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canSearchProperty(db, input);
}

export async function canSearchInventory(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canSearchProperty(db, input);
}

export async function canSearchMaintenance(
  db: D1Database,
  input: PropertyAuthorizationInput
): Promise<boolean> {
  return canSearchProperty(db, input);
}

export async function canAccessProviderPortal(
  db: D1Database,
  subject: AuthorizationSubject
): Promise<boolean> {
  if (subject.role === 'provider' || subject.role === 'admin') return true;

  const drizzle = getDb(db);
  const [collaborator] = await drizzle
    .select({ id: propertyCollaborators.id })
    .from(propertyCollaborators)
    .where(
      and(
        eq(propertyCollaborators.userId, subject.userId),
        eq(propertyCollaborators.role, 'provider')
      )
    )
    .limit(1);

  return !!collaborator;
}

export function canSubmitProviderProposal(input: ProviderProposalAuthorizationInput): boolean {
  const hasOpportunityContext = input.propertyId.length > 0 && input.serviceOrderId.length > 0;
  if (!hasOpportunityContext || (input.role !== 'provider' && input.role !== 'admin')) return false;
  if (input.assignedProviderId) return false;
  if (input.serviceOrderStatus !== undefined && input.serviceOrderStatus !== 'requested') return false;
  if (input.hasExistingPendingProposal) return false;
  return true;
}

export function canViewProviderOpportunity(input: ProviderOpportunityAuthorizationInput): boolean {
  if (input.role !== 'provider' && input.role !== 'admin') return false;
  if (input.deletedAt) return false;
  if (input.assignedProviderId) return false;
  if (input.serviceOrderStatus !== undefined && input.serviceOrderStatus !== 'requested') return false;

  const shouldApplyCategoryMatch = !input.requestedSystemType && (input.providerCategories?.length ?? 0) > 0;
  if (shouldApplyCategoryMatch && !input.providerCategories?.includes(input.serviceOrderSystemType ?? '')) {
    return false;
  }

  return true;
}

export function canViewAssignedProviderService(input: AssignedProviderServiceAuthorizationInput): boolean {
  if (input.role === 'admin') return !input.deletedAt;
  if (input.role !== 'provider') return false;
  if (input.deletedAt) return false;
  return input.assignedProviderId === input.userId;
}

export function canUploadProviderInvoice(input: AssignedProviderServiceAuthorizationInput): boolean {
  return canViewAssignedProviderService(input);
}

export type UploadProviderEvidenceInput = AssignedProviderServiceAuthorizationInput & {
  serviceOrderStatus: string;
};

const PROVIDER_EVIDENCE_ALLOWED_STATUSES = ['approved', 'in_progress'] as const;

export function canUploadProviderEvidence(input: UploadProviderEvidenceInput): boolean {
  if (!canViewAssignedProviderService(input)) return false;
  return (PROVIDER_EVIDENCE_ALLOWED_STATUSES as readonly string[]).includes(input.serviceOrderStatus);
}

function isServiceMessageParticipant(input: ServiceMessageAuthorizationInput): boolean {
  return (
    input.userId === input.propertyOwnerId ||
    input.userId === input.propertyManagerId ||
    input.userId === input.assignedProviderId ||
    input.userId === input.requestedById
  );
}

export function canViewServiceMessages(input: ServiceMessageAuthorizationInput): boolean {
  return (
    isServiceMessageParticipant(input) ||
    (input.role === 'provider' && input.hasActiveProviderBid === true) ||
    input.hasPropertyAccess === true
  );
}

export function canSendServiceMessage(input: ServiceMessageAuthorizationInput): boolean {
  return canViewServiceMessages(input);
}

export function canViewInternalServiceMessages(input: ServiceMessageAuthorizationInput): boolean {
  return input.role !== 'provider' && input.role !== 'temp_provider';
}

export function canSendInternalServiceMessage(input: ServiceMessageAuthorizationInput): boolean {
  return canViewInternalServiceMessages(input);
}

export async function listAccessiblePropertyIds(
  db: D1Database,
  subject: AuthorizationSubject & { tenantId?: string | null; tenantRole?: TenantRole | null }
): Promise<string[]> {
  if (subject.tenantId && subject.tenantRole) {
    return listAccessibleTenantPropertyIds(db, {
      tenantId: subject.tenantId,
      tenantRole: subject.tenantRole,
      userId: subject.userId,
      userRole: subject.role,
    });
  }

  if (!isPropertyDashboardRole(subject.role)) return [];

  const drizzle = getDb(db);
  const owned = await drizzle
    .select({ id: properties.id })
    .from(properties)
    .where(
      and(
        or(eq(properties.ownerId, subject.userId), eq(properties.managerId, subject.userId)),
        isNull(properties.deletedAt)
      )
    );

  let collaboratorRows: Array<{ id: string }> = [];
  try {
    collaboratorRows = await drizzle
      .select({ id: propertyCollaborators.propertyId })
      .from(propertyCollaborators)
      .innerJoin(properties, eq(properties.id, propertyCollaborators.propertyId))
      .where(
        and(
          eq(propertyCollaborators.userId, subject.userId),
          isNull(properties.deletedAt)
        )
      );
  } catch (e) {
    if (!String(e).includes('property_collaborators')) throw e;
  }

  return Array.from(new Set([...owned, ...collaboratorRows].map((row) => row.id)));
}
