// Barrel re-export — all domain modules live in src/lib/api/
// Consumers importing from '@/lib/api' continue to work unchanged.

// Core utilities and shared types
export {
  BASE,
  apiFetcher,
  clearToken,
  getApiErrorMessage,
  getToken,
  normalizeApiMediaUrls,
  normalizeMediaUrl,
  qs,
  request,
  setToken,
} from '@/lib/api/_core';
export type {
  AccessCredential,
  AccessCredentialPayload,
  AuthPairResponse,
  CredentialCategory,
  CredentialIntegrationType,
  CursorPage,
  Document,
  DocumentType,
  MfaChallengeResponse,
  Property,
  PropertyDashboard,
  PropertyProvider,
  ProviderNetworkOpportunity,
  ProviderOpportunity,
  ProviderPublicProfile,
  ProviderServiceOrder,
  PublicServiceView,
  RevealedAccessCredential,
  ServiceBid,
  ServiceOrder,
  ServiceShareLink,
  User,
} from '@/lib/api/_core';

// Auth
export { authApi } from '@/lib/api/auth';
import type { AuthPairResponse, MfaChallengeResponse } from '@/lib/api/_core';
export function isMfaChallenge(
  r: AuthPairResponse | MfaChallengeResponse
): r is MfaChallengeResponse {
  return 'mfa_required' in r && r.mfa_required === true;
}

// Properties
export { propertiesApi } from '@/lib/api/properties';

// Documents
export { documentsApi } from '@/lib/api/documents';
export type { DocumentUploadMeta } from '@/lib/api/documents';
export { documentIngestionApi } from '@/lib/api/document-ingestion';
export type {
  AppliedInventoryItem,
  AppliedMaintenanceSchedule,
  AppliedTechnicalSystem,
  AppliedWarranty,
  ApplyDocumentExtractionCandidateResponse,
  CreateDocumentIngestionJobInput,
  DocumentExtractionCandidate,
  DocumentExtractionCandidatesPage,
  DocumentExtractionCandidateStatus,
  DocumentExtractionCandidateType,
  DocumentExtractionDetail,
  DocumentExtractionReview,
  DocumentExtractionSummary,
  DocumentIngestionJob,
  DocumentIngestionJobDetail,
  DocumentIngestionSummary,
  GenerateDocumentExtractionCandidatesInput,
  ListDocumentExtractionCandidatesParams,
  ListDocumentExtractionCandidatesQuery,
  ListDocumentIngestionJobsParams,
  ListDocumentIngestionJobsQuery,
  PropertyDocumentIngestionSummary,
  ReviewDocumentExtractionCandidateInput,
  ReviewDocumentExtractionInput,
} from '@/lib/api/document-ingestion';

// Credentials
export { credentialsApi } from '@/lib/api/credentials';

// Provider / Marketplace
export {
  providerApi,
  providerNetworkApi,
  PROVIDER_CATEGORY_OPTIONS,
} from '@/lib/api/provider';
export { shareApi } from '@/lib/api/share';
export { providerNetworkApi as marketplaceApi } from '@/lib/api/provider';

// Rooms
export { roomsApi } from '@/lib/api/rooms';
export type { Room, RoomType } from '@/lib/api/rooms';

// Technical Systems & Points
export { technicalSystemsApi, technicalPointsApi } from '@/lib/api/technical-systems';
export type {
  TechnicalPointType,
  TechnicalPointRiskLevel,
  TechnicalPoint,
  CreateTechnicalPointInput,
  UpdateTechnicalPointInput,
  TechnicalPointFilterInput,
  TechnicalSystemType,
  TechnicalSystemStatus,
  TechnicalSystem,
  CreateTechnicalSystemInput,
  UpdateTechnicalSystemInput,
} from '@/lib/api/technical-systems';

// Premium history
export { warrantiesApi } from '@/lib/api/warranties';
export type {
  Warranty,
  WarrantyCreateInput,
  WarrantyFilters,
  WarrantyUpdateInput,
} from '@/lib/api/warranties';
export { renovationsApi } from '@/lib/api/renovations';
export type {
  Renovation,
  RenovationCreateInput,
  RenovationFilters,
  RenovationUpdateInput,
} from '@/lib/api/renovations';
export { handoverChecklistApi, handoverPackagesApi } from '@/lib/api/handover';
export type {
  HandoverChecklistItem,
  HandoverChecklistItemCreateInput,
  HandoverChecklistItemFilters,
  HandoverChecklistItemStatusInput,
  HandoverChecklistItemUpdateInput,
  HandoverPackageIssueInput,
  HandoverPackageIssueResponse,
  HandoverPackage,
  HandoverPackageCreateInput,
  HandoverPackageFilters,
  HandoverPackageUpdateInput,
} from '@/lib/api/handover';

// Inventory
export { inventoryApi } from '@/lib/api/inventory';
export type { InventoryItem, InventoryMutationInput, InventoryCategory, ColorEntry } from '@/lib/api/inventory';

// Services, Bids, Messages, Audit
export { servicesApi, auditApi, bidsApi, messagesApi } from '@/lib/api/services';
export type { AuditLinkData, ServiceMessage } from '@/lib/api/services';

// Expenses & Reports
export { expensesApi, reportsApi } from '@/lib/api/expenses';
export type { Expense, ExpenseCategory, ExpenseSummary, HealthScoreReport, ValuationPayload } from '@/lib/api/expenses';

// Maintenance
export { maintenanceApi } from '@/lib/api/maintenance';
export type { MaintenanceSchedule, MaintenanceFrequency } from '@/lib/api/maintenance';

// Invites & Collaborators
export { invitesApi } from '@/lib/api/invites';
export type {
  PropertyCollaborator,
  PropertyTemporaryProvider,
  PropertyProviderHistory,
  PropertyInvite,
  InviteDetails,
  InviteCardSuggestion,
} from '@/lib/api/invites';

// Search
export { searchApi } from '@/lib/api/search';
export type { SearchResult } from '@/lib/api/search';

// Service Requests
export { serviceRequestsApi } from '@/lib/api/service-requests';
export type {
  ServiceRequestSummary,
  ServiceRequestBid,
  ServiceRequestConvertPayload,
} from '@/lib/api/service-requests';

// Web Push
export { pushApi } from '@/lib/api/push';
