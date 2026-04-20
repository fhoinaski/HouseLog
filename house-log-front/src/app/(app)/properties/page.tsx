'use client';

import type { ComponentProps } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  ChevronRight,
  FileText,
  Hammer,
  MapPin,
  Package,
  Plus,
  Search,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { usePagination } from '@/hooks/usePagination';
import { type Property } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PROPERTY_TYPE_LABELS, cn } from '@/lib/utils';

type PropertyAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  className: string;
};

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function getHealthLabel(score: number | null | undefined) {
  if (typeof score !== 'number') return 'Sem leitura';
  if (score >= 80) return 'Saudável';
  if (score >= 55) return 'Atenção';
  return 'Crítico';
}

function getHealthVariant(score: number | null | undefined): ComponentProps<typeof Badge>['variant'] {
  if (typeof score !== 'number') return 'normal';
  if (score >= 80) return 'success';
  if (score >= 55) return 'warning';
  return 'urgent';
}

function PropertyVisual({ property }: { property: Property }) {
  if (property.cover_url) {
    return (
      <div
        className="relative min-h-40 overflow-hidden rounded-[var(--radius-xl)] bg-cover bg-center shadow-[var(--shadow-sm)]"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(6,14,32,0.02), rgba(6,14,32,0.58)), url(${property.cover_url})`,
        }}
        aria-label={property.name}
      >
        <div className="absolute bottom-3 left-3 rounded-full bg-[rgba(6,14,32,0.72)] px-3 py-1 text-xs font-medium text-text-primary backdrop-blur-[var(--surface-blur)]">
          {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-40 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] bg-[linear-gradient(135deg,rgba(184,195,255,0.18),rgba(78,222,163,0.08))] shadow-[var(--shadow-sm)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(255,255,255,0.14),transparent_13rem)]" />
      <span className="relative text-4xl font-medium text-text-accent">{getInitials(property.name)}</span>
      <div className="absolute bottom-3 left-3 rounded-full bg-[rgba(6,14,32,0.60)] px-3 py-1 text-xs font-medium text-text-primary backdrop-blur-[var(--surface-blur)]">
        {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
      </div>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const actions: PropertyAction[] = [
    {
      label: 'Inventário',
      href: `/properties/${property.id}/inventory`,
      icon: Package,
      className: 'text-text-warning bg-bg-warning hover:bg-bg-warning-emphasis',
    },
    {
      label: 'Serviços',
      href: `/properties/${property.id}/services`,
      icon: Hammer,
      className: 'text-text-accent bg-bg-info hover:bg-bg-info-emphasis',
    },
    {
      label: 'Financeiro',
      href: `/properties/${property.id}/financial`,
      icon: Wallet,
      className: 'text-text-success bg-bg-success hover:bg-bg-success-emphasis',
    },
    {
      label: 'Documentos',
      href: `/properties/${property.id}/documents`,
      icon: FileText,
      className: 'text-text-info bg-[var(--button-tonal-bg)] hover:bg-[var(--button-tonal-hover)]',
    },
  ];

  return (
    <Card variant="glass" density="comfortable" className="overflow-hidden shadow-[var(--shadow-md)]">
      <CardContent className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[190px_1fr]">
        <PropertyVisual property={property} />

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-1">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Imóvel gerenciado</p>
              <CardTitle className="mt-2 text-[22px] leading-tight text-text-primary">{property.name}</CardTitle>
              <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-text-secondary">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" strokeWidth={1.8} />
                <span>{property.address}, {property.city}</span>
              </p>
            </div>
            <Badge variant={getHealthVariant(property.health_score)}>{getHealthLabel(property.health_score)}</Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {actions.map(({ label, href, icon: Icon, className }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group min-h-12 rounded-[var(--radius-md)] px-3 py-3 text-sm font-medium transition-all focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] active:scale-[0.98]',
                  className
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{label}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-5 rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 gap-3 text-xs text-text-tertiary sm:flex sm:items-center">
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.08em]">Área</span>
                  <span className="mt-0.5 block text-sm text-text-secondary">
                    {property.area_m2 ? `${property.area_m2} m²` : 'Não informada'}
                  </span>
                </span>
                <span>
                  <span className="block text-[10px] uppercase tracking-[0.08em]">Ano</span>
                  <span className="mt-0.5 block text-sm text-text-secondary">
                    {property.year_built ?? 'Não informado'}
                  </span>
                </span>
              </div>

              <Button asChild variant="tonal" size="sm" className="w-full sm:w-auto">
                <Link href={`/properties/${property.id}`}>
                  Abrir imóvel
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} variant="glass" density="comfortable" className="shadow-[var(--shadow-md)]">
          <CardContent className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[190px_1fr]">
            <div className="hl-skeleton min-h-40 rounded-[var(--radius-xl)]" />
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="hl-skeleton h-3 w-28 rounded-full" />
                <div className="hl-skeleton h-7 w-3/4 rounded" />
                <div className="hl-skeleton h-4 w-full rounded" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="hl-skeleton h-12 rounded-[var(--radius-md)]" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card variant="glass" density="comfortable" className="shadow-[var(--shadow-md)]">
      <CardContent className="px-6 py-12 text-center sm:px-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--button-tonal-bg)] text-text-accent">
          <Building2 className="h-8 w-8" strokeWidth={1.8} />
        </div>
        <h2 className="mt-6 text-2xl font-medium text-text-primary">Nenhum imóvel cadastrado</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-text-secondary">
          Crie o primeiro ativo para organizar inventário, serviços, documentos e financeiro em um fluxo operacional.
        </p>
        <Button className="mt-7" asChild>
          <Link href="/properties/new">
            <Plus className="h-4 w-4" />
            Cadastrar imóvel
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorState() {
  return (
    <Card variant="glass" density="comfortable" className="shadow-[var(--shadow-md)]">
      <CardContent className="flex items-start gap-3 p-5 sm:p-6">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-danger text-text-danger">
          <AlertCircle className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base font-medium text-text-primary">Não foi possível carregar os imóveis</h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Verifique sua conexão ou tente novamente em instantes.
          </p>
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
  } = usePagination<Property>('/properties');

  const total = properties.length;
  const averageHealth =
    total > 0
      ? Math.round(properties.reduce((sum, property) => sum + (property.health_score ?? 0), 0) / total)
      : null;
  const cities = new Set(properties.map((property) => property.city).filter(Boolean)).size;

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-6 px-5 py-5 safe-bottom sm:px-6 md:px-8 md:py-7 lg:px-10">
      <Card variant="raised" density="comfortable" className="overflow-hidden shadow-[var(--shadow-lg)]">
        <CardContent className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.35fr_0.85fr] lg:p-7">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-accent">Portfólio operacional</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-medium leading-tight text-text-primary md:text-4xl">
              Seus imóveis
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-secondary md:text-base md:leading-7">
              Acesse os ativos cadastrados e navegue rapidamente por inventário, serviços, documentos e financeiro.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/properties/new">
                  <Plus className="h-4 w-4" />
                  Novo imóvel
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/dashboard">
                  Voltar ao dashboard
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-1 lg:content-center">
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3.5 shadow-[var(--shadow-xs)]">
              <p className="text-2xl font-medium text-text-primary">{total}</p>
              <p className="mt-1 text-xs text-text-tertiary">imóveis</p>
            </div>
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3.5 shadow-[var(--shadow-xs)]">
              <p className="text-2xl font-medium text-text-primary">{cities}</p>
              <p className="mt-1 text-xs text-text-tertiary">cidades</p>
            </div>
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3.5 shadow-[var(--shadow-xs)]">
              <p className="text-2xl font-medium text-text-primary">{averageHealth ?? '-'}</p>
              <p className="mt-1 text-xs text-text-tertiary">saúde média</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="tonal" density="comfortable" className="shadow-[var(--shadow-md)]">
        <CardHeader className="p-5 pb-3 sm:p-6 sm:pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Ativos cadastrados</p>
              <CardTitle className="mt-2 text-xl leading-tight">Mapa de gestão</CardTitle>
            </div>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-base)] px-3 text-sm text-text-secondary shadow-[var(--shadow-xs)]">
              <Search className="h-4 w-4 text-text-tertiary" strokeWidth={1.8} />
              Busca global em breve
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 pt-2 sm:p-6 sm:pt-2">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState />
          ) : properties.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid gap-5 xl:grid-cols-2">
                {properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-6">
                  <Button variant="outline" onClick={loadMore} loading={isLoadingMore}>
                    Carregar mais imóveis
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
