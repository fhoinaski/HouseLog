import { z } from 'zod';

export const tenantRoleSchema = z.enum(['owner', 'manager', 'provider', 'temp_provider']);

export const tenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  owner_id: z.string(),
  status: z.enum(['active', 'suspended']),
});

export const tenantMemberSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  user_id: z.string(),
  role: tenantRoleSchema,
  status: z.enum(['active', 'invited', 'suspended']),
});

export type TenantRole = z.infer<typeof tenantRoleSchema>;
export type Tenant = z.infer<typeof tenantSchema>;
export type TenantMember = z.infer<typeof tenantMemberSchema>;
