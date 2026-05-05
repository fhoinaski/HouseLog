'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSWRConfig } from 'swr';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Plus, ShieldCheck, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceOrderCard } from '@/components/services/service-order-card';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { usePagination } from '@/hooks/usePagination';
import { type ServiceOrder } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SERVICE_STATUS_LABELS, SYSTEM_TYPE_LABELS, formatDate } from '@/lib/utils';

const SERVICE_TABS = [
  { key: 'open', label: 'Abertos' },
  { key: 'in_progress', label: 'Em execucao' },
  { key: 'completed', label: 'Concluidos' },
  { key: 'warranty', label: 'Garantia' },
  { key: 'all', label: 'Todos' },
] as const;

type ServiceTabKey = (typeof SERVICE_TABS)[number]['key'];

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

function getOperationalStage(order: ServiceOrder) {
  if (order.status === 'requested') return 'Aberta';
  if (order.status === 'approved') return order.assigned_to ? 'Aprovada para execucao' : 'Aprovada';
  if (order.status === 'in_progress') return 'Em execucao';
  if (order.status === 'completed') return 'Aguardando verificacao';
  if (order.status === 'verified') return 'Verificada';
  return SERVICE_STATUS_LABELS[order.status] ?? order.status;
}

function getServiceValue(order: ServiceOrder) {
  if (order.assigned_to_name) return order.assigned_to_name;
  if (order.scheduled_at) return `Agendado: ${formatDate(order.scheduled_at)}`;
  return 'Sem prestador definido';
}

function matchesTab(order: ServiceOrder, tab: ServiceTabKey) {
  if (tab === 'all') return true;
  if (tab === 'open') return order.status === 'requested' || order.status === 'approved';
  if (tab === 'in_progress') return order.status === 'in_progress';
  if (tab === 'completed') return order.status === 'completed' || order.status === 'verified';
  if (tab === 'warranty') return Boolean(order.warranty_until);
  return true;
}

export default function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ServiceTabKey>('open');
  const [createOpen, setCreateOpen] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  const { data: orders, isLoadingMore, hasMore, loadMore, mutate } = usePagination<ServiceOrder>(
    `/properties/${id}/services`
  );

  const visibleOrders = useMemo(
    () => orders.filter((order) => matchesTab(order, activeTab)),
    [activeTab, orders]
  );

  const operationalCounts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        if (order.status === 'requested' || order.status === 'approved') acc.open += 1;
        if (order.status === 'in_progress') acc.active += 1;
        if (order.status === 'completed' || order.status === 'verified') acc.done += 1;
        if (order.warranty_until) acc.warranty += 1;
        return acc;
      },
      { open: 0, active: 0, done: 0, warranty: 0 }
    );
  }, [orders]);

  function openDetail(order: ServiceOrder) {
    router.push(`/properties/${id}/services/${order.id}`);
  }

  return (
    <div className="mx-auto max-w-[1040px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="compact"
        eyebrow="Centro operacional"
        title="Servicos"
        description="Ordens aprovadas, em execucao ou concluidas neste imovel."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          icon={Clock}
          label="Abertos"
          value={operationalCounts.open}
          helper="a iniciar"
          tone="warning"
          density="compact"
        />
        <MetricCard
          icon={Wrench}
          label="Em execucao"
          value={operationalCounts.active}
          helper="servicos ativos"
          tone="default"
          density="compact"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Concluidos"
          value={operationalCounts.done}
          helper="finalizados"
          tone="success"
          density="compact"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Garantia"
          value={operationalCounts.warranty}
          helper="com cobertura"
          tone="accent"
          density="compact"
        />
      </div>

      <div className="flex flex-wrap gap-2 tap-highlight-none">
        {SERVICE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="hl-chip"
            data-active={activeTab === tab.key ? 'true' : undefined}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <PageSection tone="strong" density="default">
        {visibleOrders.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-6 w-6" />}
            title="Nenhum servico encontrado"
            description="Ordens aprovadas, em execucao ou concluidas deste imovel aparecem aqui."
            actions={
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Criar OS
              </Button>
            }
            tone="subtle"
            density="spacious"
          />
        ) : (
          <>
            <div className="grid gap-3 tap-highlight-none lg:grid-cols-2">
              {visibleOrders.map((order) => {
                const urgent = order.priority === 'urgent';

                return (
                  <button
                    key={order.id}
                    type="button"
                    className="text-left focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
                    onClick={() => openDetail(order)}
                  >
                    <ServiceOrderCard
                      interactive
                      leadingIcon={
                        urgent ? (
                          <AlertTriangle className="h-4 w-4 text-text-danger" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )
                      }
                      title={order.title}
                      meta={`${SYSTEM_TYPE_LABELS[order.system_type]} - ${order.room_name ?? 'Sem comodo'}`}
                      value={getServiceValue(order)}
                      status={
                        <div className="flex max-w-[10rem] flex-wrap justify-end gap-1.5">
                          <StatusBadge status={order.status} label={getOperationalStage(order)} />
                          <Badge variant={PRIORITY_VARIANT[order.priority]} className="text-xs">
                            {SERVICE_PRIORITY_LABELS[order.priority]}
                          </Badge>
                        </div>
                      }
                      footer={
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>{formatDate(order.created_at)}</span>
                          {order.assigned_to_name && <span>{order.assigned_to_name}</span>}
                          <span>Chat no detalhe</span>
                        </span>
                      }
                    />
                  </button>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Carregar mais'}
                </Button>
              </div>
            )}
          </>
        )}
      </PageSection>

      <ServiceOrderCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        propertyId={id}
        onCreated={async (orderId) => {
          await mutate();
          void globalMutate(['dashboard', id]);
          router.push(`/properties/${id}/services/${orderId}`);
        }}
      />
    </div>
  );
}
