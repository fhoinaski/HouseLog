import { z } from 'zod';

export const handoverPackageTypeSchema = z.enum([
  'handover',
  'move_in',
  'move_out',
  'inspection',
]);

export const handoverPackageStatusSchema = z.enum([
  'draft',
  'in_review',
  'approved',
  'completed',
  'archived',
]);

const optionalNullableString = z.string().max(2000).optional().nullable();
const optionalNullableId = z.string().min(1).optional().nullable();

export const handoverPackageSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  property_id: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  type: handoverPackageTypeSchema,
  status: handoverPackageStatusSchema,
  version: z.number().int().positive(),
  prepared_by: z.string(),
  reviewed_by: z.string().nullable(),
  approved_by: z.string().nullable(),
  approved_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  summary_document_id: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export const handoverPackageCreateSchema = z.object({
  title: z.string().min(1, 'Informe o titulo do dossie.').max(160),
  description: optionalNullableString,
  type: handoverPackageTypeSchema.default('handover'),
  status: handoverPackageStatusSchema.default('draft'),
  version: z.number().int().positive().default(1),
  reviewed_by: optionalNullableId,
  approved_by: optionalNullableId,
  approved_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  summary_document_id: optionalNullableId,
  notes: optionalNullableString,
});

export const handoverPackageUpdateSchema = handoverPackageCreateSchema.partial();

export const handoverPackageFilterSchema = z.object({
  status: handoverPackageStatusSchema.optional(),
  type: handoverPackageTypeSchema.optional(),
  reviewedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  summaryDocumentId: z.string().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  completedFrom: z.string().optional(),
  completedTo: z.string().optional(),
});

export type HandoverPackageType = z.infer<typeof handoverPackageTypeSchema>;
export type HandoverPackageStatus = z.infer<typeof handoverPackageStatusSchema>;
export type HandoverPackage = z.infer<typeof handoverPackageSchema>;
export type HandoverPackageCreateInput = z.infer<typeof handoverPackageCreateSchema>;
export type HandoverPackageUpdateInput = z.infer<typeof handoverPackageUpdateSchema>;
export type HandoverPackageFilterInput = z.infer<typeof handoverPackageFilterSchema>;

export const handoverChecklistItemCategorySchema = z.enum([
  'keys',
  'documents',
  'utilities',
  'inventory',
  'cleaning',
  'maintenance',
  'safety',
  'general',
]);

export const handoverChecklistItemStatusSchema = z.enum([
  'pending',
  'done',
  'issue',
  'not_applicable',
]);

export const handoverChecklistItemConditionSchema = z.enum([
  'new',
  'good',
  'fair',
  'poor',
  'damaged',
]);

const evidenceUrlsSchema = z.array(z.string().min(1).max(1000)).default([]);

export const handoverChecklistItemSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  property_id: z.string(),
  handover_package_id: z.string(),
  room_id: z.string().nullable(),
  inventory_item_id: z.string().nullable(),
  document_id: z.string().nullable(),
  service_order_id: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  category: handoverChecklistItemCategorySchema,
  required: z.boolean(),
  status: handoverChecklistItemStatusSchema,
  condition: handoverChecklistItemConditionSchema.nullable(),
  evidence_urls: z.array(z.string()),
  notes: z.string().nullable(),
  sort_order: z.number().int().nonnegative(),
  completed_by: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export const handoverChecklistItemCreateSchema = z.object({
  room_id: optionalNullableId,
  inventory_item_id: optionalNullableId,
  document_id: optionalNullableId,
  service_order_id: optionalNullableId,
  title: z.string().min(1, 'Informe o item do checklist.').max(160),
  description: optionalNullableString,
  category: handoverChecklistItemCategorySchema.default('general'),
  required: z.boolean().default(true),
  status: handoverChecklistItemStatusSchema.default('pending'),
  condition: handoverChecklistItemConditionSchema.optional().nullable(),
  evidence_urls: evidenceUrlsSchema,
  notes: optionalNullableString,
  sort_order: z.number().int().nonnegative().default(0),
  completed_by: optionalNullableId,
  completed_at: z.string().optional().nullable(),
});

export const handoverChecklistItemUpdateSchema = handoverChecklistItemCreateSchema.partial();

export const handoverChecklistItemStatusUpdateSchema = z.object({
  status: handoverChecklistItemStatusSchema,
  completed_by: optionalNullableId,
  completed_at: z.string().optional().nullable(),
  notes: optionalNullableString,
});

export const handoverChecklistItemFilterSchema = z.object({
  status: handoverChecklistItemStatusSchema.optional(),
  category: handoverChecklistItemCategorySchema.optional(),
  required: z.enum(['true', 'false']).optional(),
  roomId: z.string().optional(),
  inventoryItemId: z.string().optional(),
  documentId: z.string().optional(),
  serviceOrderId: z.string().optional(),
  condition: handoverChecklistItemConditionSchema.optional(),
});

export type HandoverChecklistItemCategory = z.infer<typeof handoverChecklistItemCategorySchema>;
export type HandoverChecklistItemStatus = z.infer<typeof handoverChecklistItemStatusSchema>;
export type HandoverChecklistItemCondition = z.infer<typeof handoverChecklistItemConditionSchema>;
export type HandoverChecklistItem = z.infer<typeof handoverChecklistItemSchema>;
export type HandoverChecklistItemCreateInput = z.infer<typeof handoverChecklistItemCreateSchema>;
export type HandoverChecklistItemUpdateInput = z.infer<typeof handoverChecklistItemUpdateSchema>;
export type HandoverChecklistItemStatusUpdateInput = z.infer<typeof handoverChecklistItemStatusUpdateSchema>;
export type HandoverChecklistItemFilterInput = z.infer<typeof handoverChecklistItemFilterSchema>;
