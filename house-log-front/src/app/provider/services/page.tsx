'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { AlertTriangle, ChevronRight, MapPin, RefreshCw, Wrench, WifiOff } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { providerApi, type ProviderServiceOrder } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SERVICE_STATUS_LABELS, SYSTEM_TYPE_LABELS, formatDate } from '@/lib/utils';
import { PageContainer } from '@/components/layout/page-container';

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

const STATUS_FILTERS = ['', 'approved', 'in_progress', 'completed', 'verified'] as const;

export default function ProviderServicesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  const { data, isLoading, error, mutate } = useSWR(['provider-services', statusFilter], () =>
    providerApi.services(statusFilter ? { status: statusFilter } : undefined)
  );

  useEffect(() => {
    const updateOnlineState = () => setIsOffline(!navigator.onLine);
    updateOnlineState();
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  const orders = data?.data ?? [];

  return (
    <PageContainer variant="narrow" className="space-y-5">
      <header className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4 shadow-hl-subtle">
        <p className="text-xs font-medium uppercase tracking-wide text-hl-primary">Operação privada</p>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-medium leading-tight text-hl-text">Minhas operações</h1>
            <p className="mt-1 max-w-sm text-sm leading-5 text-hl-text-muted">
              Ordens atribuídas ao seu perfil, com status e prioridade para ação rápida.
            </p>
          </div>
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary sm:flex">
            <Wrench className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </header>

      {isOffline && (
        <div className="flex items-start gap-3 rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-3 text-sm text-hl-text-muted shadow-hl-subtle">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-hl-warning" aria-hidden="true" />
          <p>Sem conexão. A lista pode estar desatualizada até a rede voltar.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar operações por status">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status || 'all'}
            type="button"
            className={
              'min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:shadow-focus ' +
              (statusFilter === status
                ? 'border-hl-primary bg-hl-primary text-white'
                : 'border-hl-border bg-hl-surface text-hl-text-muted hover:bg-hl-surface-muted')
            }
            aria-pressed={statusFilter === status}
            onClick={() => setStatusFilter(status)}
          >
            {status ? SERVICE_STATUS_LABELS[status] : 'Todas'}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-5 text-center shadow-hl-subtle">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-danger">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-sm font-medium text-hl-text">Não foi possível carregar suas operações</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-hl-text-muted">
            {isOffline ? 'Verifique sua conexão e tente novamente.' : 'Tente novamente em instantes.'}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-4 text-hl-primary hover:bg-hl-surface-muted"
            onClick={() => void mutate()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3" aria-label="Carregando operações">
          {[1, 2, 3].map((item) => (
            <div key={item} className="hl-skeleton h-32 rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-5 py-8 text-center shadow-hl-subtle">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
            <Wrench className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-sm font-medium text-hl-text">Nenhuma operação encontrada</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-hl-text-muted">
            Quando uma ordem de serviço for atribuída ou liberada para seu perfil, ela aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="tap-highlight-none space-y-3">
          {orders.map((order: ProviderServiceOrder) => (
            <ProviderServiceCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function ProviderServiceCard({ order }: { order: ProviderServiceOrder }) {
  const priorityLabel = SERVICE_PRIORITY_LABELS[order.priority];
  const statusLabel = SERVICE_STATUS_LABELS[order.status];
  const systemLabel = SYSTEM_TYPE_LABELS[order.system_type];
  const isUrgent = order.priority === 'urgent';

  return (
    <Link
      href={`/provider/services/${order.id}`}
      aria-label={`Abrir ordem ${order.title}, status ${statusLabel}, prioridade ${priorityLabel}`}
      className="group block rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4 shadow-hl-subtle transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-hl-surface-muted hover:shadow-hl-soft focus-visible:outline-none focus-visible:shadow-focus active:translate-y-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className={
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted ' +
              (isUrgent ? 'text-hl-danger' : 'text-hl-primary')
            }
          >
            {isUrgent ? <AlertTriangle className="h-5 w-5" aria-hidden="true" /> : <Wrench className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-medium leading-6 text-hl-text">{order.title}</p>
            <p className="mt-0.5 text-sm text-hl-text-muted">{systemLabel}</p>
          </div>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-hl-text-muted transition-colors group-hover:text-hl-primary" aria-hidden="true" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={order.status} label={statusLabel} />
        <Badge variant={PRIORITY_VARIANT[order.priority]} className="text-xs">
          {priorityLabel}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-hl-border pt-3 text-sm text-hl-text-muted">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-hl-primary" aria-hidden="true" />
          <span className="truncate">{order.property_name}</span>
        </span>
        <span>{formatDate(order.created_at)}</span>
      </div>
    </Link>
  );
}
