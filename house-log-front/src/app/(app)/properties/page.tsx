'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BarChart3,
  Building2,
  ChevronRight,
  CalendarDays,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { type Property } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PROPERTY_TYPE_LABELS, cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { PageContainer } from '@/components/layout/page-container';
import {
  buildPropertyPortfolioSummary,
  filterProperties,
  getPropertyHealthLabel,
  getPropertyHealthVariant,
  PROPERTY_HEALTH_FILTERS,
  type PropertyHealthFilter,
} from '@/components/properties/property-list-model';
import { metricCardVariants, metricIconVariants } from '@/components/ui/visual-system';

type PropertyMetric = {
  label: string;
  value: string | number;
  helper: string;
  tone: 'accent' | 'success' | 'warning' | 'danger';
  icon: LucideIcon;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function MetricCard({ label, value, helper, tone, icon: Icon }: PropertyMetric) {
  return (
    <div className={cn(metricCardVariants({ tone, density: 'comfortable' }))}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">{label}</p>
          <p className="mt-2 text-3xl font-medium leading-none text-hl-text sm:text-[2rem]">{value}</p>
          <p className="mt-1.5 text-sm leading-6 text-hl-text-muted">{helper}</p>
        </div>
        <div className={metricIconVariants({ tone })}>
          <Icon className="h-4 w-4" strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function PropertyVisual({ property }: { property: Property }) {
  if (property.cover_url) {
    return (
      <div
        className="relative min-h-32 overflow-hidden rounded-[var(--hl-radius-card)] bg-cover bg-center shadow-hl-subtle sm:min-h-36 xl:min-h-44"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(247,245,240,0.08), rgba(31,41,51,0.42)), url(${property.cover_url})`,
        }}
        aria-label={property.name}
      >
        <div className="absolute bottom-3 left-3 rounded-full bg-hl-surface px-3 py-1 text-xs font-medium text-hl-text shadow-hl-subtle">
          {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-32 items-center justify-center overflow-hidden rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface-muted shadow-hl-subtle sm:min-h-36 xl:min-h-44">
      <span className="relative text-4xl font-medium text-hl-primary">{getInitials(property.name)}</span>
      <div className="absolute bottom-3 left-3 rounded-full bg-hl-surface px-3 py-1 text-xs font-medium text-hl-text shadow-hl-subtle">
        {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
      </div>
    </div>
  );
}

function PropertyFact({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface-muted p-3">
      <dt className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-hl-text-muted">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        {label}
      </dt>
      <dd className="mt-2 min-w-0 text-sm font-medium leading-6 text-hl-text">{value}</dd>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const createdAtLabel = formatDate(property.created_at);
  const areaValue = property.area_m2 ? `${property.area_m2} m²` : 'Não informada';
  const yearValue = property.year_built ?? 'Não informado';
  const structureValue = property.structure ?? 'Não informada';

  return (
    <Card variant="section" density="compact" className="property-card overflow-hidden border border-hl-border bg-hl-surface shadow-hl-subtle">
      <CardContent className="grid gap-3.5 p-3.5 sm:gap-4 sm:p-4 xl:grid-cols-[168px_minmax(0,1fr)]">
        <PropertyVisual property={property} />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{PROPERTY_TYPE_LABELS[property.type] ?? property.type}</Badge>
              <Badge variant={getPropertyHealthVariant(property.health_score)}>
                {getPropertyHealthLabel(property.health_score)}
              </Badge>
            </div>

            <div className="space-y-2">
              <CardTitle className="text-xl leading-tight text-hl-text sm:text-[22px]">{property.name}</CardTitle>
              <p className="flex items-start gap-2 text-sm leading-6 text-hl-text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-hl-text-muted" strokeWidth={1.8} />
                <span className="min-w-0 break-words">
                  {property.address}, {property.city}
                </span>
              </p>
            </div>

            <dl className="grid gap-2 sm:grid-cols-2">
              <PropertyFact label="Cliente / responsável" value={property.owner_name ?? 'Não informado'} icon={Building2} />
              <PropertyFact label="Área técnica" value={areaValue} icon={BarChart3} />
              <PropertyFact label="Ano base" value={yearValue} icon={CalendarDays} />
              <PropertyFact label="Estrutura" value={structureValue} icon={ShieldCheck} />
            </dl>
          </div>

          <div className="flex flex-col gap-3 rounded-[var(--hl-radius-control)] bg-hl-surface-muted p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-hl-text-muted">
              <span className="block uppercase tracking-[0.08em]">Registro HouseLog</span>
              <span className="mt-0.5 block text-sm font-medium text-hl-text">{createdAtLabel}</span>
            </p>

            <Button asChild variant="tonal" size="sm" className="w-full sm:w-auto">
              <Link href={`/properties/${property.id}`}>
                Abrir imóvel
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={cn(metricCardVariants({ tone: 'strong', density: 'comfortable' }))}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-3">
                <div className="hl-skeleton h-3 w-24 rounded-full" />
                <div className="hl-skeleton h-10 w-16 rounded" />
                <div className="hl-skeleton h-4 w-32 rounded-full" />
              </div>
              <div className={metricIconVariants({ tone: 'strong' })}>
                <Building2 className="h-4 w-4" strokeWidth={1.8} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="section" density="compact" className="border border-hl-border bg-hl-surface shadow-hl-subtle">
            <CardContent className="grid gap-3.5 p-3.5 sm:gap-4 sm:p-4 xl:grid-cols-[168px_minmax(0,1fr)]">
              <div className="hl-skeleton min-h-32 rounded-[var(--hl-radius-card)] sm:min-h-36 xl:min-h-44" />
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="hl-skeleton h-3 w-28 rounded-full" />
                  <div className="hl-skeleton h-7 w-3/4 rounded" />
                  <div className="hl-skeleton h-4 w-full rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="hl-skeleton h-14 rounded-[var(--hl-radius-control)]" />
                  ))}
                </div>
                <div className="hl-skeleton h-12 rounded-[var(--hl-radius-control)]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card variant="section" density="comfortable" className="border border-hl-border bg-hl-surface shadow-hl-subtle">
      <CardContent className="flex items-start gap-3 p-5 sm:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-[color-mix(in_srgb,var(--hl-danger)_12%,var(--hl-surface))] text-hl-danger">
          <AlertCircle className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium text-hl-text">Não foi possível carregar os imóveis</h2>
          <p className="mt-1 text-sm leading-6 text-hl-text-muted">
            Verifique sua conexão ou tente novamente em instantes.
          </p>
          <Button className="mt-4" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PropertiesPage() {
  const {
    data: properties,
    isLoading,
    hasMore,
    isLoadingMore,
    loadMore,
    error,
    mutate,
  } = usePagination<Property>('/properties');

  const [query, setQuery] = useState('');
  const [healthFilter, setHealthFilter] = useState<PropertyHealthFilter>('all');

  const portfolioSummary = useMemo(() => buildPropertyPortfolioSummary(properties), [properties]);
  const filteredProperties = useMemo(
    () => filterProperties(properties, query, healthFilter),
    [properties, query, healthFilter]
  );
  const hasActiveFilters = query.trim().length > 0 || healthFilter !== 'all';
  const visibleSummary = useMemo(() => buildPropertyPortfolioSummary(filteredProperties), [filteredProperties]);

  const metrics: PropertyMetric[] = [
    {
      label: 'imóveis carregados',
      value: portfolioSummary.total,
      helper: `${portfolioSummary.cities} cidades · saúde média ${portfolioSummary.averageHealth ?? '—'}`,
      tone: 'accent',
      icon: Building2,
    },
    {
      label: 'saudáveis',
      value: portfolioSummary.healthy,
      helper: 'saúde técnica acima de 80',
      tone: 'success',
      icon: ShieldCheck,
    },
    {
      label: 'em atenção',
      value: portfolioSummary.attention,
      helper: 'saúde técnica entre 55 e 79',
      tone: 'warning',
      icon: TriangleAlert,
    },
    {
      label: 'críticos',
      value: portfolioSummary.critical,
      helper: 'saúde técnica abaixo de 55',
      tone: 'danger',
      icon: XCircle,
    },
  ];

  function clearFilters() {
    setQuery('');
    setHealthFilter('all');
  }

  const total = properties.length;

  return (
    <PageContainer className="space-y-5">
      <Card variant="section" density="compact" className="overflow-hidden border border-hl-border bg-hl-surface shadow-hl-subtle">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(17rem,auto)] sm:items-center sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-primary">Carteira técnica</p>
            <h1 className="mt-1.5 text-xl font-medium leading-tight text-hl-text sm:text-2xl">
              Imóveis do cliente em visão operacional
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-snug text-hl-text-muted">
              Organização estilo CRM técnico para acompanhar saúde, contexto e acesso rápido ao prontuário de cada ativo.
            </p>
            <Button asChild className="mt-3 w-full sm:w-auto">
              <Link href="/properties/new">
                <Plus className="h-4 w-4" />
                Novo imóvel
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[var(--hl-radius-card)] bg-hl-surface-muted p-2 shadow-hl-subtle">
            {[
              { label: 'carregados', value: total },
              { label: 'cidades', value: portfolioSummary.cities },
              { label: 'saúde média', value: portfolioSummary.averageHealth ?? '—' },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-[var(--hl-radius-control)] bg-hl-surface px-3 py-3">
                <p className="truncate text-xl font-medium leading-none text-hl-text sm:text-2xl">{metric.value}</p>
                <p className="mt-1.5 truncate text-xs text-hl-text-muted">{metric.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={mutate} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} {...metric} />
              ))}
            </div>

            <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle sm:p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="space-y-2">
                  <span className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">
                    Buscar imóveis
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hl-text-muted" strokeWidth={1.8} />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Nome, endereço ou cliente"
                      className="pl-9"
                      autoComplete="off"
                    />
                  </div>
                </label>

                <div className="flex flex-wrap gap-2">
                  {PROPERTY_HEALTH_FILTERS.map((filter) => {
                    const active = healthFilter === filter.value;
                    return (
                      <Button
                        key={filter.value}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={active}
                        onClick={() => setHealthFilter(filter.value)}
                      >
                        {filter.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-hl-text-muted">
                <p>
                  Mostrando{' '}
                  <span className="font-medium text-hl-text">
                    {filteredProperties.length}
                  </span>{' '}
                  de <span className="font-medium text-hl-text">{properties.length}</span> imóveis carregados
                </p>
                <p>
                  Saúde média da visão atual{' '}
                  <span className="font-medium text-hl-text">
                    {visibleSummary.averageHealth ?? '—'}
                  </span>
                </p>
              </div>
            </div>

            {filteredProperties.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title={hasActiveFilters ? 'Nenhum imóvel corresponde aos filtros' : 'Nenhum imóvel cadastrado'}
                description={
                  hasActiveFilters
                    ? 'Ajuste a busca ou limpe os filtros para voltar à carteira completa.'
                    : 'Crie o primeiro ativo para organizar inventário, serviços, documentos e financeiro em um fluxo operacional.'
                }
                actions={
                  hasActiveFilters ? (
                    <>
                      <Button variant="outline" onClick={clearFilters}>
                        Limpar filtros
                      </Button>
                      <Button asChild>
                        <Link href="/properties/new">
                          <Plus className="h-4 w-4" />
                          Novo imóvel
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button asChild>
                      <Link href="/properties/new">
                        <Plus className="h-4 w-4" />
                        Cadastrar imóvel
                      </Link>
                    </Button>
                  )
                }
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredProperties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} loading={isLoadingMore}>
                  Carregar mais imóveis
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </PageContainer>
  );
}
