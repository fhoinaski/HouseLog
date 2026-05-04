import { z } from 'zod';

export const expenseCategorySchema = z.enum([
  'water',
  'electricity',
  'gas',
  'condo',
  'iptu',
  'insurance',
  'cleaning',
  'garden',
  'security',
  'other',
]);

export const expenseCreateSchema = z.object({
  type: z.enum(['expense', 'revenue']).default('expense'),
  category: expenseCategorySchema,
  amount: z.number().positive(),
  reference_month: z.string().regex(/^\d{4}-\d{2}$/),
  notes: z.string().optional(),
  is_recurring: z.boolean().default(false),
});

export const expenseUpdateSchema = expenseCreateSchema.partial();

export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
