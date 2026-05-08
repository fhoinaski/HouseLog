import { z } from 'zod';

export const DocumentExtractionCandidateTypeSchema = z.enum([
  'technical_system',
  'warranty',
  'inventory_item',
  'maintenance_recommendation',
]);

export const DocumentExtractionCandidateStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'applied',
  'superseded',
]);

export const DocumentExtractionCandidateTargetEntityTypeSchema = z.enum([
  'technical_system',
  'warranty',
  'inventory_item',
  'maintenance_schedule',
  'none',
]);

export const DocumentExtractionCandidateSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  jobId: z.string(),
  extractionId: z.string(),
  candidateType: DocumentExtractionCandidateTypeSchema,
  status: DocumentExtractionCandidateStatusSchema,
  targetEntityType: DocumentExtractionCandidateTargetEntityTypeSchema,
  targetEntityId: z.string().nullable(),
  sourcePath: z.string(),
  payloadJson: z.record(z.unknown()),
  confidenceScore: z.number().min(0).max(1).nullable(),
  reviewNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  appliedAt: z.string().nullable(),
  appliedBy: z.string().nullable(),
});

export const GenerateDocumentExtractionCandidatesInputSchema = z.object({}).strict();

export const ListDocumentExtractionCandidatesQuerySchema = z.object({
  status: DocumentExtractionCandidateStatusSchema.optional(),
}).strict();

export const ReviewDocumentExtractionCandidateInputSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNotes: z.string().optional(),
}).strict();

export type DocumentExtractionCandidateType = z.infer<typeof DocumentExtractionCandidateTypeSchema>;
export type DocumentExtractionCandidateStatus = z.infer<typeof DocumentExtractionCandidateStatusSchema>;
export type DocumentExtractionCandidateTargetEntityType = z.infer<typeof DocumentExtractionCandidateTargetEntityTypeSchema>;
export type DocumentExtractionCandidate = z.infer<typeof DocumentExtractionCandidateSchema>;
export type GenerateDocumentExtractionCandidatesInput = z.infer<typeof GenerateDocumentExtractionCandidatesInputSchema>;
export type ListDocumentExtractionCandidatesQuery = z.infer<typeof ListDocumentExtractionCandidatesQuerySchema>;
export type ReviewDocumentExtractionCandidateInput = z.infer<typeof ReviewDocumentExtractionCandidateInputSchema>;
