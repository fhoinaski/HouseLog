import { z } from 'zod';

export const handoverPackageTypeSchema = z.enum([
  'handover',
  'move_in',
  'move_out',
  'inspection',
]);

export const HandoverPackageStatusSchema = z.enum([
  'draft',
  'in_review',
  'ready_to_issue',
  'issued',
  'accepted',
  'revoked',
  'expired',
]);
export const handoverPackageStatusSchema = HandoverPackageStatusSchema;

const optionalNullableString = z.string().max(2000).optional().nullable();
const optionalNullableId = z.string().min(1).optional().nullable();

export const HandoverPackageSnapshotSchema = z.object({
  generatedAt: z.string(),
  property: z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    address: z.string(),
    city: z.string(),
    areaM2: z.number().nullable(),
    yearBuilt: z.number().nullable(),
    structure: z.string().nullable(),
    floors: z.number().nullable(),
    healthScore: z.number(),
  }).strict(),
  package: z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    version: z.number().int().positive(),
    status: handoverPackageStatusSchema,
  }).strict(),
  rooms: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    floor: z.number().nullable(),
    areaM2: z.number().nullable(),
  }).strict()).default([]),
  documents: z.array(z.object({
    id: z.string(),
    title: z.string(),
    type: z.string(),
    issueDate: z.string().nullable(),
    expiryDate: z.string().nullable(),
  }).strict()).default([]),
  technicalSystems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    status: z.string(),
    locationSummary: z.string().nullable(),
    lastInspectionAt: z.string().nullable(),
  }).strict()).default([]),
  inventoryItems: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    roomId: z.string().nullable(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    warrantyUntil: z.string().nullable(),
  }).strict()).default([]),
  warranties: z.array(z.object({
    id: z.string(),
    title: z.string(),
    warrantyType: z.string(),
    status: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string(),
    providerName: z.string().nullable(),
  }).strict()).default([]),
  maintenanceSchedules: z.array(z.object({
    id: z.string(),
    title: z.string(),
    systemType: z.string(),
    responsible: z.string().nullable(),
    frequency: z.string().nullable(),
    lastDone: z.string().nullable(),
    nextDue: z.string().nullable(),
    autoCreateOs: z.boolean(),
  }).strict()).default([]),
  checklistItems: z.array(z.object({
    id: z.string(),
    title: z.string(),
    category: z.string(),
    status: z.string(),
    required: z.boolean(),
    condition: z.string().nullable(),
    completedAt: z.string().nullable(),
    roomId: z.string().nullable(),
    documentId: z.string().nullable(),
    inventoryItemId: z.string().nullable(),
    serviceOrderId: z.string().nullable(),
  }).strict()).default([]),
}).strict();

export const HandoverPackagePrivateDtoSchema = z.object({
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
  issued_at: z.string().nullable(),
  issued_by: z.string().nullable(),
  accepted_at: z.string().nullable(),
  accepted_by_name: z.string().nullable(),
  accepted_by_email: z.string().nullable(),
  revoked_at: z.string().nullable(),
  revoked_by: z.string().nullable(),
  revoke_reason: z.string().nullable(),
  expires_at: z.string().nullable(),
  snapshot_json: HandoverPackageSnapshotSchema.nullable(),
  package_hash: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
}).strict();

export const HandoverPackagePublicDtoSchema = z.object({
  id: z.string(),
  property_id: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  issuerName: z.string().max(160).nullable(),
  issuerRole: z.string().max(80).nullable(),
  responsibleName: z.string().max(160).nullable(),
  companyName: z.string().max(160).nullable(),
  type: handoverPackageTypeSchema,
  status: handoverPackageStatusSchema,
  version: z.number().int().positive(),
  issued_at: z.string().nullable(),
  accepted_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  snapshot_json: HandoverPackageSnapshotSchema,
}).strict();

export const handoverPackageSchema = HandoverPackagePrivateDtoSchema;

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
}).strict();

export const handoverPackageUpdateSchema = handoverPackageCreateSchema.partial();

export const HandoverPackageIssueInputSchema = z.object({
  expires_at: z.string().optional().nullable(),
  snapshot_json: HandoverPackageSnapshotSchema,
  notes: optionalNullableString,
}).strict();

export const HandoverPackageRevokeInputSchema = z.object({
  revoke_reason: z.string().min(1, 'Informe o motivo da revogacao.').max(500),
}).strict();

export const HandoverPackageAcceptInputSchema = z.object({
  accepted_by_name: z.string().min(1, 'Informe o nome de quem recebeu.').max(120),
  accepted_by_email: z.string().email().optional().nullable(),
}).strict();

export const PublicHandoverPackageAcceptInputSchema = z.object({
  acceptedByName: z.string().trim().min(1, 'Informe seu nome.').max(120),
  acceptedByEmail: z.string().trim().email('Informe um email valido.').max(160),
  acceptanceNotes: z.string().trim().max(1000).optional().nullable(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'Confirme a ciencia para registrar o aceite.' }),
  }),
}).strict();

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
}).strict();

export type HandoverPackageType = z.infer<typeof handoverPackageTypeSchema>;
export type HandoverPackageStatus = z.infer<typeof handoverPackageStatusSchema>;
export type HandoverPackage = z.infer<typeof handoverPackageSchema>;
export type HandoverPackagePublic = z.infer<typeof HandoverPackagePublicDtoSchema>;
export type HandoverPackagePrivate = z.infer<typeof HandoverPackagePrivateDtoSchema>;
export type HandoverPackageSnapshot = z.infer<typeof HandoverPackageSnapshotSchema>;
export type HandoverPackageCreateInput = z.infer<typeof handoverPackageCreateSchema>;
export type HandoverPackageUpdateInput = z.infer<typeof handoverPackageUpdateSchema>;
export type HandoverPackageFilterInput = z.infer<typeof handoverPackageFilterSchema>;
export type HandoverPackageIssueInput = z.infer<typeof HandoverPackageIssueInputSchema>;
export type HandoverPackageRevokeInput = z.infer<typeof HandoverPackageRevokeInputSchema>;
export type HandoverPackageAcceptInput = z.infer<typeof HandoverPackageAcceptInputSchema>;
export type PublicHandoverPackageAcceptInput = z.infer<typeof PublicHandoverPackageAcceptInputSchema>;

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
