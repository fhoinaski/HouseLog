import { z } from 'zod';
import { PropertyDocumentExtractionSchema } from './document-extraction';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const DocumentIngestionJobStatusSchema = z.enum([
  'queued',
  'processing',
  'needs_review',
  'completed',
  'failed',
  'cancelled',
]);

export const DocumentIngestionProviderSchema = z.enum([
  'cloudflare_ai',
  'openai',
  'anthropic',
  'gemini',
  'manual',
  'none',
]);

export const DocumentExtractionReviewStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'partially_applied',
]);

// ── Response DTOs ──────────────────────────────────────────────────────────────

export const DocumentIngestionJobSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  propertyId: z.string(),
  status: DocumentIngestionJobStatusSchema,
  provider: DocumentIngestionProviderSchema,
  modelName: z.string().nullable().optional(),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DocumentExtractionSummarySchema = z.object({
  id: z.string(),
  documentId: z.string(),
  jobId: z.string(),
  confidenceScore: z.number().min(0).max(1).nullable().optional(),
  schemaVersion: z.string(),
  modelName: z.string().nullable().optional(),
  createdAt: z.string(),
  hasRawText: z.boolean(),
  hasRawJson: z.boolean(),
  hasNormalizedJson: z.boolean(),
});

export const DocumentExtractionReviewSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  extractionId: z.string(),
  status: DocumentExtractionReviewStatusSchema,
  reviewedBy: z.string().nullable().optional(),
  reviewedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const DocumentExtractionDetailSchema = DocumentExtractionSummarySchema.extend({
  rawText: z.string().nullable().optional(),
  rawJson: z.record(z.unknown()).nullable().optional(),
  normalizedJson: PropertyDocumentExtractionSchema.nullable().optional(),
  review: DocumentExtractionReviewSchema.nullable().default(null),
});

// ── Input schemas ──────────────────────────────────────────────────────────────

export const DocumentIngestionSummarySchema = z.object({
  totalJobs: z.number().int().nonnegative(),
  latestJobStatus: DocumentIngestionJobStatusSchema.nullable(),
  totalExtractions: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  totalCandidates: z.number().int().nonnegative(),
  pendingCandidates: z.number().int().nonnegative(),
  approvedCandidates: z.number().int().nonnegative(),
  rejectedCandidates: z.number().int().nonnegative(),
  appliedCandidates: z.number().int().nonnegative(),
  failedJobs: z.number().int().nonnegative(),
  lastIngestionAt: z.string().nullable(),
});

export const PropertyDocumentIngestionSummarySchema = z.object({
  totalDocuments: z.number().int().nonnegative(),
  documentsWithIngestion: z.number().int().nonnegative(),
  totalJobs: z.number().int().nonnegative(),
  processingJobs: z.number().int().nonnegative(),
  failedJobs: z.number().int().nonnegative(),
  needsReviewJobs: z.number().int().nonnegative(),
  totalExtractions: z.number().int().nonnegative(),
  pendingExtractionReviews: z.number().int().nonnegative(),
  totalCandidates: z.number().int().nonnegative(),
  pendingCandidates: z.number().int().nonnegative(),
  approvedCandidates: z.number().int().nonnegative(),
  rejectedCandidates: z.number().int().nonnegative(),
  appliedCandidates: z.number().int().nonnegative(),
  lastIngestionAt: z.string().nullable(),
  latestStatus: DocumentIngestionJobStatusSchema.nullable(),
});

export const CreateDocumentIngestionJobInputSchema = z.object({
  provider: DocumentIngestionProviderSchema.optional(),
  modelName: z.string().optional(),
}).strict();

export const ListDocumentIngestionJobsQuerySchema = z.object({
  status: DocumentIngestionJobStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
}).strict();

export const ReviewDocumentExtractionInputSchema = z.object({
  status: z.enum(['approved', 'rejected', 'partially_applied']),
  notes: z.string().optional(),
}).strict();

// ── TypeScript types ───────────────────────────────────────────────────────────

export type DocumentIngestionJobStatus = z.infer<typeof DocumentIngestionJobStatusSchema>;
export type DocumentIngestionProvider = z.infer<typeof DocumentIngestionProviderSchema>;
export type DocumentExtractionReviewStatus = z.infer<typeof DocumentExtractionReviewStatusSchema>;
export type DocumentIngestionJob = z.infer<typeof DocumentIngestionJobSchema>;
export type DocumentExtractionSummary = z.infer<typeof DocumentExtractionSummarySchema>;
export type DocumentExtractionDetail = z.infer<typeof DocumentExtractionDetailSchema>;
export type DocumentExtractionReview = z.infer<typeof DocumentExtractionReviewSchema>;
export type DocumentIngestionSummary = z.infer<typeof DocumentIngestionSummarySchema>;
export type PropertyDocumentIngestionSummary = z.infer<typeof PropertyDocumentIngestionSummarySchema>;
export type CreateDocumentIngestionJobInput = z.infer<typeof CreateDocumentIngestionJobInputSchema>;
export type ListDocumentIngestionJobsQuery = z.infer<typeof ListDocumentIngestionJobsQuerySchema>;
export type ReviewDocumentExtractionInput = z.infer<typeof ReviewDocumentExtractionInputSchema>;
