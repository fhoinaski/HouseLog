import { z } from 'zod';

export const documentTypeSchema = z.enum([
  'invoice',
  'manual',
  'project',
  'contract',
  'deed',
  'permit',
  'insurance',
  'other',
]);

export const documentCreateSchema = z.object({
  type: documentTypeSchema,
  title: z.string().min(1),
  service_id: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
});

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
