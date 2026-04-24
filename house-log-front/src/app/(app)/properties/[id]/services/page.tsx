'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { AlertTriangle, CheckCircle2, Clock, Loader2, MessageCircle, Plus, ReceiptText, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceOrderCard } from '@/components/services/service-order-card';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { MetricCard } from '@/components/ui/metric-card';
import { usePagination } from '@/hooks/usePagination';
import { bidsApi, type ServiceBid, type ServiceOrder } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SERVICE_STATUS_LABELS, SYSTEM_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';

const STATUS_FILTERS = ['', 'requested', 'approved', 'in_progress', 'completed', 'verified'] as const;

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  requested: 'requested',
  approved: 'approved',
  in_progress: 'in_progress',
  completed: 'completed',
  verified: 'verified',
};

type BidSummary = {
  total: number;
  pending: number;
  accepted: number;
  bestAmount: number | null;
};

function summarizeBids(bids: ServiceBid[]): BidSummary {
  const amounts = bids.map((bid) => Number(bid.amount)).filter((amount) => Number.isFinite(amount));

  return {
    total: bids.length,
    pending: bids.filter((bid) => bid.status === 'pending').length,
    accepted: bids.filter((bid) => bid.status === 'accepted').length,
    bestAmount: amounts.length > 0 ? Math.min(...amounts) : null,
  };
}

function getOperationalStage(order: ServiceOrder, bidSummary?: BidSummary) {
  if (order.status === 'requested') {
    if ((bidSummary?.total ?? 0) > 0) return 'Proposta em analise';
    if (!order.assigned_to) return 'Orcamento solicitado';
    return 'Solicitada';
  }

  if (order.status === 'approved') return order.assigned_to ? 'Aprovada para execucao' : 'Aprovada';
  if (order.status === 'in_progress') return 'Em execucao';
  if (order.status === 'completed') return 'Aguardando verificacao';
  if (order.status === 'verified') return 'Verificada';
  return SERVICE_STATUS_LABELS[order.status] ?? order.status;
}

function getBidSummaryLabel(order: ServiceOrder, bidSummary?: BidSummary) {
  const hasBids = (bidSummary?.total ?? 0) > 0;

  if (hasBids) {
    if (bidSummary?.bestAmount !== null && bidSummary?.bestAmount !== undefined) {
      return `Menor: ${formatCurrency(bidSummary.bestAmount)}`;
    }
    return `${bidSummary?.pending ?? 0} pendente(s)`;
  }

  return order.assigned_to ? 'Execucao direta' : 'Aguardando proposta';
}

export default function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();

  const { data: orders, isLoadingMore, hasMore, loadMore, mutate } = usePagination<ServiceOrder>(
    `/properties/${id}/services`,
    statusFilter ? { status: statusFilter } : undefined
  );

  const orderIds = useMemo(() => orders.map((order) => order.id), [orders]);

  const { data: bidSummaryMap } = useSWR(
    orderIds.length > 0 ? ['service-bid-summary', id, ...orderIds] : null,
    async () => {
      const entries = await Promise.all(
        orderIds.map(async (orderId) => {
          const response = await bidsApi.list(id, orderId);
          return [orderId, summarizeBids(response.bids)] as const;
        })
      );
      return new Map<string, BidSummary>(entries);
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const operationalCounts = useMemo(() => {
    return orders.reduce(
      (acc, order) => {
        const bids = bidSummaryMap?.get(order.id);
        if (order.status === 'requested' && !order.assigned_to) acc.quote += 1;
        if ((bids?.total ?? 0) > 0) acc.bids += 1;
        if (order.status === 'in_progress') acc.active += 1;
        if (order.status === 'completed') acc.review += 1;
        return acc;
      },
      { quote: 0, bids: 0, active: 0, review: 0 }
    );
  }, [bidSummaryMap, orders]);

  function openDetail(order: ServiceOrder) {
    router.push(`/properties/${id}/services/${order.id}`);
  }

  return (
    <div className="mx-auto max-w-[1040px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="compact"
        eyebrow="Centro operacional"
        title="Ordens de serviço"
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova OS
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <MetricCard
          icon={ReceiptText}
          label="Orcamento solicitado"
          value={operationalCounts.quote}
          helper="aguardando proposta"
          tone="warning"
          density="compact"
        />
        <MetricCard
          icon={MessageCircle}
          label="Com proposta"
          value={operationalCounts.bids}
          helper="para analise"
          tone="accent"
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
          label="Para verificar"
          value={operationalCounts.review}
          helper="conclusao pendente"
          tone="success"
          density="compact"
        />
      </div>

      <div className="flex flex-wrap gap-2 tap-highlight-none">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status || 'all'}
            type="button"
            className="hl-chip"
            data-active={statusFilter === status ? 'true' : undefined}
            onClick={() => setStatusFilter(status)}
          >
            {status ? SERVICE_STATUS_LABELS[status] : 'Todas'}
          </button>
        ))}
      </div>

      <PageSection
        tone="strong"
        density="default"
      >
        {orders.length === 0 ? (
          <EmptyState
            icon={<Wrench className="h-6 w-6" />}
            title="Nenhuma OS encontrada"
            description="Quando houver solicitacao, orcamento, execucao ou verificacao, o trilho aparece aqui."
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
              {orders.map((order) => {
                const bidSummary = bidSummaryMap?.get(order.id);
                const hasBids = (bidSummary?.total ?? 0) > 0;
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
                      value={getBidSummaryLabel(order, bidSummary)}
                      status={
                        <div className="flex max-w-[10rem] flex-wrap justify-end gap-1.5">
                          <Badge variant={STATUS_VARIANT[order.status]} className="text-xs">
                            {getOperationalStage(order, bidSummary)}
                          </Badge>
                          <Badge variant={PRIORITY_VARIANT[order.priority]} className="text-xs">
                            {SERVICE_PRIORITY_LABELS[order.priority]}
                          </Badge>
                          {hasBids && (
                            <Badge variant={bidSummary?.accepted ? 'approved' : 'requested'} className="text-xs">
                              {bidSummary?.total} proposta(s)
                            </Badge>
                          )}
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
