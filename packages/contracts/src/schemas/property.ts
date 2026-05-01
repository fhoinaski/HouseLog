import { z } from 'zod';

export const propertyTypeSchema = z.enum(['house', 'apt', 'commercial', 'warehouse']);

export const propertyCreateSchema = z.object({
  name: z.string().min(1),
  type: propertyTypeSchema,
  address: z.string().min(1),
  city: z.string().min(1),
  area_m2: z.number().positive().optional(),
  year_built: z.number().int().min(1800).max(2100).optional(),
  structure: z.string().optional(),
  floors: z.number().int().min(1).default(1),
  owner_id: z.string().optional(),
});

export const propertyUpdateSchema = propertyCreateSchema.partial().extend({
  cover_url: z.string().url().optional().nullable(),
});

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>;
