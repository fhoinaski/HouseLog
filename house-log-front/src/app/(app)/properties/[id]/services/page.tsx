'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { Loader2, Plus, Wrench, ChevronRight, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { servicesApi, type ServiceOrder } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { ServiceOrderCreateModal } from '@/components/services/service-order-create-modal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  SERVICE_STATUS_LABELS, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatDate, cn
} from '@/lib/utils';

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

const STATUS_ICON: Record<string, React.ElementType> = {
  requested: Clock,
  approved: Clock,
  in_progress: Wrench,
  completed: CheckCircle2,
  verified: CheckCircle2,
};

function safeParseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function OrderRow({ order, onClick }: { order: ServiceOrder; onClick: () => void }) {
  const StatusIcon = STATUS_ICON[order.status] ?? Clock;

  return (
    <Card className="cursor-pointer hover:shadow-sm transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
              order.priority === 'urgent' ? 'bg-rose-50' : 'bg-primary-50'
            )}>
              <StatusIcon className={cn(
                'h-4 w-4',
                order.priority === 'urgent' ? 'text-rose-500' : 'text-primary-600'
              )} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{order.title}</p>
                {order.priority === 'urgent' && (
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                {SYSTEM_TYPE_LABELS[order.system_type]} · {order.room_name ?? 'Sem cômodo'}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant={STATUS_VARIANT[order.status]} className="text-xs">
                  {SERVICE_STATUS_LABELS[order.status]}
                </Badge>
                <Badge variant={PRIORITY_VARIANT[order.priority]} className="text-xs">
                  {SERVICE_PRIORITY_LABELS[order.priority]}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-[var(--muted-foreground)]">{formatDate(order.created_at)}</p>
            {order.assigned_to_name && (
              <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{order.assigned_to_name}</p>
            )}
            <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] ml-auto mt-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ServicesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');
  const { mutate: globalMutate } = useSWRConfig();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: orders, isLoadingMore, hasMore, loadMore, mutate } =
    usePagination<ServiceOrder>(
      `/properties/${id}/services`,
      statusFilter ? { status: statusFilter } : undefined
    );

  async function updateStatus(orderId: string, status: string) {
    try {
      await servicesApi.updateStatus(id, orderId, status);
      await mutate();
      void globalMutate(['dashboard', id]);
      setDetailOpen(false);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function openDetail(order: ServiceOrder) {
    setSelectedOrder(order);
    setDetailOpen(true);
  }

  const STATUS_TRANSITIONS: Record<string, string[]> = {
    requested: ['approved'],
    approved: ['in_progress'],
    in_progress: ['completed'],
    completed: ['verified'],
    verified: [],
  };

  const selectedBeforePhotos = selectedOrder
    ? safeParseStringArray(selectedOrder.before_photos)
    : [];
  const selectedAfterPhotos = selectedOrder
    ? safeParseStringArray(selectedOrder.after_photos)
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ordens de Serviço</h2>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova OS
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'requested', 'approved', 'in_progress', 'completed', 'verified'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
              statusFilter === s
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:border-primary-400'
            )}
          >
            {s ? SERVICE_STATUS_LABELS[s] : 'Todas'}
          </button>
        ))}
      </div>

      {/* List */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-[var(--muted-foreground)] text-sm">Nenhuma OS encontrada</p>
          <Button variant="outline" className="mt-3" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Criar OS
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} onClick={() => openDetail(order)} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Carregar mais'
                )}
              </Button>
            </div>
          )}
        </>
      )}

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

      {/* Detail dialog */}
      {selectedOrder && (
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="pr-8">{selectedOrder.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant={STATUS_VARIANT[selectedOrder.status]}>
                  {SERVICE_STATUS_LABELS[selectedOrder.status]}
                </Badge>
                <Badge variant={PRIORITY_VARIANT[selectedOrder.priority]}>
                  {SERVICE_PRIORITY_LABELS[selectedOrder.priority]}
                </Badge>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--muted-foreground)]">Sistema</dt>
                  <dd>{SYSTEM_TYPE_LABELS[selectedOrder.system_type]}</dd>
                </div>
                {selectedOrder.room_name && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--muted-foreground)]">Cômodo</dt>
                    <dd>{selectedOrder.room_name}</dd>
                  </div>
                )}
                {selectedOrder.cost && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--muted-foreground)]">Custo</dt>
                    <dd>R$ {selectedOrder.cost.toFixed(2)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-[var(--muted-foreground)]">Criada por</dt>
                  <dd>{selectedOrder.requested_by_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--muted-foreground)]">Data</dt>
                  <dd>{formatDate(selectedOrder.created_at)}</dd>
                </div>
              </dl>

              {selectedOrder.description && (
                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-1">Descrição</p>
                  <p className="text-sm">{selectedOrder.description}</p>
                </div>
              )}

              {/* Photos */}
              {selectedBeforePhotos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Fotos antes</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedBeforePhotos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="antes" className="h-16 w-16 rounded object-cover" />
                    ))}
                  </div>
                </div>
              )}

              {selectedAfterPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Fotos depois</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedAfterPhotos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="depois" className="h-16 w-16 rounded object-cover" />
                    ))}
                  </div>
                </div>
              )}

              {/* Status actions */}
              {STATUS_TRANSITIONS[selectedOrder.status]?.length > 0 && (
                <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
                  {STATUS_TRANSITIONS[selectedOrder.status].map((next) => (
                    <Button
                      key={next}
                      onClick={() => updateStatus(selectedOrder.id, next)}
                      className="flex-1"
                    >
                      {SERVICE_STATUS_LABELS[next]}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
