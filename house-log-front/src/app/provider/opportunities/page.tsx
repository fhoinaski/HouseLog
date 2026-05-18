'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Briefcase, ChevronRight, MapPin } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { providerApi, type ProviderNetworkOpportunity } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';
import { PageContainer } from '@/components/layout/page-container';

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

const BID_STATUS_LABEL: Record<NonNullable<ProviderNetworkOpportunity['my_bid']>['status'], string> = {
  accepted: 'Aceita',
  pending: 'Em análise',
  rejected: 'Recusada',
};

const SYSTEM_FILTERS = [
  '',
  'electrical',
  'plumbing',
  'structural',
  'waterproofing',
  'painting',
  'flooring',
  'roofing',
  'general',
];

export default function ProviderOpportunitiesPage() {
  const [systemFilter, setSystemFilter] = useState('');

  const { data, isLoading } = useSWR(['provider-opportunities', systemFilter], () =>
    providerApi.opportunities(systemFilter ? { system_type: systemFilter } : undefined)
  );

  const opportunities = data?.data ?? [];

  return (
    <PageContainer variant="narrow" className="space-y-5">
      <header className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4 shadow-hl-subtle">
        <p className="text-xs font-medium uppercase tracking-wide text-hl-primary">Rede homologada</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium leading-tight text-hl-text">Oportunidades</h1>
            <p className="mt-1 max-w-sm text-sm leading-5 text-hl-text-muted">
              Solicitações elegíveis para análise e proposta técnica.
            </p>
          </div>
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary sm:flex">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </header>

      <div role="group" aria-label="Filtrar por sistema" className="flex flex-wrap gap-2">
        {SYSTEM_FILTERS.map((system) => (
          <button
            key={system || 'all'}
            type="button"
            className={
              'min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus ' +
              (systemFilter === system
                ? 'border-hl-primary bg-hl-primary text-white'
                : 'border-hl-border bg-hl-surface text-hl-text-muted hover:bg-hl-surface-muted')
            }
            aria-pressed={systemFilter === system}
            onClick={() => setSystemFilter(system)}
          >
            {system ? SYSTEM_TYPE_LABELS[system] : 'Todos'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="hl-skeleton h-32 rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface" />
          ))}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-5 py-8 text-center shadow-hl-subtle">
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Nenhuma solicitação elegível no momento"
            description="Quando uma operação privada compatível com sua homologação estiver disponível, ela aparecerá aqui para análise."
            tone="subtle"
            density="spacious"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map((item: ProviderNetworkOpportunity) => (
            <OpportunityCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function OpportunityCard({ item }: { item: ProviderNetworkOpportunity }) {
  return (
    <Link
      href={`/provider/opportunities/${item.id}`}
      aria-label={`Abrir oportunidade ${item.title}`}
      className="group block rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4 shadow-hl-subtle transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-hl-surface-muted hover:shadow-hl-soft focus-visible:outline-none focus-visible:shadow-focus active:translate-y-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium leading-6 text-hl-text">{item.title}</p>
            <p className="mt-0.5 text-sm text-hl-text-muted">
              {SYSTEM_TYPE_LABELS[item.system_type]} - {item.room_name ?? 'Sem cômodo'}
            </p>
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-hl-text-muted transition-colors group-hover:text-hl-primary" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[item.priority]} className="text-xs">
          {SERVICE_PRIORITY_LABELS[item.priority]}
        </Badge>
        {item.my_bid ? (
          <StatusBadge status={item.my_bid.status} label={BID_STATUS_LABEL[item.my_bid.status]} />
        ) : (
          <StatusBadge status="submitted" label="Elegível" />
        )}
        {item.my_bid && <span className="ml-auto text-sm font-medium text-hl-success">{formatCurrency(item.my_bid.amount)}</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hl-border pt-3 text-sm text-hl-text-muted">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-hl-primary" aria-hidden="true" />
          <span className="truncate">{item.property_name}</span>
        </span>
        <span>{formatDate(item.created_at)}</span>
      </div>
    </Link>
  );
}
