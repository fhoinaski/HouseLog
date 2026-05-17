'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { providerApi } from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceOrderCard } from '@/components/services/service-order-card';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Briefcase, Wrench, CheckCircle2, Clock, AlertTriangle, ChevronRight, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, mutate } = useSWR('provider-stats', providerApi.stats);

  const bidStatusLabel: Record<string, string> = {
    accepted: 'Aceita',
    pending: 'Pendente',
    rejected: 'Recusada',
  };

  type StatCard = {
    label: string;
    value: number | null;
    icon: typeof Wrench;
    tone: 'warning' | 'success' | 'danger' | 'accent';
  };

  const statCards: StatCard[] = [
    {
      label: 'Em andamento',
      value: error ? null : isLoading ? null : ((data?.stats.in_progress ?? 0) + (data?.stats.approved ?? 0)),
      icon: Wrench,
      tone: 'warning',
    },
    {
      label: 'Concluídas',
      value: error ? null : isLoading ? null : ((data?.stats.completed ?? 0) + (data?.stats.verified ?? 0)),
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      label: 'Urgentes',
      value: error ? null : isLoading ? null : 0,
      icon: AlertTriangle,
      tone: 'danger',
    },
    {
      label: 'Total OS',
      value: error ? null : isLoading ? null : (data?.total ?? 0),
      icon: Clock,
      tone: 'accent',
    },
  ];

  const recentBids = data?.recent_bids ?? [];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Rede homologada"
        title={`Olá, ${user?.name?.split(' ')[0]}`}
      />

      {error ? (
        <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-4 py-5 text-center">
          <p className="text-sm text-text-secondary">Não foi possível carregar as métricas.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => void mutate()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isLoading
            ? [1, 2, 3, 4].map((key) => (
                <div key={key} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
              ))
            : statCards.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value ?? 0}
                  icon={metric.icon}
                  tone={metric.tone}
                  density="compact"
                />
              ))}
        </div>
      )}

      <Link
        href="/provider/services"
        className="flex items-center justify-between rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-4 py-3.5 transition-colors hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle">
            <Wrench className="h-4 w-4 text-text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Minhas operações</p>
            <p className="text-xs text-text-tertiary">Ordens atribuídas à sua rede</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-text-tertiary" />
      </Link>

      <Link
        href="/provider/opportunities"
        className="flex items-center justify-between rounded-[var(--radius-xl)] bg-[var(--surface-base)] px-4 py-3.5 transition-colors hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle">
            <Briefcase className="h-4 w-4 text-text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Oportunidades</p>
            <p className="text-xs text-text-tertiary">Solicitações elegíveis para proposta</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-text-tertiary" />
      </Link>

      {!isLoading && !error && recentBids.length > 0 && (
        <PageSection title="Últimas propostas">
          <div className="space-y-2">
            {(recentBids as unknown as { id: string; service_title: string; property_name: string; amount: number; status: string; created_at: string }[]).map((bid) => (
              <ServiceOrderCard
                key={bid.id}
                title={bid.service_title}
                meta={`${bid.property_name} · ${formatDate(bid.created_at)}`}
                value={formatCurrency(bid.amount)}
                status={
                  <StatusBadge status={bid.status} label={bidStatusLabel[bid.status] ?? bid.status} />
                }
              />
            ))}
          </div>
        </PageSection>
      )}
    </div>
  );
}
