import { z } from 'zod';

export const serviceBidCreateSchema = z.object({
  amount: z.number().positive(),
  notes: z.string().max(2000).optional(),
});

export const bidStatusUpdateSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});

export type ServiceBidCreateInput = z.infer<typeof serviceBidCreateSchema>;
export type BidStatusUpdateInput = z.infer<typeof bidStatusUpdateSchema>;
