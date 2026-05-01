import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'owner', 'provider', 'temp_provider']);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = loginSchema.extend({
  name: z.string().min(1),
  role: userRoleSchema.default('owner'),
});

export type UserRole = z.infer<typeof userRoleSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
