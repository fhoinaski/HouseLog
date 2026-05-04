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
  vendor_cnpj: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
});

export const documentUpdateSchema = documentCreateSchema.partial();

export type DocumentType = z.infer<typeof documentTypeSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;
