import { z } from 'zod';

export const providerCategorySchema = z.enum([
  'electrical',
  'plumbing',
  'structural',
  'waterproofing',
  'painting',
  'flooring',
  'roofing',
  'hvac',
  'solar',
  'pool',
  'gardening',
  'cleaning',
  'locksmith',
  'carpentry',
  'masonry',
  'automation',
  'alarm_cctv',
  'internet_network',
  'appliances',
  'pest_control',
  'glazing',
  'welding',
  'drywall',
  'drainage',
  'gas',
  'elevator',
  'facade',
  'general',
]);

export const providerProfileUpdateSchema = z.object({
  provider_categories: z.array(providerCategorySchema).default([]),
  whatsapp: z.string().optional(),
  service_area: z.string().optional(),
  provider_bio: z.string().max(2000).optional(),
  provider_courses: z.array(z.string()).default([]),
  provider_specializations: z.array(z.string()).default([]),
  provider_portfolio: z.array(z.string().url()).default([]),
});

export type ProviderCategory = z.infer<typeof providerCategorySchema>;
export type ProviderProfileUpdateInput = z.infer<typeof providerProfileUpdateSchema>;
