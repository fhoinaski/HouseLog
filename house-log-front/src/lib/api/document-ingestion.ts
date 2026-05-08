import { qs, request } from '@/lib/api/_core';
import type { CursorPage } from '@/lib/api/_core';
import type {
  CreateDocumentIngestionJobInput,
  DocumentExtractionCandidate,
  DocumentExtractionCandidateStatus,
  DocumentExtractionCandidateType,
  DocumentExtractionDetail,
  DocumentExtractionReview,
  DocumentExtractionSummary,
  DocumentIngestionJob,
  DocumentIngestionSummary,
  ExtractedInventoryItem,
  ExtractedTechnicalSystem,
  ExtractedWarranty,
  GenerateDocumentExtractionCandidatesInput,
  ListDocumentExtractionCandidatesQuery,
  ListDocumentIngestionJobsQuery,
  MaintenanceFrequency,
  ReviewDocumentExtractionCandidateInput,
  ReviewDocumentExtractionInput,
  TechnicalSystemStatus,
  WarrantyStatus,
} from '@houselog/contracts';

export type {
  CreateDocumentIngestionJobInput,
  DocumentExtractionCandidate,
  DocumentExtractionCandidateStatus,
  DocumentExtractionCandidateType,
  DocumentExtractionDetail,
  DocumentExtractionReview,
  DocumentExtractionSummary,
  DocumentIngestionJob,
  DocumentIngestionSummary,
  GenerateDocumentExtractionCandidatesInput,
  ListDocumentExtractionCandidatesQuery,
  ListDocumentIngestionJobsQuery,
  ReviewDocumentExtractionCandidateInput,
  ReviewDocumentExtractionInput,
};

export type DocumentIngestionJobDetail = {
  job: DocumentIngestionJob;
  extractions: DocumentExtractionSummary[];
};

export type DocumentExtractionCandidatesPage = {
  candidates: DocumentExtractionCandidate[];
  next_cursor: string | null;
  has_more: boolean;
};

export type AppliedTechnicalSystem = {
  id: string;
  propertyId: string;
  name: string;
  type: ExtractedTechnicalSystem['type'];
  description: string | null;
  locationSummary: string | null;
  installationDate: string | null;
  status: TechnicalSystemStatus;
  createdAt: string;
  updatedAt: string | null;
};

export type AppliedWarranty = {
  id: string;
  propertyId: string;
  documentId: string | null;
  title: string;
  description: string | null;
  providerName: string | null;
  warrantyType: ExtractedWarranty['warrantyType'];
  startDate: string | null;
  endDate: string;
  status: WarrantyStatus;
  coverage: string | null;
  exclusions: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
};

export type AppliedInventoryItem = {
  id: string;
  propertyId: string;
  category: ExtractedInventoryItem['category'];
  name: string;
  brand: string | null;
  model: string | null;
  supplier: string | null;
  quantity: number | null;
  unit: string | null;
  purchaseDate: string | null;
  warrantyUntil: string | null;
  createdAt: string;
};

export type AppliedMaintenanceSchedule = {
  id: string;
  propertyId: string;
  systemType: string;
  title: string;
  description: string | null;
  frequency: MaintenanceFrequency;
  lastDone: string | null;
  nextDue: string | null;
  responsible: string | null;
  autoCreateOs: number | null;
  notes: string | null;
  createdAt: string;
};

export type ApplyDocumentExtractionCandidateResponse =
  | { candidate: DocumentExtractionCandidate; technicalSystem: AppliedTechnicalSystem }
  | { candidate: DocumentExtractionCandidate; warranty: AppliedWarranty }
  | { candidate: DocumentExtractionCandidate; inventoryItem: AppliedInventoryItem }
  | { candidate: DocumentExtractionCandidate; maintenanceSchedule: AppliedMaintenanceSchedule };

export type ListDocumentIngestionJobsParams = Partial<ListDocumentIngestionJobsQuery>;
export type ListDocumentExtractionCandidatesParams = Partial<ListDocumentExtractionCandidatesQuery>;

function documentIngestionPath(propertyId: string, documentId: string): string {
  return `/properties/${propertyId}/documents/${documentId}`;
}

function documentExtractionPath(
  propertyId: string,
  documentId: string,
  jobId: string,
  extractionId: string
): string {
  return `${documentIngestionPath(propertyId, documentId)}/ingestion-jobs/${jobId}/extractions/${extractionId}`;
}

export const documentIngestionApi = {
  summary: (propertyId: string, documentId: string) =>
    request<{ summary: DocumentIngestionSummary }>(
      `${documentIngestionPath(propertyId, documentId)}/ingestion-summary`
    ),

  createJob: (
    propertyId: string,
    documentId: string,
    data: CreateDocumentIngestionJobInput = {}
  ) =>
    request<{ job: DocumentIngestionJob }>(
      `${documentIngestionPath(propertyId, documentId)}/ingestion-jobs`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  listJobs: (
    propertyId: string,
    documentId: string,
    params?: ListDocumentIngestionJobsParams
  ) =>
    request<CursorPage<DocumentIngestionJob>>(
      `${documentIngestionPath(propertyId, documentId)}/ingestion-jobs${qs(params)}`
    ),

  getJob: (propertyId: string, documentId: string, jobId: string) =>
    request<DocumentIngestionJobDetail>(
      `${documentIngestionPath(propertyId, documentId)}/ingestion-jobs/${jobId}`
    ),

  getExtraction: (
    propertyId: string,
    documentId: string,
    jobId: string,
    extractionId: string
  ) =>
    request<{ extraction: DocumentExtractionDetail }>(
      documentExtractionPath(propertyId, documentId, jobId, extractionId)
    ),

  reviewExtraction: (
    propertyId: string,
    documentId: string,
    jobId: string,
    extractionId: string,
    data: ReviewDocumentExtractionInput
  ) =>
    request<{ review: DocumentExtractionReview }>(
      `${documentExtractionPath(propertyId, documentId, jobId, extractionId)}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    ),

  generateCandidates: (
    propertyId: string,
    documentId: string,
    jobId: string,
    extractionId: string,
    data: GenerateDocumentExtractionCandidatesInput = {}
  ) =>
    request<{ candidates: DocumentExtractionCandidate[] }>(
      `${documentExtractionPath(propertyId, documentId, jobId, extractionId)}/candidates/generate`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  listCandidates: (
    propertyId: string,
    documentId: string,
    jobId: string,
    extractionId: string,
    params?: ListDocumentExtractionCandidatesParams
  ) =>
    request<DocumentExtractionCandidatesPage>(
      `${documentExtractionPath(propertyId, documentId, jobId, extractionId)}/candidates${qs(params)}`
    ),

  reviewCandidate: (
    propertyId: string,
    documentId: string,
    jobId: string,
    extractionId: string,
    candidateId: string,
    data: ReviewDocumentExtractionCandidateInput
  ) =>
    request<{ candidate: DocumentExtractionCandidate }>(
      `${documentExtractionPath(propertyId, documentId, jobId, extractionId)}/candidates/${candidateId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    ),

  applyCandidate: (
    propertyId: string,
    documentId: string,
    jobId: string,
    extractionId: string,
    candidateId: string
  ) =>
    request<ApplyDocumentExtractionCandidateResponse>(
      `${documentExtractionPath(propertyId, documentId, jobId, extractionId)}/candidates/${candidateId}/apply`,
      {
        method: 'POST',
      }
    ),
};
