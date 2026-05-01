'use client';

import { FormEvent, use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { ArrowLeft, CheckCircle2, ClipboardList, HandCoins, Mail, Phone, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { serviceRequestsApi, type ServiceOrder, type ServiceRequestBid } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS, formatCurrency, formatDate } from '@/lib/utils';

const BID_STATUS_LABEL: Record<ServiceRequestBid['status'], string> = {
  PENDING: 'Pendente',
  ACCEPTED: 'Aceita',
  REJECTED: 'Recusada',
};

const BID_STATUS_VARIANT: Record<ServiceRequestBid['status'], BadgeProps['variant']> = {
  PENDING: 'requested',
  ACCEPTED: 'approved',
  REJECTED: 'destructive',
};

const SYSTEM_TYPES = Object.keys(SYSTEM_TYPE_LABELS) as Array<ServiceOrder['system_type']>;
const PRIORITIES = ['normal', 'urgent', 'preventive'] as const;

type ConvertForm = {
  title: string;
  systemType: ServiceOrder['system_type'];
  priority: ServiceOrder['priority'];
  description: string;
  scheduledAt: string;
  warrantyUntil: string;
};

export default function ServiceRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string; requestId: string }>;
}) {
  const { id: propertyId, requestId } = use(params);
  const router = useRouter();
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const { data, isLoading, mutate } = useSWR(['service-request', propertyId, requestId], () =>
    serviceRequestsApi.get(propertyId, requestId)
  );

  const request = data?.service_request;
  const bids = data?.bids ?? [];
  const hasAcceptedBid = bids.some((bid) => bid.status === 'ACCEPTED');
  const acceptedBid = bids.find((bid) => bid.status === 'ACCEPTED') ?? null;
  const [convertForm, setConvertForm] = useState<ConvertForm>({
    title: '',
    systemType: 'general',
    priority: 'normal',
    description: '',
    scheduledAt: '',
    warrantyUntil: '',
  });

  const preparedConvertForm = useMemo<ConvertForm>(() => ({
    title: request?.title ?? '',
    systemType: 'general',
    priority: 'normal',
    description: request?.description ?? '',
    scheduledAt: '',
    warrantyUntil: '',
  }), [request?.description, request?.title]);

  function openConvertDialog() {
    setConvertForm(preparedConvertForm);
    setConvertOpen(true);
  }

  async function acceptBid(bid: ServiceRequestBid) {
    try {
      await serviceRequestsApi.acceptBid(propertyId, requestId, bid.id);
      await mutate();
      toast.success('Proposta aceita');
    } catch (e) {
      toast.error('Erro ao aceitar proposta', { description: (e as Error).message });
    }
  }

  async function convertToService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request || !acceptedBid) return;
    setConverting(true);
    try {
      const created = await serviceRequestsApi.convertToService(propertyId, requestId, {
        title: convertForm.title.trim(),
        system_type: convertForm.systemType,
        priority: convertForm.priority,
        description: convertForm.description.trim() || undefined,
        scheduled_at: convertForm.scheduledAt || undefined,
        warranty_until: convertForm.warrantyUntil || undefined,
      });
      toast.success('Servico criado a partir do orcamento');
      router.push(`/properties/${propertyId}/services/${created.order.id}`);
    } catch (e) {
      toast.error('Erro ao converter orcamento', { description: (e as Error).message });
    } finally {
      setConverting(false);
    }
  }

  if (isLoading || !request) {
    return (
      <div className="mx-auto max-w-[1040px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <PageHeader
          density="compact"
          eyebrow="Orcamento"
          title="Carregando solicitacao"
          description="Preparando propostas recebidas para este imovel."
        />
        <PageSection tone="strong" density="default">
          <div className="hl-skeleton h-40 rounded-[var(--radius-xl)]" />
        </PageSection>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1040px] space-y-4 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="compact"
        eyebrow="Orcamento"
        title={request.title}
        description={request.description ?? 'Solicitacao enviada para prestadores e propostas recebidas.'}
        actions={
          <Button asChild variant="ghost">
            <Link href={`/properties/${propertyId}/service-requests`}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        }
      />

      <PageSection
        title="Resumo da solicitacao"
        description="Pedido de orcamento separado das ordens de servico ja aprovadas."
        tone="strong"
        density="compact"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={request.status === 'OPEN' ? 'requested' : 'completed'}>{request.status === 'OPEN' ? 'Aberta' : 'Fechada'}</Badge>
            {acceptedBid && request.status === 'OPEN' && (
              <Button onClick={openConvertDialog}>
                <Wrench className="h-4 w-4" />
                Converter em servico
              </Button>
            )}
          </div>
        }
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryItem label="Criada em" value={formatDate(request.created_at)} />
          <SummaryItem label="Atualizada em" value={formatDate(request.updated_at)} />
          <SummaryItem label="Midias" value={`${request.media_urls.length}`} />
        </div>
      </PageSection>

      <PageSection
        title="Propostas"
        description="Compare valores e escopo antes de aprovar um prestador."
        tone="surface"
        density="default"
        actions={<Badge variant="secondary">{bids.length} proposta{bids.length !== 1 ? 's' : ''}</Badge>}
      >
        {bids.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Nenhuma proposta recebida"
            description="Quando prestadores enviarem propostas para este pedido, elas aparecem aqui."
            tone="subtle"
            density="spacious"
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {bids.map((bid) => (
              <article
                key={bid.id}
                className="rounded-[var(--radius-xl)] border-half border-border-subtle bg-bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-text-primary">{bid.provider_name}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3 w-3" aria-hidden="true" />
                        {bid.provider_email}
                      </span>
                      {bid.provider_phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" aria-hidden="true" />
                          {bid.provider_phone}
                        </span>
                      )}
                    </p>
                  </div>
                  <Badge variant={BID_STATUS_VARIANT[bid.status]}>{BID_STATUS_LABEL[bid.status]}</Badge>
                </div>

                <div className="mt-4 rounded-[var(--radius-lg)] bg-bg-subtle p-3">
                  <p className="flex items-center gap-2 text-lg font-medium text-text-primary">
                    <HandCoins className="h-4 w-4 text-text-accent" aria-hidden="true" />
                    {formatCurrency(bid.amount)}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-text-secondary">{bid.scope}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                  <span className="text-xs text-text-tertiary">Recebida em {formatDate(bid.created_at)}</span>
                  <Button
                    variant={bid.status === 'ACCEPTED' ? 'tonal' : 'outline'}
                    disabled={hasAcceptedBid || bid.status !== 'PENDING'}
                    onClick={() => acceptBid(bid)}
                  >
                    {bid.status === 'ACCEPTED' ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Proposta aceita
                      </>
                    ) : (
                      'Aceitar proposta'
                    )}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </PageSection>

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Converter orcamento em servico</DialogTitle>
          </DialogHeader>
          <form onSubmit={convertToService} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="convert-title">Titulo</Label>
              <Input
                id="convert-title"
                value={convertForm.title}
                onChange={(event) => setConvertForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Sistema</Label>
                <Select
                  value={convertForm.systemType}
                  onValueChange={(value) => setConvertForm((current) => ({ ...current, systemType: value as ServiceOrder['system_type'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYSTEM_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{SYSTEM_TYPE_LABELS[type]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select
                  value={convertForm.priority}
                  onValueChange={(value) => setConvertForm((current) => ({ ...current, priority: value as ServiceOrder['priority'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>{SERVICE_PRIORITY_LABELS[priority]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="convert-description">Descricao</Label>
              <Textarea
                id="convert-description"
                value={convertForm.description}
                onChange={(event) => setConvertForm((current) => ({ ...current, description: event.target.value }))}
                rows={4}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="convert-scheduled">Agendamento</Label>
                <Input
                  id="convert-scheduled"
                  type="datetime-local"
                  value={convertForm.scheduledAt}
                  onChange={(event) => setConvertForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="convert-warranty">Garantia ate</Label>
                <Input
                  id="convert-warranty"
                  type="date"
                  value={convertForm.warrantyUntil}
                  onChange={(event) => setConvertForm((current) => ({ ...current, warrantyUntil: event.target.value }))}
                />
              </div>
            </div>

            {acceptedBid && (
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2 text-sm text-text-secondary">
                Prestador: <span className="font-medium text-text-primary">{acceptedBid.provider_name}</span> - Valor aprovado:{' '}
                <span className="font-medium text-text-primary">{formatCurrency(acceptedBid.amount)}</span>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={converting}>
                Criar servico
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}
