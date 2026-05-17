'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { providerApi } from '@/lib/api';
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

  type RecentBid = {
    id: string;
    service_id?: string;
    service_title: string;
    property_name: string;
    amount: number;
    status: string;
    created_at: string;
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

  const calmIconTone: Record<StatCard['tone'], string> = {
    accent: 'bg-hl-surface-muted text-hl-primary',
    danger: 'bg-hl-surface-muted text-hl-danger',
    success: 'bg-hl-surface-muted text-hl-success',
    warning: 'bg-hl-surface-muted text-hl-warning',
  };

  const recentBids = (data?.recent_bids ?? []) as unknown as RecentBid[];
  const firstName = user?.name?.split(' ')[0] ?? 'prestador';

  return (
    <div className="min-h-full space-y-5 bg-hl-bg px-4 pb-8 pt-4 text-hl-text sm:px-5 sm:py-5">
      <header className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4 shadow-hl-subtle">
        <p className="text-xs font-medium uppercase tracking-wide text-hl-primary">Rede homologada</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium leading-tight text-hl-text">Olá, {firstName}</h1>
            <p className="mt-1 max-w-sm text-sm leading-5 text-hl-text-muted">
              Acompanhe operações atribuídas, propostas recentes e próximas ações.
            </p>
          </div>
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary sm:flex">
            <Briefcase className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </header>

      {error ? (
        <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-5 text-center shadow-hl-subtle">
          <p className="text-sm text-hl-text-muted">Não foi possível carregar as métricas.</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3 text-hl-primary hover:bg-hl-surface-muted"
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
                <div key={key} className="hl-skeleton h-24 rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface" />
              ))
            : statCards.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value ?? 0}
                  icon={metric.icon}
                  tone="default"
                  density="compact"
                  className="border border-hl-border bg-hl-surface shadow-hl-subtle"
                  iconClassName={calmIconTone[metric.tone]}
                  valueClassName="text-hl-text"
                  labelClassName="text-hl-text-muted"
                />
              ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/provider/services"
          className="group flex min-h-20 items-center justify-between rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-3.5 shadow-hl-subtle transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-focus"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
              <Wrench className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-hl-text">Minhas operações</p>
              <p className="truncate text-xs text-hl-text-muted">Ordens atribuídas à sua rede</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-hl-text-muted transition-colors group-hover:text-hl-primary" />
        </Link>

        <Link
          href="/provider/opportunities"
          className="group flex min-h-20 items-center justify-between rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-3.5 shadow-hl-subtle transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-focus"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary-blue">
              <Briefcase className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-hl-text">Oportunidades</p>
              <p className="truncate text-xs text-hl-text-muted">Solicitações elegíveis para proposta</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-hl-text-muted transition-colors group-hover:text-hl-primary-blue" />
        </Link>
      </div>

      {!isLoading && !error && recentBids.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium leading-tight text-hl-text">Últimas propostas</h2>
              <p className="text-sm text-hl-text-muted">Acesse rapidamente os detalhes enviados.</p>
            </div>
            <Link href="/provider/opportunities" className="text-sm font-medium text-hl-primary hover:underline">
              Ver todas
            </Link>
          </div>

          <div className="space-y-2">
            {recentBids.map((bid) => (
              <Link
                key={bid.id}
                href={bid.service_id ? `/provider/services/${bid.service_id}` : '/provider/opportunities'}
                className="group flex items-center justify-between gap-3 rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-3.5 shadow-hl-subtle transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-focus"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-hl-text">{bid.service_title}</p>
                  <p className="mt-0.5 truncate text-xs text-hl-text-muted">
                    {bid.property_name} - {formatDate(bid.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-medium text-hl-success">{formatCurrency(bid.amount)}</span>
                    <StatusBadge status={bid.status} label={bidStatusLabel[bid.status] ?? bid.status} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-hl-text-muted transition-colors group-hover:text-hl-primary" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
