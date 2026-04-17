'use client';

import { use, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus, Wrench, ChevronRight, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import { servicesApi, roomsApi, type ServiceOrder } from '@/lib/api';
import { usePagination } from '@/hooks/usePagination';
import { Card, CardContent } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  SERVICE_STATUS_LABELS, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatDate, cn
} from '@/lib/utils';

const schema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  system_type: z.string().min(1),
  description: z.string().optional(),
  room_id: z.string().optional(),
  priority: z.enum(['urgent', 'normal', 'preventive']).default('normal'),
  assigned_to: z.string().optional(),
  cost: z.coerce.number().positive().optional().or(z.literal('')),
  scheduled_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

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
  const [statusFilter, setStatusFilter] = useState('');
  const { mutate: globalMutate } = useSWRConfig();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: orders, isLoadingMore, hasMore, loadMore, mutate } =
    usePagination<ServiceOrder>(
      `/properties/${id}/services`,
      statusFilter ? { status: statusFilter } : undefined
    );

  const { data: roomsData } = useSWR(['rooms', id], () => roomsApi.list(id));

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'normal' },
  });

  async function onSubmit(form: FormData) {
    setApiError(null);
    try {
      await servicesApi.create(id, {
        ...form,
        cost: form.cost === '' ? undefined : Number(form.cost),
      });
      await mutate();
      void globalMutate(['dashboard', id]);
      reset({ priority: 'normal' });
      setDialogOpen(false);
    } catch (e) {
      setApiError((e as Error).message);
    }
  }

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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Ordens de Serviço</h2>
        <Button onClick={() => { reset({ priority: 'normal' }); setApiError(null); setDialogOpen(true); }}>
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
          <Button variant="outline" className="mt-3" onClick={() => setDialogOpen(true)}>
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

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Ordem de Serviço</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label htmlFor="os-title">Título *</Label>
              <Input id="os-title" placeholder="Reparo elétrico no quarto..." {...register('title')} />
              {errors.title && <p className="text-xs text-rose-500">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sistema *</Label>
                <Select onValueChange={(v) => setValue('system_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SYSTEM_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.system_type && <p className="text-xs text-rose-500">{errors.system_type.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select defaultValue="normal" onValueChange={(v) => setValue('priority', v as FormData['priority'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgente</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="preventive">Preventiva</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cômodo</Label>
                <Select onValueChange={(v) => setValue('room_id', v === '__none__' ? undefined : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum</SelectItem>
                    {(roomsData?.rooms ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="os-cost">Custo estimado (R$)</Label>
                <Input id="os-cost" type="number" step="0.01" placeholder="0.00" {...register('cost')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="os-desc">Descrição</Label>
              <textarea
                id="os-desc"
                rows={3}
                placeholder="Descreva o problema ou serviço..."
                className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                {...register('description')}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="os-scheduled">Agendado para</Label>
              <Input id="os-scheduled" type="datetime-local" {...register('scheduled_at')} />
            </div>

            {apiError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
                {apiError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">Criar OS</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
              {JSON.parse(selectedOrder.before_photos || '[]').length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Fotos antes</p>
                  <div className="flex gap-2 flex-wrap">
                    {(JSON.parse(selectedOrder.before_photos) as string[]).map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="antes" className="h-16 w-16 rounded object-cover" />
                    ))}
                  </div>
                </div>
              )}

              {JSON.parse(selectedOrder.after_photos || '[]').length > 0 && (
                <div>
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Fotos depois</p>
                  <div className="flex gap-2 flex-wrap">
                    {(JSON.parse(selectedOrder.after_photos) as string[]).map((url, i) => (
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
