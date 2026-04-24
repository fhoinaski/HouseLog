'use client';

import type * as React from 'react';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Briefcase, CheckCircle2, Clock, FileText, MapPin, Send, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceChat } from '@/components/services/service-chat';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  pending: 'Em analise',
  rejected: 'Recusada',
};

const BID_STATUS_VARIANT: Record<ServiceBid['status'], BadgeProps['variant']> = {
  accepted: 'success',
  pending: 'secondary',
  rejected: 'destructive',
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
    <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3">
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</dt>
      <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary">
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
      <div className="space-y-6 px-4 py-4 sm:px-5 sm:py-5">
        <PageHeader
          density="editorial"
          eyebrow="Rede homologada"
          title="Analise da operacao"
          description="Carregando os dados da solicitacao elegivel."
          actions={
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <PageSection tone="strong" density="editorial">
          <div className="space-y-3">
            <div className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
            <div className="hl-skeleton h-44 rounded-[var(--radius-xl)]" />
          </div>
        </PageSection>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6 px-4 py-4 sm:px-5 sm:py-5">
        <PageHeader
          density="editorial"
          eyebrow="Rede homologada"
          title="Oportunidade indisponivel"
          description="Nao foi possivel carregar esta solicitacao da rede homologada."
          actions={
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Solicitacao nao encontrada"
          description="A operacao pode ter sido encerrada, atribuida ou removida da sua fila elegivel."
          tone="strong"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="editorial"
        eyebrow="Rede homologada"
        title={order.title}
        description="Analise tecnica de uma solicitacao elegivel dentro da operacao privada HouseLog."
        actions={
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <PageSection
            title="Dossie da operacao"
            description="Dados essenciais para validar escopo, prioridade e aderencia antes de enviar proposta."
            tone="strong"
            density="editorial"
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
                icon={<Clock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
                label="Criada em"
                value={formatDate(order.created_at)}
              />
              <DetailItem
                icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
                label="Imovel"
                value={order.property_name}
              />
              <DetailItem label="Ambiente" value={order.room_name ?? 'Nao informado'} />
            </dl>

            {order.description ? (
              <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
                  <FileText className="h-3.5 w-3.5" />
                  Descricao tecnica
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{order.description}</p>
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

          <PageSection density="compact">
            <ServiceChat serviceOrderId={serviceId} title="Chat da operacao privada" />
          </PageSection>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <PageSection
            title="Proposta homologada"
            description={
              hasPendingBid
                ? 'Sua proposta esta em analise pela operacao privada.'
                : 'Envie uma proposta objetiva para avaliacao do owner ou gestor responsavel.'
            }
            tone="surface"
            density="editorial"
          >
            {hasPendingBid ? (
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title="Proposta em analise"
                description="Aguarde o retorno antes de enviar uma nova proposta para esta solicitacao."
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
                  {errors.amount && <p className="text-xs text-text-danger">{errors.amount.message}</p>}
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
                  {errors.notes && <p className="text-xs text-text-danger">{errors.notes.message}</p>}
                </div>
                <Button type="submit" loading={submittingBid} className="w-full">
                  <Send className="h-4 w-4" />
                  Enviar proposta
                </Button>
              </form>
            )}
          </PageSection>

          <PageSection
            title="Historico de propostas"
            description="Registro das propostas enviadas por voce para esta operacao."
            tone="strong"
            density="editorial"
          >
            {myBids.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Nenhuma proposta enviada"
                description="Quando uma proposta for registrada, ela aparecera aqui com o status de avaliacao."
                tone="subtle"
                density="compact"
              />
            ) : (
              <div className="space-y-3">
                {myBids.map((bid: ServiceBid) => (
                  <article key={bid.id} className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-medium text-text-primary">{formatCurrency(bid.amount)}</p>
                        <p className="mt-1 text-xs text-text-tertiary">{formatDate(bid.created_at)}</p>
                      </div>
                      <Badge variant={BID_STATUS_VARIANT[bid.status]} className="shrink-0 text-xs">
                        {BID_STATUS_LABEL[bid.status]}
                      </Badge>
                    </div>
                    {bid.notes && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{bid.notes}</p>}
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
