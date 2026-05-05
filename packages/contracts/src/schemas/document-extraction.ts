import { z } from 'zod';
import { inventoryCategorySchema } from './inventory';
import { technicalSystemTypeSchema } from './technical-system';
import { warrantyTypeSchema } from './warranty';

const confidenceScoreSchema = z.number().min(0).max(1);

export const propertyDocumentExtractionDocumentTypeSchema = z.enum([
  'invoice',
  'manual',
  'project',
  'contract',
  'deed',
  'permit',
  'insurance',
  'warranty',
  'inspection_report',
  'handover',
  'other',
]);

export const extractedMaintenancePrioritySchema = z.enum([
  'low',
  'medium',
  'high',
  'critical',
]);

export const SourceEvidenceSchema = z.object({
  pageNumber: z.number().optional(),
  text: z.string().min(1),
  confidenceScore: confidenceScoreSchema,
  fieldPath: z.string().optional(),
  notes: z.string().optional(),
}).strict();

export const ExtractedTechnicalSystemSchema = z.object({
  type: technicalSystemTypeSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  locationSummary: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installationDate: z.string().optional(),
  warrantyUntil: z.string().optional(),
  confidenceScore: confidenceScoreSchema,
  evidence: z.array(SourceEvidenceSchema).default([]),
}).strict();

export const ExtractedWarrantySchema = z.object({
  title: z.string().min(1),
  warrantyType: warrantyTypeSchema,
  providerName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  coverage: z.string().optional(),
  exclusions: z.string().optional(),
  confidenceScore: confidenceScoreSchema,
  evidence: z.array(SourceEvidenceSchema).default([]),
}).strict();

export const ExtractedInventoryItemSchema = z.object({
  category: inventoryCategorySchema,
  name: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  supplier: z.string().optional(),
  quantity: z.number().min(0).optional(),
  unit: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyUntil: z.string().optional(),
  confidenceScore: confidenceScoreSchema,
  evidence: z.array(SourceEvidenceSchema).default([]),
}).strict();

export const ExtractedMaintenanceRecommendationSchema = z.object({
  systemType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  recommendedIntervalMonths: z.number().int().positive().optional(),
  firstDueDate: z.string().optional(),
  priority: extractedMaintenancePrioritySchema,
  standardReference: z.string().optional(),
  confidenceScore: confidenceScoreSchema,
  evidence: z.array(SourceEvidenceSchema).default([]),
}).strict();

export const ExtractedDateSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  confidenceScore: confidenceScoreSchema,
}).strict();

export const PropertyDocumentExtractionSchema = z.object({
  documentType: propertyDocumentExtractionDocumentTypeSchema,
  summary: z.string().optional(),
  language: z.string().optional(),
  confidenceScore: confidenceScoreSchema,
  technicalSystems: z.array(ExtractedTechnicalSystemSchema).default([]),
  warranties: z.array(ExtractedWarrantySchema).default([]),
  inventoryItems: z.array(ExtractedInventoryItemSchema).default([]),
  maintenanceRecommendations: z.array(ExtractedMaintenanceRecommendationSchema).default([]),
  detectedDates: z.array(ExtractedDateSchema).default([]),
  warnings: z.array(z.string()).default([]),
  evidence: z.array(SourceEvidenceSchema).default([]),
  schemaVersion: z.string().min(1),
}).strict();

export type PropertyDocumentExtractionDocumentType = z.infer<typeof propertyDocumentExtractionDocumentTypeSchema>;
export type ExtractedMaintenancePriority = z.infer<typeof extractedMaintenancePrioritySchema>;
export type SourceEvidence = z.infer<typeof SourceEvidenceSchema>;
export type ExtractedTechnicalSystem = z.infer<typeof ExtractedTechnicalSystemSchema>;
export type ExtractedWarranty = z.infer<typeof ExtractedWarrantySchema>;
export type ExtractedInventoryItem = z.infer<typeof ExtractedInventoryItemSchema>;
export type ExtractedMaintenanceRecommendation = z.infer<typeof ExtractedMaintenanceRecommendationSchema>;
export type ExtractedDate = z.infer<typeof ExtractedDateSchema>;
export type PropertyDocumentExtraction = z.infer<typeof PropertyDocumentExtractionSchema>;
