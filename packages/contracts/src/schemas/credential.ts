import { z } from 'zod';

export const credentialCategorySchema = z.enum([
  'wifi',
  'alarm',
  'smart_lock',
  'gate',
  'app',
  'other',
]);

export const credentialIntegrationTypeSchema = z.enum(['intelbras']);

export const credentialCreateSchema = z.object({
  category: credentialCategorySchema.default('other'),
  label: z.string().min(1),
  username: z.string().optional(),
  secret: z.string().min(1),
  notes: z.string().optional(),
  integration_type: credentialIntegrationTypeSchema.optional().nullable(),
  integration_config: z.record(z.unknown()).optional().nullable(),
  share_with_os: z.boolean().default(false),
});

export const credentialUpdateSchema = credentialCreateSchema.partial();

export const credentialRevealSchema = z.object({
  reason: z.string().trim().min(10),
});

export type CredentialCategory = z.infer<typeof credentialCategorySchema>;
export type CredentialIntegrationType = z.infer<typeof credentialIntegrationTypeSchema>;
export type CredentialCreateInput = z.infer<typeof credentialCreateSchema>;
export type CredentialUpdateInput = z.infer<typeof credentialUpdateSchema>;
export type CredentialRevealInput = z.infer<typeof credentialRevealSchema>;
