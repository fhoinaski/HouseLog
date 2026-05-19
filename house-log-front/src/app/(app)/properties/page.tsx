'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
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
import { PROPERTY_TYPE_LABELS, cn, formatDate } from '@/lib/utils';
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
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || 'HL';
}

function formatOptionalNumber(value: number | null | undefined, suffix: string) {
  return typeof value === 'number' ? `${value} ${suffix}` : 'Nao informado';
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
  const typeLabel = PROPERTY_TYPE_LABELS[property.type] ?? property.type;

  if (property.cover_url) {
    return (
      <div
        className="relative min-h-28 overflow-hidden rounded-[var(--hl-radius-card)] bg-cover bg-center shadow-hl-subtle sm:min-h-32 lg:min-h-full"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(247,245,240,0.08), rgba(31,41,51,0.42)), url(${property.cover_url})`,
        }}
        aria-label={property.name}
      >
        <div className="absolute bottom-3 left-3 rounded-full bg-hl-surface px-3 py-1 text-xs font-medium text-hl-text shadow-hl-subtle">
          {typeLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-28 items-center justify-center overflow-hidden rounded-[var(--hl-radius-card)] border border-hl-border bg-[linear-gradient(135deg,var(--hl-surface),var(--hl-surface-muted))] shadow-hl-subtle sm:min-h-32 lg:min-h-full">
      <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_18%,color-mix(in_srgb,var(--hl-primary)_10%,transparent),transparent_34%),linear-gradient(135deg,transparent_0%,color-mix(in_srgb,var(--hl-border)_55%,transparent)_100%)]" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-[var(--hl-radius-card)] bg-hl-surface text-xl font-semibold tracking-tight text-hl-primary shadow-hl-subtle">
        {getInitials(property.name)}
      </span>
      <div className="absolute bottom-3 left-3 rounded-full bg-hl-surface px-3 py-1 text-xs font-medium text-hl-text shadow-hl-subtle">
        {typeLabel}
      </div>
    </div>
  );
}

function PropertyFact({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="min-w-0 rounded-[var(--hl-radius-control)] bg-hl-surface-muted px-3 py-2.5">
      <dt className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-hl-text-muted">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium leading-5 text-hl-text">{value}</dd>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const typeLabel = PROPERTY_TYPE_LABELS[property.type] ?? property.type;
  const healthLabel = getPropertyHealthLabel(property.health_score);
  const createdAtLabel = formatDate(property.created_at);
  const areaValue = formatOptionalNumber(property.area_m2, 'm2');
  const yearValue = property.year_built ?? 'Nao informado';
  const structureValue = property.structure ?? 'Nao informada';
  const ownerValue = property.owner_name ?? 'Nao informado';

  return (
    <Card
      variant="section"
      density="compact"
      className="property-card overflow-hidden border border-hl-border bg-hl-surface shadow-hl-subtle transition-colors hover:border-[color-mix(in_srgb,var(--hl-primary)_24%,var(--hl-border))] hover:shadow-hl-soft"
    >
      <CardContent className="grid gap-4 p-3.5 sm:p-4 lg:grid-cols-[136px_minmax(0,1fr)] xl:grid-cols-[148px_minmax(0,1fr)]">
        <PropertyVisual property={property} />

        <div className="flex min-w-0 flex-col gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="truncate text-lg leading-tight text-hl-text sm:text-xl">{property.name}</CardTitle>
                <p className="flex items-start gap-2 text-sm leading-5 text-hl-text-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-hl-text-muted" strokeWidth={1.8} />
                  <span className="min-w-0 break-words">
                    {property.address}, {property.city}
                  </span>
                </p>
              </div>

              <Badge variant={getPropertyHealthVariant(property.health_score)} className="shrink-0">
                {healthLabel}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{typeLabel}</Badge>
              <span className="rounded-full bg-hl-surface-muted px-2.5 py-1 text-xs font-medium text-hl-text-muted">
                Perfil tecnico
              </span>
            </div>
          </div>

          <dl className="grid gap-2 sm:grid-cols-2">
            <PropertyFact label="Responsavel" value={ownerValue} icon={Building2} />
            <PropertyFact label="Area tecnica" value={areaValue} icon={BarChart3} />
            <PropertyFact label="Ano base" value={yearValue} icon={CalendarDays} />
            <PropertyFact label="Estrutura" value={structureValue} icon={ShieldCheck} />
          </dl>

          <div className="flex flex-col gap-3 border-t border-hl-border pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-hl-text-muted">
              Registrado em <span className="font-medium text-hl-text">{createdAtLabel}</span>
            </p>

            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full border-[color-mix(in_srgb,var(--hl-primary)_22%,var(--hl-border))] text-hl-primary hover:bg-[color-mix(in_srgb,var(--hl-primary)_8%,var(--hl-surface))] sm:w-auto"
            >
              <Link href={`/properties/${property.id}`} aria-label={`Abrir imovel ${property.name}`}>
                Abrir prontuario
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

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} variant="section" density="compact" className="border border-hl-border bg-hl-surface shadow-hl-subtle">
            <CardContent className="grid gap-4 p-3.5 sm:p-4 lg:grid-cols-[136px_minmax(0,1fr)] xl:grid-cols-[148px_minmax(0,1fr)]">
              <div className="hl-skeleton min-h-28 rounded-[var(--hl-radius-card)] sm:min-h-32 lg:min-h-full" />
              <div className="space-y-3">
                <div className="space-y-3">
                  <div className="hl-skeleton h-3 w-28 rounded-full" />
                  <div className="hl-skeleton h-7 w-3/4 rounded" />
                  <div className="hl-skeleton h-4 w-full rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="hl-skeleton h-12 rounded-[var(--hl-radius-control)]" />
                  ))}
                </div>
                <div className="hl-skeleton h-10 rounded-[var(--hl-radius-control)]" />
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
          <h2 className="text-base font-medium text-hl-text">Nao foi possivel carregar os imoveis</h2>
          <p className="mt-1 text-sm leading-6 text-hl-text-muted">
            Verifique sua conexao ou tente novamente em instantes.
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
      label: 'imoveis carregados',
      value: portfolioSummary.total,
      helper: `${portfolioSummary.cities} cidades · saude media ${portfolioSummary.averageHealth ?? '--'}`,
      tone: 'accent',
      icon: Building2,
    },
    {
      label: 'saudaveis',
      value: portfolioSummary.healthy,
      helper: 'saude tecnica acima de 80',
      tone: 'success',
      icon: ShieldCheck,
    },
    {
      label: 'em atencao',
      value: portfolioSummary.attention,
      helper: 'saude tecnica entre 55 e 79',
      tone: 'warning',
      icon: TriangleAlert,
    },
    {
      label: 'criticos',
      value: portfolioSummary.critical,
      helper: 'saude tecnica abaixo de 55',
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
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-hl-primary">Carteira tecnica</p>
            <h1 className="mt-1.5 text-2xl font-semibold leading-tight text-hl-text sm:text-3xl">
              Imoveis
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-hl-text-muted">
              Gerencie os prontuarios tecnicos, documentos, chamados e historico dos imoveis.
            </p>
            <Button asChild className="mt-3 w-full sm:w-auto">
              <Link href="/properties/new">
                <Plus className="h-4 w-4" />
                Novo imovel
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-[var(--hl-radius-card)] bg-hl-surface-muted p-2 shadow-hl-subtle">
            {[
              { label: 'carregados', value: total },
              { label: 'cidades', value: portfolioSummary.cities },
              { label: 'saude media', value: portfolioSummary.averageHealth ?? '--' },
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
                    Buscar imoveis
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hl-text-muted" strokeWidth={1.8} />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Nome, endereco ou cliente"
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
                  de <span className="font-medium text-hl-text">{properties.length}</span> imoveis carregados
                </p>
                <p>
                  Saude media da visao atual{' '}
                  <span className="font-medium text-hl-text">
                    {visibleSummary.averageHealth ?? '--'}
                  </span>
                </p>
              </div>
            </div>

            {filteredProperties.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-6 w-6" />}
                title={hasActiveFilters ? 'Nenhum imovel corresponde aos filtros' : 'Nenhum imovel cadastrado'}
                description={
                  hasActiveFilters
                    ? 'Ajuste a busca ou limpe os filtros para voltar a carteira completa.'
                    : 'Crie o primeiro ativo para organizar inventario, servicos, documentos e financeiro em um fluxo operacional.'
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
                          Novo imovel
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <Button asChild>
                      <Link href="/properties/new">
                        <Plus className="h-4 w-4" />
                        Cadastrar imovel
                      </Link>
                    </Button>
                  )
                }
              />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {filteredProperties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} loading={isLoadingMore}>
                  Carregar mais imoveis
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </PageContainer>
  );
}
