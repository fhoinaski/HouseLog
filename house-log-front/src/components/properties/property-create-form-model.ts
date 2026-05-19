import { z } from 'zod';
import type { PropertyCreateInput } from '@houselog/contracts';

const emptyToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);

const optionalPositiveNumber = (message: string) =>
  z.preprocess(emptyToUndefined, z.coerce.number().positive(message).optional());

const optionalPositiveInteger = (message: string) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int(message).positive(message).optional());

const optionalYearBuilt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int('Informe um ano valido').min(1800, 'Informe um ano valido').max(2100, 'Informe um ano valido').optional(),
);

export const propertyCreateFormSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatorio'),
  type: z.enum(['house', 'apt', 'commercial', 'warehouse']),
  address: z.string().trim().min(1, 'Endereco obrigatorio'),
  city: z.string().trim().min(1, 'Cidade obrigatoria'),
  area_m2: optionalPositiveNumber('Informe uma area maior que zero'),
  year_built: optionalYearBuilt,
  structure: z.string().trim().optional().transform((value) => value || undefined),
  floors: optionalPositiveInteger('Informe um numero inteiro maior que zero'),
});

export type PropertyCreateFormData = z.infer<typeof propertyCreateFormSchema>;

export function buildPropertyCreatePayload(data: PropertyCreateFormData): PropertyCreateInput {
  return {
    name: data.name,
    type: data.type,
    address: data.address,
    city: data.city,
    floors: data.floors ?? 1,
    ...(data.area_m2 !== undefined ? { area_m2: data.area_m2 } : {}),
    ...(data.year_built !== undefined ? { year_built: data.year_built } : {}),
    ...(data.structure !== undefined ? { structure: data.structure } : {}),
  };
}
