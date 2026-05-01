import { z } from 'zod';

export const serviceMessageCreateSchema = z.object({
  body: z.string().min(1).max(4000),
  internal: z.boolean().default(false),
  attachments: z.array(z.string().url()).max(8).default([]),
});

export type ServiceMessageCreateInput = z.infer<typeof serviceMessageCreateSchema>;
