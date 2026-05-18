'use client';

import type * as React from 'react';
import { use, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Calendar, Camera, CheckCircle2, Clock,
  FileText, ImageIcon, ListChecks, MapPin, Send, ShieldCheck, XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceChat } from '@/components/services/service-chat';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { OfflineSyncStatus } from '@/components/offline-sync-status';
import { bidsApi, normalizeMediaUrl, providerApi, type ServiceBid } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { enqueue, OFFLINE_QUEUE_MAX_BLOB_BYTES } from '@/lib/offline-queue';
import { useOfflineQueueSync } from '@/lib/use-offline-queue-sync';
import { useOfflineSync } from '@/lib/use-offline-sync';
import {
  SERVICE_PRIORITY_LABELS,
  SERVICE_STATUS_LABELS,
  SYSTEM_TYPE_LABELS,
  cn,
  formatCurrency,
  formatDate,
} from '@/lib/utils';
import { toast } from 'sonner';

const bidSchema = z.object({
  amount: z.coerce.number().positive('Valor deve ser positivo'),
  notes: z.string().max(500).optional(),
});

type BidForm = z.infer<typeof bidSchema>;

const BID_STATUS_LABEL: Record<ServiceBid['status'], string> = {
  accepted: 'Aceita',
  pending: 'Em análise',
  rejected: 'Recusada',
};

const BID_STATUS_ICON: Record<ServiceBid['status'], React.ReactNode> = {
  accepted: <CheckCircle2 className="h-4 w-4 text-hl-success" />,
  pending: <Clock className="h-4 w-4 text-hl-warning" />,
  rejected: <XCircle className="h-4 w-4 text-hl-danger" />,
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

function safeParseChecklist(value: unknown): { item: string; done: boolean }[] {
  if (Array.isArray(value)) {
    return value
      .filter((i): i is { item: unknown; done: unknown } => typeof i === 'object' && i !== null)
      .map((i) => ({ item: String(i.item ?? ''), done: Boolean(i.done) }));
  }
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is { item: unknown; done: unknown } => typeof i === 'object' && i !== null)
      .map((i) => ({ item: String(i.item ?? ''), done: Boolean(i.done) }));
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
    <div className={wide ? 'rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface p-3 sm:col-span-2' : 'rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface p-3'}>
      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">{label}</dt>
      <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium text-hl-text">
        {icon}
        <span className="min-w-0 truncate">{value}</span>
      </dd>
    </div>
  );
}

const UPLOAD_ALLOWED_STATUSES = ['approved', 'in_progress'] as const;

export default function ProviderServiceDetailPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [submittingBid, setSubmittingBid] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const tenantId = user?.active_tenant_id ?? user?.activeTenantId ?? null;
  const userId = user?.id ?? null;

  const offlineSyncState = useOfflineSync();
  const offlineQueueSyncState = useOfflineQueueSync(tenantId, userId);

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

  const checklist = safeParseChecklist(order?.checklist);
  const completedChecklistItems = checklist.filter((i) => i.done).length;

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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!order || !tenantId || !userId) return;
    const file = e.target.files?.[0];
    if (!e.target) return;
    e.target.value = '';
    if (!file) return;
    if (file.size > OFFLINE_QUEUE_MAX_BLOB_BYTES) {
      toast.error('Arquivo muito grande', { description: 'Tamanho máximo: 5 MB.' });
      return;
    }
    setUploadingPhoto(true);
    try {
      if (navigator.onLine) {
        await providerApi.uploadEvidence(serviceId, file);
        await mutate();
        toast.success('Evidencia enviada');
        return;
      }

      await enqueue({
        type: 'photo-upload',
        tenantId,
        userId,
        propertyId: order.property_id,
        serviceOrderId: serviceId,
        evidenceType: 'after',
        filename: file.name,
        mimeType: file.type,
        file,
        useProviderRoute: true,
      });
      toast.info('Sem conexao - evidencia salva para envio automatico quando voltar online');
    } catch (err) {
      if (err instanceof TypeError) {
        try {
          await enqueue({
            type: 'photo-upload',
            tenantId,
            userId,
            propertyId: order.property_id,
            serviceOrderId: serviceId,
            evidenceType: 'after',
            filename: file.name,
            mimeType: file.type,
            file,
            useProviderRoute: true,
          });
          toast.info('Sem conexao - evidencia salva para envio automatico quando voltar online');
          return;
        } catch (queueErr) {
          toast.error('Erro ao salvar evidencia offline', { description: (queueErr as Error).message });
          return;
        }
      }
      toast.error('Erro ao enviar evidencia', { description: (err as Error).message });
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (isLoading && !order) {
    return (
      <div className="min-h-full space-y-5 bg-hl-bg px-4 py-4 text-hl-text sm:px-5 sm:py-5">
        <header className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4 shadow-hl-subtle">
          <p className="text-xs font-medium uppercase tracking-wide text-hl-primary">Operacao privada</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-medium leading-tight text-hl-text">Carregando servico</h1>
              <p className="mt-1 max-w-sm text-sm leading-5 text-hl-text-muted">
                Preparando o dossie operacional da ordem de servico.
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </header>
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
        <header className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-4 py-4 shadow-hl-subtle">
          <p className="text-xs font-medium uppercase tracking-wide text-hl-primary">Operacao privada</p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-medium leading-tight text-hl-text">Servico indisponivel</h1>
              <p className="mt-1 max-w-sm text-sm leading-5 text-hl-text-muted">
                Nao foi possivel carregar esta ordem de servico.
              </p>
            </div>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
        </header>
        <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface px-5 py-8 shadow-hl-subtle">
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Ordem de servico nao encontrada"
            description="A operacao pode ter sido encerrada, removida ou nao estar mais disponivel para o seu perfil."
            tone="subtle"
          />
        </div>
      </div>
    );
  }

  const beforePhotos = safeParseStringArray(order.before_photos);
  const afterPhotos = safeParseStringArray(order.after_photos);
  const canUpload = order.can_upload_evidence === true
    || (order.can_upload_evidence === undefined && (UPLOAD_ALLOWED_STATUSES as readonly string[]).includes(order.status));

  return (
    <div className="min-h-full space-y-5 bg-hl-bg px-4 py-4 text-hl-text sm:px-5 sm:py-5">
      <PageHeader
        density="compact"
        eyebrow="Operação privada"
        title={order.title}
        actions={
          <div className="flex items-center gap-2">
            <OfflineSyncStatus state={offlineSyncState} queueState={offlineQueueSyncState} />
            <Button type="button" variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
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
                <StatusBadge status={order.status} label={SERVICE_STATUS_LABELS[order.status]} />
                <Badge variant="outline">{SERVICE_PRIORITY_LABELS[order.priority]}</Badge>
              </div>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Sistema" value={SYSTEM_TYPE_LABELS[order.system_type]} />
              <DetailItem
                icon={<Calendar className="h-3.5 w-3.5 shrink-0 text-hl-text-muted" />}
                label="Criada em"
                value={formatDate(order.created_at)}
              />
              <DetailItem
                icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-hl-text-muted" />}
                label="Imovel"
                value={`${order.property_name} - ${order.property_address}`}
                wide
              />
              {order.scheduled_at && (
                <DetailItem
                  icon={<Clock className="h-3.5 w-3.5 shrink-0 text-hl-text-muted" />}
                  label="Agendada para"
                  value={formatDate(order.scheduled_at)}
                />
              )}
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
                description="Use o chat privado para alinhar escopo, evidencias e proximos passos."
                tone="subtle"
                density="compact"
              />
            )}
          </PageSection>

          {checklist.length > 0 && (
            <PageSection
              title="Checklist de execução"
              tone="surface"
              density="editorial"
              className="border border-hl-border bg-hl-surface shadow-hl-subtle"
              actions={
                <span className="flex items-center gap-1.5 text-xs text-hl-text-muted">
                  <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
                  {completedChecklistItems}/{checklist.length} concluídos
                </span>
              }
            >
              <ul role="list" aria-label="Itens do checklist" className="space-y-1">
                {checklist.map((checkItem, index) => (
                  <li
                    key={`${checkItem.item}-${index}`}
                    className="flex items-center gap-3 rounded-[var(--hl-radius-control)] border border-hl-border bg-hl-surface px-3 py-2 text-sm"
                  >
                    <CheckCircle2
                      className={cn('h-4 w-4 shrink-0', checkItem.done ? 'text-hl-success' : 'text-hl-text-muted')}
                      aria-hidden="true"
                    />
                    <span className={checkItem.done ? 'line-through text-hl-text-muted' : 'text-hl-text'}>
                      {checkItem.item}
                    </span>
                    {checkItem.done && <span className="sr-only">concluído</span>}
                  </li>
                ))}
              </ul>
            </PageSection>
          )}

          <PageSection
            title="Evidências"
            tone="surface"
            density="editorial"
            className="border border-hl-border bg-hl-surface shadow-hl-subtle"
            actions={
              canUpload ? (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    aria-label="Selecionar evidência de execução"
                    onChange={(e) => void handlePhotoUpload(e)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={uploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Enviar evidência
                  </Button>
                </>
              ) : undefined
            }
          >
            {beforePhotos.length > 0 && (
              <>
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Antes</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {beforePhotos.map((url, index) => (
                    <button
                      key={url}
                      type="button"
                      aria-label={`Ver evidência inicial ${index + 1}`}
                      className="aspect-square w-full overflow-hidden rounded-[var(--hl-radius-control)] bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-focus"
                      onClick={() => window.open(url, '_blank')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover transition-opacity hover:opacity-90"
                      />
                    </button>
                  ))}
                </div>
              </>
            )}

            {afterPhotos.length > 0 && (
              <>
                <p className={cn('text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted', beforePhotos.length > 0 && 'mt-3')}>
                  Após execução
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {afterPhotos.map((url, index) => (
                    <button
                      key={url}
                      type="button"
                      aria-label={`Ver evidência de execução ${index + 1}`}
                      className="aspect-square w-full overflow-hidden rounded-[var(--hl-radius-control)] bg-hl-surface-muted focus-visible:outline-none focus-visible:shadow-focus"
                      onClick={() => window.open(url, '_blank')}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover transition-opacity hover:opacity-90"
                      />
                    </button>
                  ))}
                </div>
              </>
            )}

            {beforePhotos.length === 0 && afterPhotos.length === 0 && (
              <EmptyState
                icon={<ImageIcon className="h-5 w-5" />}
                title="Sem evidências registradas"
                description="Evidências serão exibidas quando registradas pela operação."
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
            title={isDirectExecution ? 'Execução direta' : hasPendingBid ? 'Proposta em análise' : 'Enviar proposta'}
            tone="surface"
            density="editorial"
            className="border border-hl-border bg-hl-surface shadow-hl-subtle"
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
                title="Proposta em análise"
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
                icon={<ImageIcon className="h-6 w-6" />}
                title="Nenhuma proposta registrada"
                description="Quando uma proposta for enviada, ela aparecerá aqui com o status de avaliação."
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
                        {bid.notes && <p className="mt-1 line-clamp-2 text-xs leading-5 text-hl-text-muted">{bid.notes}</p>}
                        <p className="mt-1 text-xs text-hl-text-muted">{formatDate(bid.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {BID_STATUS_ICON[bid.status]}
                        <StatusBadge status={bid.status} label={BID_STATUS_LABEL[bid.status]} />
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
