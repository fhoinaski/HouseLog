import { z } from 'zod';

export const technicalPointTypeSchema = z.enum([
  'valve',
  'pipe',
  'drain',
  'inspection_box',
  'electrical_panel',
  'conduit',
  'outlet',
  'switch',
  'gas_line',
  'hvac_line',
  'network_point',
  'sensor',
  'waterproofing_area',
  'structural_element',
  'other',
]);

export const technicalPointRiskLevelSchema = z.enum(['low', 'medium', 'high']);

const coordinateSchema = z.number().min(0).max(100);

export const technicalPointSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  property_id: z.string(),
  technical_system_id: z.string().nullable(),
  room_id: z.string().nullable(),
  name: z.string().min(1),
  type: technicalPointTypeSchema,
  description: z.string().nullable(),
  position_x: coordinateSchema.nullable(),
  position_y: coordinateSchema.nullable(),
  floor: z.number().int(),
  reference_image_url: z.string().nullable(),
  risk_level: technicalPointRiskLevelSchema,
  created_at: z.string(),
  updated_at: z.string().nullable(),
  deleted_at: z.string().nullable(),
});

export const createTechnicalPointSchema = z.object({
  technical_system_id: z.string().optional().nullable(),
  room_id: z.string().optional().nullable(),
  name: z.string().min(1, 'Informe o nome do ponto tecnico.').max(120),
  type: technicalPointTypeSchema,
  description: z.string().max(2000).optional().nullable(),
  position_x: coordinateSchema.optional().nullable(),
  position_y: coordinateSchema.optional().nullable(),
  floor: z.number().int().default(0),
  reference_image_url: z.string().max(1000).optional().nullable(),
  risk_level: technicalPointRiskLevelSchema.default('low'),
});

export const updateTechnicalPointSchema = createTechnicalPointSchema.partial();

export const technicalPointFilterSchema = z.object({
  technicalSystemId: z.string().optional(),
  roomId: z.string().optional(),
  type: technicalPointTypeSchema.optional(),
  riskLevel: technicalPointRiskLevelSchema.optional(),
});

export type TechnicalPointType = z.infer<typeof technicalPointTypeSchema>;
export type TechnicalPointRiskLevel = z.infer<typeof technicalPointRiskLevelSchema>;
export type TechnicalPoint = z.infer<typeof technicalPointSchema>;
export type CreateTechnicalPointInput = z.infer<typeof createTechnicalPointSchema>;
export type UpdateTechnicalPointInput = z.infer<typeof updateTechnicalPointSchema>;
export type TechnicalPointFilterInput = z.infer<typeof technicalPointFilterSchema>;
