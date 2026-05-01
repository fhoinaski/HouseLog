import { z } from 'zod';

export const serviceOrderSystemTypeSchema = z.enum([
  'electrical',
  'plumbing',
  'structural',
  'waterproofing',
  'painting',
  'flooring',
  'roofing',
  'general',
]);

export const serviceOrderStatusSchema = z.enum([
  'requested',
  'approved',
  'in_progress',
  'completed',
  'verified',
]);

export const checklistItemSchema = z.object({
  item: z.string(),
  done: z.boolean(),
});

export const serviceOrderCreateSchema = z.object({
  title: z.string().min(1),
  system_type: serviceOrderSystemTypeSchema,
  description: z.string().optional(),
  room_id: z.string().optional(),
  priority: z.enum(['urgent', 'normal', 'preventive']).default('normal'),
  assigned_to: z.string().optional(),
  warranty_until: z.string().optional(),
  scheduled_at: z.string().optional(),
  checklist: z.array(checklistItemSchema).optional(),
});

export const serviceOrderUpdateSchema = serviceOrderCreateSchema.partial();

export type ServiceOrderCreateInput = z.infer<typeof serviceOrderCreateSchema>;
export type ServiceOrderUpdateInput = z.infer<typeof serviceOrderUpdateSchema>;
