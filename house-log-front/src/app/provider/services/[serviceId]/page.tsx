'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { providerApi, bidsApi, type ServiceBid } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  SERVICE_STATUS_LABELS, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS,
  formatDate, formatCurrency, cn,
} from '@/lib/utils';
import { ArrowLeft, MapPin, Calendar, DollarSign, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

const bidSchema = z.object({
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  notes: z.string().max(500).optional(),
});
type BidForm = z.infer<typeof bidSchema>;

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  requested: 'requested', approved: 'approved', in_progress: 'in_progress',
  completed: 'completed', verified: 'verified',
};

export default function ProviderServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const router = useRouter();
  const [submittingBid, setSubmittingBid] = useState(false);

  const { data, mutate } = useSWR(
    ['provider-service', serviceId],
    () => providerApi.getService(serviceId)
  );

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BidForm>({
    resolver: zodResolver(bidSchema),
  });

  const order = data?.order;
  const myBids = data?.my_bids ?? [];
  const hasPendingBid = myBids.some((b: ServiceBid) => b.status === 'pending');

  async function onBidSubmit(form: BidForm) {
    if (!order) return;
    setSubmittingBid(true);
    try {
      await bidsApi.create(order.property_id, serviceId, form);
      await mutate();
      reset();
      toast.success('Orçamento enviado com sucesso!');
    } catch (e) {
      toast.error('Erro ao enviar orçamento', { description: (e as Error).message });
    } finally {
      setSubmittingBid(false);
    }
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const beforePhotos = JSON.parse(order.before_photos || '[]') as string[];

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{order.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={STATUS_VARIANT[order.status]}>{SERVICE_STATUS_LABELS[order.status]}</Badge>
          </div>
        </div>
      </div>

      {/* Details */}
      <Card>
        <CardContent className="p-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Sistema</dt>
              <dd className="font-medium">{SYSTEM_TYPE_LABELS[order.system_type]}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Prioridade</dt>
              <dd className="font-medium">{SERVICE_PRIORITY_LABELS[order.priority]}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Imóvel</dt>
              <dd className="font-medium flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {order.property_name} — {order.property_address}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Criada em</dt>
              <dd className="font-medium flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />{formatDate(order.created_at)}
              </dd>
            </div>
            {order.scheduled_at && (
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Agendado para</dt>
                <dd className="font-medium">{formatDate(order.scheduled_at)}</dd>
              </div>
            )}
          </dl>
          {order.description && (
            <div className="mt-4 pt-4 border-t border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Descrição</p>
              <p className="text-sm whitespace-pre-wrap">{order.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Before photos */}
      {beforePhotos.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fotos do Problema</CardTitle></CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex gap-2 flex-wrap">
              {beforePhotos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`foto-${i}`}
                  className="h-24 w-24 rounded-lg object-cover cursor-pointer hover:opacity-90"
                  onClick={() => window.open(url, '_blank')}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* My bids */}
      {myBids.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Meus Orçamentos</CardTitle></CardHeader>
          <CardContent className="p-0">
            {myBids.map((bid: ServiceBid) => (
              <div key={bid.id} className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] last:border-0">
                <div>
                  <p className="font-bold text-lg">{formatCurrency(bid.amount)}</p>
                  {bid.notes && <p className="text-xs text-[var(--muted-foreground)]">{bid.notes}</p>}
                  <p className="text-xs text-[var(--muted-foreground)]">{formatDate(bid.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {bid.status === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
                  {bid.status === 'accepted' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {bid.status === 'rejected' && <XCircle className="h-4 w-4 text-rose-500" />}
                  <Badge variant={bid.status === 'accepted' ? 'success' : bid.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                    {bid.status === 'accepted' ? 'Aceito' : bid.status === 'rejected' ? 'Recusado' : 'Pendente'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bid form */}
      {!hasPendingBid && order.status !== 'verified' && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Enviar Orçamento</CardTitle></CardHeader>
          <CardContent className="p-5 pt-0">
            <form onSubmit={handleSubmit(onBidSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bid-amount">Valor do orçamento (R$) *</Label>
                <Input id="bid-amount" type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-rose-500">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bid-notes">Observações</Label>
                <textarea
                  id="bid-notes"
                  rows={3}
                  placeholder="Descreva o que está incluso, prazo de execução..."
                  className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-transparent px-3 py-2 text-sm placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                  {...register('notes')}
                />
              </div>
              <Button type="submit" loading={submittingBid} className="w-full">
                <Send className="h-4 w-4" /> Enviar Orçamento
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
