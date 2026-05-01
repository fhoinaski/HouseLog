import { z } from 'zod';

export const technicalSystemTypeSchema = z.enum([
  'electrical',
  'plumbing',
  'sewage',
  'gas',
  'hvac',
  'solar',
  'automation',
  'network',
  'pool',
  'irrigation',
  'security',
  'fire',
  'waterproofing',
  'roofing',
  'structural',
  'finishes',
  'custom',
]);

export const technicalSystemStatusSchema = z.enum([
  'active',
  'attention',
  'critical',
  'inactive',
  'replaced',
]);

export const technicalSystemSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  property_id: z.string(),
  name: z.string().min(1),
  type: technicalSystemTypeSchema,
  description: z.string().nullable(),
  location_summary: z.string().nullable(),
  responsible_provider_id: z.string().nullable(),
  installation_date: z.string().nullable(),
  last_inspection_at: z.string().nullable(),
  status: technicalSystemStatusSchema,
  created_at: z.string(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export const createTechnicalSystemSchema = z.object({
  name: z.string().min(1, 'Informe o nome do sistema.').max(120),
  type: technicalSystemTypeSchema,
  description: z.string().max(2000).optional().nullable(),
  location_summary: z.string().max(500).optional().nullable(),
  responsible_provider_id: z.string().optional().nullable(),
  installation_date: z.string().optional().nullable(),
  last_inspection_at: z.string().optional().nullable(),
  status: technicalSystemStatusSchema.default('active'),
});

export const updateTechnicalSystemSchema = createTechnicalSystemSchema.partial();

export type TechnicalSystemType = z.infer<typeof technicalSystemTypeSchema>;
export type TechnicalSystemStatus = z.infer<typeof technicalSystemStatusSchema>;
export type TechnicalSystem = z.infer<typeof technicalSystemSchema>;
export type CreateTechnicalSystemInput = z.infer<typeof createTechnicalSystemSchema>;
export type UpdateTechnicalSystemInput = z.infer<typeof updateTechnicalSystemSchema>;
