import type { Property } from '@/lib/api';

export type PropertyHealthFilter = 'all' | 'healthy' | 'attention' | 'critical';

export const PROPERTY_HEALTH_FILTERS: Array<{ value: PropertyHealthFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'healthy', label: 'Saudáveis' },
  { value: 'attention', label: 'Em atenção' },
  { value: 'critical', label: 'Críticos' },
];

export type PropertyPortfolioSummary = {
  total: number;
  healthy: number;
  attention: number;
  critical: number;
  cities: number;
  averageHealth: number | null;
};

type NormalizedProperty = {
  name: string;
  address: string;
  city: string;
  ownerName: string;
  typeLabel: string;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toText(value: string | null | undefined): string {
  return normalizeText(value ?? '');
}

function getHealthBand(score: number | null | undefined): Exclude<PropertyHealthFilter, 'all'> {
  if (typeof score !== 'number') return 'critical';
  if (score >= 80) return 'healthy';
  if (score >= 55) return 'attention';
  return 'critical';
}

function getPropertyTypeLabel(property: Property): string {
  return property.type.replaceAll('_', ' ');
}

function buildSearchableProperty(property: Property): NormalizedProperty {
  return {
    name: toText(property.name),
    address: toText(property.address),
    city: toText(property.city),
    ownerName: toText(property.owner_name),
    typeLabel: toText(getPropertyTypeLabel(property)),
  };
}

export function getPropertyHealthLabel(score: number | null | undefined): string {
  if (typeof score !== 'number') return 'Sem leitura';
  if (score >= 80) return 'Saudável';
  if (score >= 55) return 'Atenção';
  return 'Crítico';
}

export function getPropertyHealthVariant(score: number | null | undefined): 'normal' | 'success' | 'warning' | 'urgent' {
  if (typeof score !== 'number') return 'normal';
  if (score >= 80) return 'success';
  if (score >= 55) return 'warning';
  return 'urgent';
}

export function buildPropertyPortfolioSummary(properties: Property[]): PropertyPortfolioSummary {
  const scores = properties.filter((property) => typeof property.health_score === 'number');
  const totalScore = scores.reduce((sum, property) => sum + (property.health_score ?? 0), 0);
  const averageHealth = scores.length > 0 ? Math.round(totalScore / scores.length) : null;
  const cities = new Set(properties.map((property) => property.city).filter(Boolean)).size;

  return {
    total: properties.length,
    healthy: properties.filter((property) => getHealthBand(property.health_score) === 'healthy').length,
    attention: properties.filter((property) => getHealthBand(property.health_score) === 'attention').length,
    critical: properties.filter((property) => getHealthBand(property.health_score) === 'critical').length,
    cities,
    averageHealth,
  };
}

export function filterProperties(
  properties: Property[],
  query: string,
  healthFilter: PropertyHealthFilter
): Property[] {
  const normalizedQuery = normalizeText(query);

  return properties.filter((property) => {
    const searchable = buildSearchableProperty(property);
    const matchesQuery =
      normalizedQuery.length === 0 ||
      searchable.name.includes(normalizedQuery) ||
      searchable.address.includes(normalizedQuery) ||
      searchable.city.includes(normalizedQuery) ||
      searchable.ownerName.includes(normalizedQuery) ||
      searchable.typeLabel.includes(normalizedQuery);

    const matchesHealth =
      healthFilter === 'all' || getHealthBand(property.health_score) === healthFilter;

    return matchesQuery && matchesHealth;
  });
}