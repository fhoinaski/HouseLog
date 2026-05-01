import { z } from 'zod';

export const expenseCreateSchema = z.object({
  category: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(['expense', 'revenue']).default('expense'),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/),
  is_recurring: z.boolean().optional(),
  receipt_url: z.string().url().optional(),
  notes: z.string().optional(),
});

export const expenseUpdateSchema = expenseCreateSchema.partial();

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
