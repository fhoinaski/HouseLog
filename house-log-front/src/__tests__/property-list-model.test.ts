import { describe, expect, it } from 'vitest';
import {
  buildPropertyPortfolioSummary,
  filterProperties,
  getPropertyHealthLabel,
  PROPERTY_HEALTH_FILTERS,
} from '@/components/properties/property-list-model';
import type { Property } from '@/lib/api';

function buildProperty(overrides: Partial<Property>): Property {
  return {
    id: 'property-1',
    tenant_id: 'tenant-1',
    owner_id: 'owner-1',
    manager_id: null,
    name: 'Casa Jardim',
    type: 'house',
    address: 'Rua das Flores, 123',
    city: 'Curitiba',
    area_m2: 120,
    year_built: 2001,
    structure: 'Alvenaria',
    floors: 2,
    cover_url: null,
    health_score: 92,
    created_at: '2026-05-01T10:00:00.000Z',
    owner_name: 'Marina Lopes',
    ...overrides,
  };
}

describe('property-list-model', () => {
  it('resume a carteira usando apenas os dados carregados', () => {
    const summary = buildPropertyPortfolioSummary([
      buildProperty({ id: 'property-1', health_score: 92, city: 'Curitiba' }),
      buildProperty({
        id: 'property-2',
        name: 'Apartamento Lago',
        address: 'Alameda Central, 88',
        city: 'Sao Paulo',
        health_score: 68,
        owner_name: 'Grupo Atlas',
      }),
      buildProperty({
        id: 'property-3',
        name: 'Galpao Norte',
        address: 'Avenida Industrial, 450',
        city: 'Belo Horizonte',
        health_score: 34,
        owner_name: undefined,
      }),
    ]);

    expect(summary).toEqual({
      total: 3,
      healthy: 1,
      attention: 1,
      critical: 1,
      cities: 3,
      averageHealth: 65,
    });
  });

  it('filtra por nome, endereco, cidade, cliente e saude sem inventar campos', () => {
    const properties = [
      buildProperty({ id: 'property-1', health_score: 92, owner_name: 'Marina Lopes' }),
      buildProperty({
        id: 'property-2',
        name: 'Apartamento Lago',
        address: 'Alameda Central, 88',
        city: 'Sao Paulo',
        health_score: 68,
        owner_name: 'Grupo Atlas',
      }),
      buildProperty({
        id: 'property-3',
        name: 'Galpao Norte',
        address: 'Avenida Industrial, 450',
        city: 'Belo Horizonte',
        health_score: 34,
        owner_name: undefined,
      }),
    ];

    expect(filterProperties(properties, 'marina', 'all').map((property) => property.id)).toEqual(['property-1']);
    expect(filterProperties(properties, 'rua das flores', 'all').map((property) => property.id)).toEqual(['property-1']);
    expect(filterProperties(properties, 'sao paulo', 'all').map((property) => property.id)).toEqual(['property-2']);
    expect(filterProperties(properties, 'atlas', 'all').map((property) => property.id)).toEqual(['property-2']);
    expect(filterProperties(properties, 'galpao', 'critical').map((property) => property.id)).toEqual(['property-3']);
  });

  it('expoe a legenda de saude operacional esperada pela listagem', () => {
    expect(getPropertyHealthLabel(92)).toBe('Saudavel');
    expect(getPropertyHealthLabel(68)).toBe('Atencao');
    expect(getPropertyHealthLabel(34)).toBe('Critico');
    expect(PROPERTY_HEALTH_FILTERS.map((filter) => filter.value)).toEqual(['all', 'healthy', 'attention', 'critical']);
  });
});
