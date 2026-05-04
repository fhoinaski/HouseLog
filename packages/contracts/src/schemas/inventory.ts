import { z } from 'zod';

export const inventoryCategorySchema = z.enum([
  'paint',
  'tile',
  'waterproof',
  'plumbing',
  'electrical',
  'hardware',
  'adhesive',
  'sealant',
  'other',
]);

export const inventoryCreateSchema = z.object({
  category: inventoryCategorySchema,
  name: z.string().min(1),
  room_id: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  color_code: z.string().optional(),
  lot_number: z.string().optional(),
  supplier: z.string().optional(),
  quantity: z.number().min(0).default(0),
  unit: z.string().default('un'),
  reserve_qty: z.number().min(0).default(0),
  storage_loc: z.string().optional(),
  price_paid: z.number().positive().optional(),
  purchase_date: z.string().optional(),
  notes: z.string().optional(),
});

export const inventoryUpdateSchema = inventoryCreateSchema.partial();

export type InventoryCategory = z.infer<typeof inventoryCategorySchema>;
export type InventoryCreateInput = z.infer<typeof inventoryCreateSchema>;
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateSchema>;
