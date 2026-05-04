import { z } from 'zod';

export const maintenanceFrequencySchema = z.enum([
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
]);

export const maintenanceCreateSchema = z.object({
  system_type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  frequency: maintenanceFrequencySchema,
  responsible: z.string().optional(),
  last_done: z.string().optional(),
  auto_create_os: z.boolean().default(false),
  notes: z.string().optional(),
});

export const maintenanceUpdateSchema = maintenanceCreateSchema.partial();

export type MaintenanceFrequency = z.infer<typeof maintenanceFrequencySchema>;
export type MaintenanceCreateInput = z.infer<typeof maintenanceCreateSchema>;
export type MaintenanceUpdateInput = z.infer<typeof maintenanceUpdateSchema>;
