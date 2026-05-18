'use client';

import type * as React from 'react';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Briefcase, CheckCircle2, Clock, FileText, MapPin, Send, ShieldCheck } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceChat } from '@/components/services/service-chat';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { bidsApi, providerApi, type ServiceBid } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

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

const BID_STATUS_LABEL: Record<ServiceBid['status'], string> = {
  accepted: 'Aceita',
  pending: 'Em análise',
  rejected: 'Recusada',
};

function DetailItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface p-3">
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">{label}</dt>
      <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium text-hl-text">
        {icon}
        <span className="min-w-0 truncate">{value}</span>
      </dd>
    </div>
  );
}

export default function ProviderOpportunityDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const router = useRouter();
  const [submittingBid, setSubmittingBid] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(['provider-opportunity', serviceId], () =>
    providerApi.getOpportunity(serviceId)
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BidForm>({
    resolver: zodResolver(bidSchema),
  });

  const order = data?.order;
  const myBids = data?.my_bids ?? [];
  const hasPendingBid = myBids.some((bid: ServiceBid) => bid.status === 'pending');

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

  if (isLoading && !order) {
    return (
      <div className="min-h-full space-y-5 bg-hl-bg px-4 py-4 text-hl-text sm:px-5 sm:py-5">
        <PageHeader
          density="editorial"
          eyebrow="Rede homologada"
          title="Analise da operacao"
          description="Carregando os dados da solicitação elegível."
          actions={
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <PageSection tone="surface" density="editorial" className="border border-hl-border bg-hl-surface shadow-hl-subtle">
          <div className="space-y-3">
            <div className="hl-skeleton h-28 rounded-[var(--hl-radius-card)]" />
            <div className="hl-skeleton h-44 rounded-[var(--hl-radius-card)]" />
          </div>
        </PageSection>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-full space-y-5 bg-hl-bg px-4 py-4 text-hl-text sm:px-5 sm:py-5">
        <PageHeader
          density="editorial"
          eyebrow="Rede homologada"
          title="Oportunidade indisponivel"
          description="Não foi possível carregar esta solicitação da rede homologada."
          actions={
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Solicitação não encontrada"
          description="A operacao pode ter sido encerrada, atribuida ou removida da sua fila elegivel."
          tone="strong"
        />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-5 bg-hl-bg px-4 py-4 text-hl-text sm:px-5 sm:py-5">
      <PageHeader
        density="compact"
        eyebrow="Oportunidade"
        title={order.title}
        actions={
          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <PageSection
            tone="surface"
            density="editorial"
            className="border border-hl-border bg-hl-surface shadow-hl-subtle"
            actions={
              <div className="flex flex-wrap gap-2">
                <Badge variant={PRIORITY_VARIANT[order.priority]}>{SERVICE_PRIORITY_LABELS[order.priority]}</Badge>
                <Badge variant="outline">Rede homologada</Badge>
              </div>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Sistema" value={SYSTEM_TYPE_LABELS[order.system_type]} />
              <DetailItem
                icon={<Clock className="h-3.5 w-3.5 shrink-0 text-hl-text-muted" />}
                label="Criada em"
                value={formatDate(order.created_at)}
              />
              <DetailItem
                icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-hl-text-muted" />}
                label="Imovel"
                value={order.property_name}
              />
              <DetailItem label="Ambiente" value={order.room_name ?? 'Não informado'} />
            </dl>

            {order.description ? (
              <div className="rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface p-4">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">
                  <FileText className="h-3.5 w-3.5" />
                  Descricao tecnica
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-hl-text-muted">{order.description}</p>
              </div>
            ) : (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="Sem descricao complementar"
                description="Use o chat da operacao privada para alinhar duvidas de escopo antes de assumir qualquer compromisso."
                tone="subtle"
                density="compact"
              />
            )}
          </PageSection>

          <PageSection density="compact" className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
            <ServiceChat serviceOrderId={serviceId} title="Chat da operacao privada" />
          </PageSection>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <PageSection
            title={hasPendingBid ? 'Proposta em análise' : 'Enviar proposta'}
            tone="surface"
            density="editorial"
            className="border border-hl-border bg-hl-surface shadow-hl-subtle"
          >
            {hasPendingBid ? (
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title="Proposta em análise"
                description="Aguarde o retorno antes de enviar uma nova proposta para esta solicitação."
                tone="strong"
                density="compact"
              />
            ) : (
              <form onSubmit={handleSubmit(onBidSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="bid-amount">Valor da proposta (R$) *</Label>
                  <Input
                    id="bid-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    aria-invalid={Boolean(errors.amount)}
                    {...register('amount')}
                  />
                  {errors.amount && <p className="text-xs text-hl-danger">{errors.amount.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bid-notes">Observacoes tecnicas</Label>
                  <Textarea
                    id="bid-notes"
                    rows={4}
                    placeholder="Escopo, prazo, condicoes e evidencias relevantes..."
                    aria-invalid={Boolean(errors.notes)}
                    {...register('notes')}
                  />
                  {errors.notes && <p className="text-xs text-hl-danger">{errors.notes.message}</p>}
                </div>
                <Button type="submit" loading={submittingBid} className="w-full">
                  <Send className="h-4 w-4" />
                  Enviar proposta
                </Button>
              </form>
            )}
          </PageSection>

          <PageSection
            title="Histórico de propostas"
            tone="surface"
            density="editorial"
            className="border border-hl-border bg-hl-surface shadow-hl-subtle"
          >
            {myBids.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Nenhuma proposta enviada"
                description="Quando uma proposta for registrada, ela aparecerá aqui com o status de avaliação."
                tone="subtle"
                density="compact"
              />
            ) : (
              <div className="space-y-3">
                {myBids.map((bid: ServiceBid) => (
                  <article key={bid.id} className="rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-medium text-hl-text">{formatCurrency(bid.amount)}</p>
                        <p className="mt-1 text-xs text-hl-text-muted">{formatDate(bid.created_at)}</p>
                      </div>
                      <StatusBadge status={bid.status} label={BID_STATUS_LABEL[bid.status]} className="shrink-0" />
                    </div>
                    {bid.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-hl-text-muted">{bid.notes}</p>}
                  </article>
                ))}
              </div>
            )}
          </PageSection>
        </aside>
      </div>
    </div>
  );
}
