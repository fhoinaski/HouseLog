import { z } from 'zod';

export const warrantyTypeSchema = z.enum([
  'service',
  'equipment',
  'material',
  'structural',
  'appliance',
  'finish',
  'other',
]);

export const warrantyStatusSchema = z.enum([
  'active',
  'expired',
  'claimed',
  'void',
]);

const optionalNullableString = z.string().max(2000).optional().nullable();
const optionalNullableId = z.string().min(1).optional().nullable();

export const warrantySchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  property_id: z.string(),
  room_id: z.string().nullable(),
  service_order_id: z.string().nullable(),
  document_id: z.string().nullable(),
  inventory_item_id: z.string().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  provider_name: z.string().nullable(),
  warranty_type: warrantyTypeSchema,
  start_date: z.string().nullable(),
  end_date: z.string(),
  status: warrantyStatusSchema,
  coverage: z.string().nullable(),
  exclusions: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export const warrantyCreateSchema = z.object({
  room_id: optionalNullableId,
  service_order_id: optionalNullableId,
  document_id: optionalNullableId,
  inventory_item_id: optionalNullableId,
  title: z.string().min(1, 'Informe o titulo da garantia.').max(160),
  description: optionalNullableString,
  provider_name: z.string().max(160).optional().nullable(),
  warranty_type: warrantyTypeSchema,
  start_date: z.string().optional().nullable(),
  end_date: z.string().min(1, 'Informe a data final da garantia.'),
  status: warrantyStatusSchema.default('active'),
  coverage: optionalNullableString,
  exclusions: optionalNullableString,
});

export const warrantyUpdateSchema = warrantyCreateSchema.partial();

export const warrantyFilterSchema = z.object({
  status: warrantyStatusSchema.optional(),
  warrantyType: warrantyTypeSchema.optional(),
  roomId: z.string().optional(),
  serviceOrderId: z.string().optional(),
  documentId: z.string().optional(),
  inventoryItemId: z.string().optional(),
});

export type WarrantyType = z.infer<typeof warrantyTypeSchema>;
export type WarrantyStatus = z.infer<typeof warrantyStatusSchema>;
export type Warranty = z.infer<typeof warrantySchema>;
export type WarrantyCreateInput = z.infer<typeof warrantyCreateSchema>;
export type WarrantyUpdateInput = z.infer<typeof warrantyUpdateSchema>;
export type WarrantyFilterInput = z.infer<typeof warrantyFilterSchema>;
