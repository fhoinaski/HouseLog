'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { providerApi } from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceOrderCard } from '@/components/services/service-order-card';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { Briefcase, Wrench, CheckCircle2, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

export default function ProviderDashboard() {
  const { user } = useAuth();
  const { data } = useSWR('provider-stats', providerApi.stats);

  const stats = data?.stats ?? {};
  const total = data?.total ?? 0;
  const recentBids = data?.recent_bids ?? [];

  const statCards = [
    { label: 'Em andamento', value: (stats.in_progress ?? 0) + (stats.approved ?? 0), icon: Wrench, tone: 'warning' as const },
    { label: 'Concluídas', value: (stats.completed ?? 0) + (stats.verified ?? 0), icon: CheckCircle2, tone: 'success' as const },
    { label: 'Urgentes', value: 0, icon: AlertTriangle, tone: 'danger' as const },
    { label: 'Total OS', value: total, icon: Clock, tone: 'accent' as const },
  ];

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Rede homologada"
        title={`Olá, ${user?.name?.split(' ')[0]}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            icon={metric.icon}
            tone={metric.tone}
            density="compact"
          />
        ))}
      </div>

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

      {recentBids.length > 0 && (
        <PageSection title="Últimas propostas">
          <div className="space-y-2">
            {(recentBids as unknown as { id: string; service_title: string; property_name: string; amount: number; status: string; created_at: string }[]).map((bid) => (
              <ServiceOrderCard
                key={bid.id}
                title={bid.service_title}
                meta={`${bid.property_name} · ${formatDate(bid.created_at)}`}
                value={formatCurrency(bid.amount)}
                status={
                  <Badge variant={bid.status === 'accepted' ? 'success' : bid.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                    {bid.status === 'accepted' ? 'Aceita' : bid.status === 'rejected' ? 'Recusada' : 'Pendente'}
                  </Badge>
                }
              />
            ))}
          </div>
        </PageSection>
      )}
    </div>
  );
}
