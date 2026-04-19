'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  ChevronRight,
  FileText,
  Hammer,
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
import { PROPERTY_TYPE_LABELS } from '@/lib/utils';
import { cn } from '@/lib/utils';

type PropertyAction = {
  label: string;
  href: string;
  icon: LucideIcon;
  tone: string;
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

function getHealthVariant(score: number | null | undefined): React.ComponentProps<typeof Badge>['variant'] {
  if (typeof score !== 'number') return 'normal';
  if (score >= 80) return 'success';
  if (score >= 55) return 'warning';
  return 'urgent';
}

function PropertyVisual({ property }: { property: Property }) {
  if (property.cover_url) {
    return (
      <div
        className="h-28 rounded-[var(--radius-xl)] bg-cover bg-center shadow-[var(--shadow-xs)] sm:h-full sm:min-h-40"
        style={{ backgroundImage: `linear-gradient(180deg, rgba(6,14,32,0.05), rgba(6,14,32,0.34)), url(${property.cover_url})` }}
        aria-label={property.name}
      />
    );
  }

  return (
    <div className="flex h-28 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--button-tonal-bg)] text-text-accent shadow-[var(--shadow-xs)] sm:h-full sm:min-h-40">
      <span className="text-3xl font-medium">{getInitials(property.name)}</span>
    </div>
  );
}

function PropertyCard({ property }: { property: Property }) {
  const actions: PropertyAction[] = [
    { label: 'Inventário', href: `/properties/${property.id}/inventory`, icon: Package, tone: 'text-text-warning' },
    { label: 'Serviços', href: `/properties/${property.id}/services`, icon: Hammer, tone: 'text-text-accent' },
    { label: 'Financeiro', href: `/properties/${property.id}/financial`, icon: Wallet, tone: 'text-text-success' },
    { label: 'Documentos', href: `/properties/${property.id}/documents`, icon: FileText, tone: 'text-text-info' },
  ];

  return (
    <Card variant="glass" density="comfortable" className="overflow-hidden">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-[150px_1fr]">
        <PropertyVisual property={property} />

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                {PROPERTY_TYPE_LABELS[property.type] ?? property.type}
              </p>
              <CardTitle className="mt-1 truncate text-xl leading-tight">{property.name}</CardTitle>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">
                {property.address}, {property.city}
              </p>
            </div>
            <Badge variant={getHealthVariant(property.health_score)}>{getHealthLabel(property.health_score)}</Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {actions.map(({ label, href, icon: Icon, tone }) => (
              <Link
                key={href}
                href={href}
                className="group min-h-11 rounded-[var(--radius-md)] bg-[var(--surface-strong)] px-3 py-2.5 text-sm font-medium text-text-primary transition-all hover:bg-[var(--surface-raised)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', tone)} strokeWidth={1.8} />
                  <span className="truncate">{label}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-xs leading-5 text-text-tertiary">
              {property.area_m2 ? `${property.area_m2} m²` : 'Área não informada'}
              {property.year_built ? ` · ${property.year_built}` : ''}
            </div>
            <Button asChild variant="ghost" size="sm">
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
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} variant="glass" density="comfortable">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-[150px_1fr]">
            <div className="hl-skeleton h-28 rounded-[var(--radius-xl)] sm:h-40" />
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="hl-skeleton h-3 w-28 rounded-full" />
                <div className="hl-skeleton h-6 w-3/4 rounded" />
                <div className="hl-skeleton h-4 w-full rounded" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="hl-skeleton h-11 rounded-[var(--radius-md)]" />
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
    <Card variant="glass" density="comfortable">
      <CardContent className="px-5 py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--button-tonal-bg)] text-text-accent">
          <Building2 className="h-7 w-7" strokeWidth={1.8} />
        </div>
        <h2 className="mt-5 text-xl font-medium text-text-primary">Nenhum imóvel cadastrado</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
          Crie o primeiro ativo para organizar inventário, serviços, documentos e financeiro em um fluxo operacional.
        </p>
        <Button className="mt-6" asChild>
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
    <Card variant="glass" density="comfortable">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-danger text-text-danger">
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
    <div className="mx-auto w-full max-w-[1180px] space-y-5 px-4 py-4 safe-bottom md:px-6 md:py-6 md:pb-8">
      <Card variant="raised" density="comfortable" className="overflow-hidden">
        <CardContent className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr] lg:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-accent">Portfólio operacional</p>
            <h1 className="mt-3 text-3xl font-medium leading-tight text-text-primary md:text-4xl">Seus imóveis</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
              Acesse os ativos cadastrados e navegue rapidamente por inventário, serviços, documentos e financeiro.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/properties/new">
                  <Plus className="h-4 w-4" />
                  Novo imóvel
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard">
                  Voltar ao dashboard
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3">
              <p className="text-2xl font-medium text-text-primary">{total}</p>
              <p className="mt-1 text-xs text-text-tertiary">imóveis</p>
            </div>
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3">
              <p className="text-2xl font-medium text-text-primary">{cities}</p>
              <p className="mt-1 text-xs text-text-tertiary">cidades</p>
            </div>
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-strong)] p-3">
              <p className="text-2xl font-medium text-text-primary">{averageHealth ?? '-'}</p>
              <p className="mt-1 text-xs text-text-tertiary">saúde média</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="tonal" density="comfortable">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Ativos cadastrados</p>
              <CardTitle className="mt-1 text-lg leading-tight">Mapa de gestão</CardTitle>
            </div>
            <div className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-base)] px-3 text-sm text-text-secondary">
              <Search className="h-4 w-4 text-text-tertiary" strokeWidth={1.8} />
              Busca global em breve
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState />
          ) : properties.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {properties.map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-5">
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
