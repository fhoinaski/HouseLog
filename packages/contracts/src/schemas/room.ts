import { z } from 'zod';

export const roomTypeSchema = z.enum([
  'bedroom',
  'bathroom',
  'kitchen',
  'living',
  'garage',
  'laundry',
  'external',
  'roof',
  'other',
]);

export const roomCreateSchema = z.object({
  name: z.string().min(1),
  type: roomTypeSchema,
  floor: z.number().int().default(0),
  area_m2: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const roomUpdateSchema = roomCreateSchema.partial();

export type RoomType = z.infer<typeof roomTypeSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
