'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, Activity, MapPin, Wrench } from 'lucide-react';
import { propertiesApi } from '@/lib/api';
import { cn, scoreColor } from '@/lib/utils';
import { PropertyContextSearch } from './property-context-search';
import { shouldShowPropertyContextHeader } from './property-route-context';
import { PropertySwitcher } from './property-switcher';

type PropertyContextHeaderProps = {
  propertyId: string;
};

export function PropertyContextHeader({ propertyId }: PropertyContextHeaderProps) {
  const pathname = usePathname();
  const shouldShow = shouldShowPropertyContextHeader(pathname);
  const { data: propData } = useSWR(shouldShow ? ['property', propertyId] : null, () => propertiesApi.get(propertyId));
  const { data: dashboard } = useSWR(shouldShow ? ['dashboard', propertyId] : null, () => propertiesApi.dashboard(propertyId));

  if (!shouldShow) return null;

  const property = propData?.property;
  const score = dashboard?.health_score ?? property?.health_score ?? 0;
  const isPlaceholderScore = score === 50;
  const scoreLabel = isPlaceholderScore ? 'Em formação' : `${score}`;
  const openOrders = (dashboard?.services.requested ?? 0) + (dashboard?.services.in_progress ?? 0);

  return (
    <section className="mx-auto w-full max-w-[1180px] px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={`/properties/${propertyId}`}
            aria-label="Voltar para o resumo do imovel"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-subtle text-text-secondary transition-colors hover:bg-bg-muted hover:text-text-primary focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {property?.name ?? 'Imovel'}
            </p>
            <p className="mt-0.5 flex min-w-0 items-center gap-1 truncate text-xs text-text-tertiary">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {property ? `${property.address}, ${property.city}` : 'Carregando contexto'}
              </span>
            </p>
          </div>

          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <MetricPill
              icon={Activity}
              label="Saúde técnica"
              value={scoreLabel}
              valueClassName={isPlaceholderScore ? 'text-text-secondary' : scoreColor(score)}
            />
            <MetricPill icon={Wrench} label="OS abertas" value={`${openOrders}`} />
            <PropertyContextSearch propertyId={propertyId} />
            <PropertySwitcher propertyId={propertyId} compact />
          </div>

          <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:hidden">
            <div className="flex flex-col items-end gap-1">
              <span className={cn('text-sm font-medium tabular-nums', isPlaceholderScore ? 'text-text-secondary' : scoreColor(score))}>
                {scoreLabel}
              </span>
              <span className="text-[10px] text-text-tertiary">{openOrders} OS</span>
            </div>
            <PropertyContextSearch propertyId={propertyId} />
            <PropertySwitcher propertyId={propertyId} compact />
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  valueClassName,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] bg-bg-subtle px-3">
      <Icon className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
      <span className="text-[11px] text-text-tertiary">{label}</span>
      <span className={cn('text-sm font-medium tabular-nums text-text-primary', valueClassName)}>{value}</span>
    </div>
  );
}
