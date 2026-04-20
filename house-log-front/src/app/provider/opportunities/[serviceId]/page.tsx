'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Clock, MapPin, Send } from 'lucide-react';
import { bidsApi, providerApi, type ServiceBid } from '@/lib/api';
import { ServiceChat } from '@/components/services/service-chat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';

const bidSchema = z.object({
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  notes: z.string().max(500).optional(),
});

type BidForm = z.infer<typeof bidSchema>;

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

export default function ProviderOpportunityDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const router = useRouter();
  const [submittingBid, setSubmittingBid] = useState(false);

  const { data, mutate } = useSWR(
    ['provider-opportunity', serviceId],
    () => providerApi.getOpportunity(serviceId)
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
      toast.success('Proposta enviada com sucesso');
    } catch (e) {
      toast.error('Erro ao enviar proposta', { description: (e as Error).message });
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

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-xl font-medium">{order.title}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={PRIORITY_VARIANT[order.priority]}>{SERVICE_PRIORITY_LABELS[order.priority]}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Sistema</dt>
              <dd className="font-medium">{SYSTEM_TYPE_LABELS[order.system_type]}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Criada em</dt>
              <dd className="font-medium flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatDate(order.created_at)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground mb-0.5">Imóvel</dt>
              <dd className="font-medium flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{order.property_name}</dd>
            </div>
          </dl>
          {order.description && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm whitespace-pre-wrap">{order.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {myBids.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Minhas propostas</CardTitle></CardHeader>
          <CardContent className="p-0">
            {myBids.map((bid: ServiceBid) => (
              <div key={bid.id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-lg font-medium">{formatCurrency(bid.amount)}</p>
                  {bid.notes && <p className="text-xs text-muted-foreground">{bid.notes}</p>}
                  <p className="text-xs text-muted-foreground">{formatDate(bid.created_at)}</p>
                </div>
                <Badge variant={bid.status === 'accepted' ? 'success' : bid.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                  {bid.status === 'accepted' ? 'Aceito' : bid.status === 'rejected' ? 'Recusado' : 'Pendente'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!hasPendingBid && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" />Enviar proposta homologada</CardTitle></CardHeader>
          <CardContent className="p-5 pt-0">
            <form onSubmit={handleSubmit(onBidSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bid-amount">Valor da proposta (R$) *</Label>
                <Input id="bid-amount" type="number" step="0.01" placeholder="0.00" {...register('amount')} />
                {errors.amount && <p className="text-xs text-(--color-danger)">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bid-notes">Observações técnicas</Label>
                <textarea
                  id="bid-notes"
                  rows={3}
                  placeholder="Escopo, prazo, condições..."
                  className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-(--color-primary-border)"
                  {...register('notes')}
                />
              </div>
              <Button type="submit" loading={submittingBid} className="w-full">
                <Send className="h-4 w-4" /> Enviar proposta
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <ServiceChat serviceOrderId={serviceId} title="Chat da operação privada" />
    </div>
  );
}
