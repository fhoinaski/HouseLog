'use client';

import type * as React from 'react';
import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Calendar, CheckCircle2, Clock, FileText, ImageIcon, MapPin, Send, ShieldCheck, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceChat } from '@/components/services/service-chat';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { bidsApi, normalizeMediaUrl, providerApi, type ServiceBid } from '@/lib/api';
import {
  SERVICE_PRIORITY_LABELS,
  SERVICE_STATUS_LABELS,
  SYSTEM_TYPE_LABELS,
  formatCurrency,
  formatDate,
} from '@/lib/utils';
import { toast } from 'sonner';

const bidSchema = z.object({
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  notes: z.string().max(500).optional(),
});

type BidForm = z.infer<typeof bidSchema>;

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  requested: 'requested',
  approved: 'approved',
  in_progress: 'in_progress',
  completed: 'completed',
  verified: 'verified',
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

const BID_STATUS_ICON: Record<ServiceBid['status'], React.ReactNode> = {
  accepted: <CheckCircle2 className="h-4 w-4 text-text-success" />,
  pending: <Clock className="h-4 w-4 text-text-warning" />,
  rejected: <XCircle className="h-4 w-4 text-text-danger" />,
};

function safeParseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map(normalizeMediaUrl)
      .filter(Boolean);
  }
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
        .filter((item): item is string => typeof item === 'string')
        .map(normalizeMediaUrl)
        .filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

function DetailItem({
  icon,
  label,
  value,
  wide = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3 sm:col-span-2' : 'rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3'}>
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</dt>
      <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary">
        {icon}
        <span className="min-w-0 truncate">{value}</span>
      </dd>
    </div>
  );
}

export default function ProviderServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const router = useRouter();
  const [submittingBid, setSubmittingBid] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(['provider-service', serviceId], () =>
    providerApi.getService(serviceId)
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
  const isDirectExecution = Boolean(order?.assigned_to);

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
          eyebrow="Operacao privada"
          title="Carregando servico"
          description="Preparando o dossie operacional da ordem de servico."
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
          eyebrow="Operacao privada"
          title="Servico indisponivel"
          description="Nao foi possivel carregar esta ordem de servico."
          actions={
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          }
        />
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title="Ordem de servico nao encontrada"
          description="A operacao pode ter sido encerrada, removida ou nao estar mais disponivel para o seu perfil."
          tone="strong"
        />
      </div>
    );
  }

  const beforePhotos = safeParseStringArray(order.before_photos);

  return (
    <div className="space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="editorial"
        eyebrow="Operacao privada"
        title={order.title}
        description="Acompanhamento tecnico da ordem de servico vinculada a um imovel sob gestao HouseLog."
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
            title="Dossie operacional"
            description="Dados essenciais para executar, alinhar escopo e manter rastreabilidade da operacao."
            tone="strong"
            density="editorial"
            actions={
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_VARIANT[order.status]}>{SERVICE_STATUS_LABELS[order.status]}</Badge>
                <Badge variant="outline">{SERVICE_PRIORITY_LABELS[order.priority]}</Badge>
              </div>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Sistema" value={SYSTEM_TYPE_LABELS[order.system_type]} />
              <DetailItem
                icon={<Calendar className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
                label="Criada em"
                value={formatDate(order.created_at)}
              />
              <DetailItem
                icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
                label="Imovel"
                value={`${order.property_name} - ${order.property_address}`}
                wide
              />
              {order.scheduled_at && (
                <DetailItem
                  icon={<Clock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
                  label="Agendada para"
                  value={formatDate(order.scheduled_at)}
                />
              )}
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
                description="Use o chat privado para alinhar escopo, evidencias e proximos passos."
                tone="subtle"
                density="compact"
              />
            )}
          </PageSection>

          {beforePhotos.length > 0 && (
            <PageSection
              title="Evidencias iniciais"
              description="Registros visuais anexados antes da execucao."
              tone="surface"
              density="editorial"
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {beforePhotos.map((url, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`Evidencia ${index + 1}`}
                    className="aspect-square w-full cursor-pointer rounded-[var(--radius-lg)] bg-[var(--surface-strong)] object-cover transition-opacity hover:opacity-90"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            </PageSection>
          )}

          <PageSection density="compact">
            <ServiceChat serviceOrderId={serviceId} title="Chat da operacao privada" />
          </PageSection>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <PageSection
            title={isDirectExecution ? 'Execucao homologada' : 'Proposta tecnica'}
            description={
              isDirectExecution
                ? 'Esta ordem foi atribuida diretamente para execucao dentro da operacao privada.'
                : 'Registre uma proposta objetiva para avaliacao do owner ou gestor responsavel.'
            }
            tone="surface"
            density="editorial"
          >
            {isDirectExecution ? (
              <EmptyState
                icon={<ShieldCheck className="h-6 w-6" />}
                title="Execucao direta ativa"
                description="Nao e necessario enviar proposta para esta ordem de servico."
                tone="strong"
                density="compact"
              />
            ) : hasPendingBid ? (
              <EmptyState
                icon={<Clock className="h-6 w-6" />}
                title="Proposta em analise"
                description="Aguarde o retorno da operacao privada antes de registrar nova proposta."
                tone="strong"
                density="compact"
              />
            ) : order.status === 'verified' ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Operacao verificada"
                description="Esta ordem ja foi verificada e nao aceita novas propostas."
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
                icon={<ImageIcon className="h-6 w-6" />}
                title="Nenhuma proposta registrada"
                description="Quando uma proposta for enviada, ela aparecera aqui com o status de avaliacao."
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
                        {bid.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{bid.notes}</p>}
                        <p className="mt-1 text-xs text-text-tertiary">{formatDate(bid.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {BID_STATUS_ICON[bid.status]}
                        <Badge variant={BID_STATUS_VARIANT[bid.status]} className="text-xs">
                          {BID_STATUS_LABEL[bid.status]}
                        </Badge>
                      </div>
                    </div>
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
