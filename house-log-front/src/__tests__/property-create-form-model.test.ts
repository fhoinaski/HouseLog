import { describe, expect, it } from 'vitest';
import { buildPropertyCreatePayload, propertyCreateFormSchema } from '@/components/properties/property-create-form-model';

describe('propertyCreateFormSchema', () => {
  it('valida nome e endereco obrigatorios', () => {
    const result = propertyCreateFormSchema.safeParse({
      name: '',
      type: 'house',
      address: '',
      city: 'Sao Paulo',
      area_m2: '',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('name');
      expect(paths).toContain('address');
    }
  });

  it('normaliza campos opcionais vazios antes de montar o payload', () => {
    const parsed = propertyCreateFormSchema.parse({
      name: 'Casa Tecnica',
      type: 'house',
      address: 'Rua A, 100',
      city: 'Sao Paulo',
      area_m2: '',
      year_built: '',
      floors: '',
      structure: '',
    });

    expect(buildPropertyCreatePayload(parsed)).toEqual({
      name: 'Casa Tecnica',
      type: 'house',
      address: 'Rua A, 100',
      city: 'Sao Paulo',
      floors: 1,
    });
  });

  it('monta payload sem tenantId', () => {
    const parsed = propertyCreateFormSchema.parse({
      name: 'Apartamento Aurora',
      type: 'apt',
      address: 'Av. Paulista, 1000',
      city: 'Sao Paulo',
      area_m2: '120.5',
      year_built: '2019',
      floors: '1',
      structure: 'Concreto armado',
    });

    const payload = buildPropertyCreatePayload(parsed);

    expect(payload).toEqual({
      name: 'Apartamento Aurora',
      type: 'apt',
      address: 'Av. Paulista, 1000',
      city: 'Sao Paulo',
      area_m2: 120.5,
      year_built: 2019,
      floors: 1,
      structure: 'Concreto armado',
    });
    expect('tenantId' in payload).toBe(false);
    expect('tenant_id' in payload).toBe(false);
  });
});
