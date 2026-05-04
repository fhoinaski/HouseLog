import { z } from 'zod';

export const renovationCategorySchema = z.enum([
  'structural',
  'electrical',
  'plumbing',
  'finishing',
  'layout',
  'roofing',
  'waterproofing',
  'painting',
  'flooring',
  'other',
]);

export const renovationStatusSchema = z.enum([
  'planned',
  'in_progress',
  'completed',
  'cancelled',
]);

const optionalNullableString = z.string().max(2000).optional().nullable();
const optionalNullableId = z.string().min(1).optional().nullable();
const photoArraySchema = z.array(z.string().min(1).max(1000)).default([]);

export const renovationSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  property_id: z.string(),
  room_id: z.string().nullable(),
  service_order_id: z.string().nullable(),
  document_id: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  category: renovationCategorySchema,
  status: renovationStatusSchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  contractor_name: z.string().nullable(),
  contractor_id: z.string().nullable(),
  cost: z.number().nullable(),
  notes: z.string().nullable(),
  before_photos: z.array(z.string()),
  after_photos: z.array(z.string()),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export const renovationCreateSchema = z.object({
  room_id: optionalNullableId,
  service_order_id: optionalNullableId,
  document_id: optionalNullableId,
  title: z.string().min(1, 'Informe o titulo da reforma.').max(160),
  description: optionalNullableString,
  category: renovationCategorySchema,
  status: renovationStatusSchema.default('planned'),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  contractor_name: z.string().max(160).optional().nullable(),
  contractor_id: optionalNullableId,
  cost: z.number().nonnegative().optional().nullable(),
  notes: optionalNullableString,
  before_photos: photoArraySchema,
  after_photos: photoArraySchema,
});

export const renovationUpdateSchema = renovationCreateSchema.partial();

export const renovationFilterSchema = z.object({
  status: renovationStatusSchema.optional(),
  category: renovationCategorySchema.optional(),
  roomId: z.string().optional(),
  serviceOrderId: z.string().optional(),
  documentId: z.string().optional(),
  startedFrom: z.string().optional(),
  startedTo: z.string().optional(),
  completedFrom: z.string().optional(),
  completedTo: z.string().optional(),
});

export type RenovationCategory = z.infer<typeof renovationCategorySchema>;
export type RenovationStatus = z.infer<typeof renovationStatusSchema>;
export type Renovation = z.infer<typeof renovationSchema>;
export type RenovationCreateInput = z.infer<typeof renovationCreateSchema>;
export type RenovationUpdateInput = z.infer<typeof renovationUpdateSchema>;
export type RenovationFilterInput = z.infer<typeof renovationFilterSchema>;
