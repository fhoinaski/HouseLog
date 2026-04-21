'use client';

import type * as React from 'react';
import { use, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle2,
  Copy,
  DollarSign,
  Download,
  FileText,
  KeyRound,
  MapPin,
  Send,
  Share2,
  ShieldCheck,
  User,
  Video,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { ServiceOrderPDF } from '@/components/pdf/ServiceOrderPDF';
import { ServiceChat } from '@/components/services/service-chat';
import { BeforeAfterSlider } from '@/components/ui/before-after-slider';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeMediaUrl, propertiesApi, servicesApi, shareApi } from '@/lib/api';
import { SERVICE_PRIORITY_LABELS, SERVICE_STATUS_LABELS, SYSTEM_TYPE_LABELS, cn, formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((module) => module.PDFDownloadLink),
  {
    ssr: false,
    loading: () => (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-3.5 w-3.5" />
        PDF
      </Button>
    ),
  }
);

const STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['approved'],
  approved: ['in_progress'],
  in_progress: ['completed'],
  completed: ['verified', 'in_progress'],
  verified: [],
};

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  requested: 'requested',
  approved: 'approved',
  in_progress: 'in_progress',
  completed: 'completed',
  verified: 'verified',
};

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent',
  normal: 'normal',
  preventive: 'preventive',
};

const labelClass = 'text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary';

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
      .filter((item): item is { item: unknown; done: unknown } => typeof item === 'object' && item !== null)
      .map((item) => ({ item: String(item.item ?? ''), done: Boolean(item.done) }));
  }
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is { item: unknown; done: unknown } => typeof item === 'object' && item !== null)
      .map((item) => ({ item: String(item.item ?? ''), done: Boolean(item.done) }));
  } catch {
    return [];
  }
}

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
      <dt className={labelClass}>{label}</dt>
      <dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary">
        {icon}
        <span className="min-w-0 truncate">{value}</span>
      </dd>
    </div>
  );
}

function PhotoGrid({ title, photos }: { title: string; photos: string[] }) {
  if (photos.length === 0) return null;

  return (
    <div>
      <p className={cn('mb-2', labelClass)}>{title}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((url, index) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${url}-${index}`}
            src={url}
            alt={`${title} ${index + 1}`}
            className="aspect-square w-full cursor-pointer rounded-[var(--radius-lg)] bg-[var(--surface-strong)] object-cover transition-opacity hover:opacity-90"
            onClick={() => window.open(url, '_blank')}
          />
        ))}
      </div>
    </div>
  );
}

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; serviceId: string }>;
}) {
  const { id: propertyId, serviceId } = use(params);
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [photoType, setPhotoType] = useState<'before' | 'after'>('before');
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditLink, setAuditLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [generatingShare, setGeneratingShare] = useState(false);
  const [shareIncludeCreds, setShareIncludeCreds] = useState(false);
  const [shareProviderName, setShareProviderName] = useState('');
  const [shareProviderEmail, setShareProviderEmail] = useState('');
  const [checklist, setChecklist] = useState<{ item: string; done: boolean }[]>([]);

  const { data, mutate } = useSWR(['service', propertyId, serviceId], () =>
    servicesApi.get(propertyId, serviceId)
  );

  const { data: propData } = useSWR(['property', propertyId], () => propertiesApi.get(propertyId));
  const property = propData?.property;
  const order = data?.order;

  useEffect(() => {
    if (!order) {
      setChecklist([]);
      return;
    }
    setChecklist(safeParseChecklist(order.checklist));
  }, [order]);

  async function advanceStatus(next: string) {
    try {
      await servicesApi.updateStatus(propertyId, serviceId, next);
      await mutate();
      void globalMutate(['dashboard', propertyId]);
      toast.success(`Status: ${SERVICE_STATUS_LABELS[next]}`);
    } catch (e) {
      toast.error('Erro ao atualizar status', { description: (e as Error).message });
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    setUploadingMedia(true);
    try {
      await servicesApi.uploadPhoto(propertyId, serviceId, file, photoType);
      await mutate();
      toast.success(`Foto "${photoType === 'before' ? 'antes' : 'depois'}" enviada`);
    } catch (e) {
      toast.error('Erro no upload', { description: (e as Error).message });
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    setUploadingMedia(true);
    try {
      await servicesApi.uploadVideo(propertyId, serviceId, file);
      await mutate();
      toast.success('Video enviado');
    } catch (e) {
      toast.error('Erro no upload', { description: (e as Error).message });
    } finally {
      setUploadingMedia(false);
      e.target.value = '';
    }
  }

  async function generateAuditLink() {
    setGeneratingLink(true);
    try {
      const res = await servicesApi.createAuditLink(propertyId, serviceId, {
        scope: { canUploadPhotos: true, canUploadVideo: false },
        expires_in_hours: 48,
      });
      setAuditLink({ url: res.url, expires_at: res.expires_at });
    } catch (e) {
      toast.error('Erro ao gerar link', { description: (e as Error).message });
    } finally {
      setGeneratingLink(false);
    }
  }

  async function copyAuditLink() {
    if (!auditLink) return;
    await navigator.clipboard.writeText(auditLink.url);
    toast.success('Link copiado');
  }

  async function generateShareLink() {
    setGeneratingShare(true);
    try {
      const res = await shareApi.createLink(propertyId, serviceId, {
        share_credentials: shareIncludeCreds,
        provider_name: shareProviderName || undefined,
        provider_email: shareProviderEmail || undefined,
      });
      setShareLink({ url: res.url, expires_at: res.expires_at });
    } catch (e) {
      toast.error('Erro ao gerar link', { description: (e as Error).message });
    } finally {
      setGeneratingShare(false);
    }
  }

  async function copyShareLink() {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink.url);
    toast.success('Link copiado');
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 safe-bottom">
        <PageHeader
          density="editorial"
          eyebrow="Ordem de servico"
          title="Carregando OS"
          description="Preparando o dossie operacional e a trilha tecnica da ordem."
        />
        <PageSection tone="strong" density="editorial">
          <div className="hl-skeleton h-36 rounded-[var(--radius-xl)]" />
          <div className="hl-skeleton h-56 rounded-[var(--radius-xl)]" />
        </PageSection>
      </div>
    );
  }

  const beforePhotos = safeParseStringArray(order.before_photos);
  const afterPhotos = safeParseStringArray(order.after_photos);
  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? [];
  const completedChecklistItems = checklist.filter((item) => item.done).length;
  const checklistProgress = checklist.length ? (completedChecklistItems / checklist.length) * 100 : 0;

  async function toggleChecklistItem(index: number) {
    const updated = checklist.map((item, itemIndex) =>
      itemIndex === index ? { ...item, done: !item.done } : item
    );
    setChecklist(updated);
    try {
      await servicesApi.patchChecklist(propertyId, serviceId, updated);
    } catch {
      setChecklist(checklist);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 safe-bottom">
      <PageHeader
        density="editorial"
        eyebrow="Ordem de servico"
        title={order.title}
        description="Dossie operacional com escopo, evidencias, historico e comunicacao privada."
        actions={
          <>
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
              <Send className="h-3.5 w-3.5" />
              Enviar
            </Button>
            {property && (
              <PDFDownloadLink
                document={<ServiceOrderPDF order={order} propertyName={property.name} />}
                fileName={`os-${order.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="outline" size="sm" disabled={loading}>
                    <Download className="h-3.5 w-3.5" />
                    {loading ? '...' : 'PDF'}
                  </Button>
                )}
              </PDFDownloadLink>
            )}
          </>
        }
      />

      <PageSection
        title="Dossie tecnico"
        description="Dados essenciais para aprovar, executar e verificar a ordem dentro do prontuario do imovel."
        tone="strong"
        density="editorial"
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={STATUS_VARIANT[order.status]}>{SERVICE_STATUS_LABELS[order.status]}</Badge>
            <Badge variant={PRIORITY_VARIANT[order.priority]}>{SERVICE_PRIORITY_LABELS[order.priority]}</Badge>
            {order.priority === 'urgent' && <AlertTriangle className="h-4 w-4 text-text-danger" />}
          </div>
        }
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Sistema" value={SYSTEM_TYPE_LABELS[order.system_type]} />
          {order.room_name && (
            <DetailItem
              icon={<MapPin className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
              label="Comodo"
              value={order.room_name}
            />
          )}
          <DetailItem
            icon={<User className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
            label="Solicitado por"
            value={order.requested_by_name}
          />
          {order.assigned_to_name && <DetailItem label="Atribuido a" value={order.assigned_to_name} />}
          <DetailItem
            icon={<Calendar className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />}
            label="Criada em"
            value={formatDate(order.created_at)}
          />
          {order.cost && (
            <DetailItem
              icon={<DollarSign className="h-3.5 w-3.5 shrink-0 text-text-success" />}
              label="Custo"
              value={formatCurrency(order.cost)}
            />
          )}
          {order.warranty_until && (
            <DetailItem
              icon={<ShieldCheck className="h-3.5 w-3.5 shrink-0 text-text-success" />}
              label="Garantia ate"
              value={formatDate(order.warranty_until)}
            />
          )}
          {order.scheduled_at && <DetailItem label="Agendada para" value={formatDate(order.scheduled_at)} />}
        </dl>

        {order.description ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4">
            <p className={cn('flex items-center gap-2', labelClass)}>
              <FileText className="h-3.5 w-3.5" />
              Descricao
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

      {checklist.length > 0 && (
        <PageSection
          title="Checklist de execucao"
          description="Itens de controle vinculados a esta OS."
          tone="surface"
          density="editorial"
          actions={<span className="text-xs text-text-secondary">{completedChecklistItems}/{checklist.length} concluidos</span>}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-subtle">
            <div
              className="h-full rounded-full bg-text-success transition-all duration-300"
              style={{ width: `${checklistProgress}%` }}
            />
          </div>
          <div className="space-y-1">
            {checklist.map((item, index) => (
              <button
                key={`${item.item}-${index}`}
                onClick={() => toggleChecklistItem(index)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
              >
                <CheckCircle2
                  className={cn('h-4 w-4 shrink-0 transition-colors', item.done ? 'text-text-success' : 'text-text-tertiary')}
                />
                <span className={item.done ? 'line-through text-text-tertiary' : 'text-text-primary'}>{item.item}</span>
              </button>
            ))}
          </div>
        </PageSection>
      )}

      <PageSection
        title="Evidencias"
        description="Fotos e video associados ao antes, durante e depois da execucao."
        tone="surface"
        density="editorial"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              loading={uploadingMedia}
              onClick={() => {
                setPhotoType('before');
                photoRef.current?.click();
              }}
            >
              <Camera className="h-3.5 w-3.5" />
              Antes
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={uploadingMedia}
              onClick={() => {
                setPhotoType('after');
                photoRef.current?.click();
              }}
            >
              <Camera className="h-3.5 w-3.5" />
              Depois
            </Button>
          </div>
        }
      >
        {beforePhotos.length === 0 && afterPhotos.length === 0 && !order.video_url ? (
          <EmptyState
            icon={<Camera className="h-5 w-5" />}
            title="Nenhuma evidencia enviada"
            description="Anexe fotos de antes e depois para qualificar a trilha tecnica."
            tone="subtle"
            density="compact"
          />
        ) : (
          <div className="space-y-4">
            <PhotoGrid title="Antes" photos={beforePhotos} />
            <PhotoGrid title="Depois" photos={afterPhotos} />
            {order.video_url && (
              <a
                href={normalizeMediaUrl(order.video_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--surface-base)] px-3 py-2 text-sm text-text-accent transition-colors hover:bg-[var(--field-bg-hover)]"
              >
                <Video className="h-4 w-4" />
                Ver video
              </a>
            )}
          </div>
        )}
      </PageSection>

      {beforePhotos.length > 0 && afterPhotos.length > 0 && (
        <PageSection title="Comparacao antes / depois" description="Arraste para comparar a evolucao visual." tone="strong" density="editorial">
          <BeforeAfterSlider
            before={beforePhotos[beforePhotos.length - 1]}
            after={afterPhotos[afterPhotos.length - 1]}
            className="max-h-72"
          />
        </PageSection>
      )}

      <PageSection title="Acoes externas" description="Links temporarios para prestador, auditoria e evidencias." tone="strong" density="editorial">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" loading={uploadingMedia} onClick={() => videoRef.current?.click()}>
            <Video className="h-4 w-4" />
            Enviar video
          </Button>
          <Button variant="outline" onClick={() => setAuditDialogOpen(true)}>
            <Share2 className="h-4 w-4" />
            Link de auditoria
          </Button>
        </div>
      </PageSection>

      <ServiceChat serviceOrderId={serviceId} title="Chat da operacao privada" />

      {nextStatuses.length > 0 && (
        <PageSection title="Avanco de status" description="Atualize o trilho operacional da OS." tone="surface" density="editorial">
          <div className="flex flex-wrap gap-3">
            {nextStatuses.map((next) => (
              <Button key={next} onClick={() => advanceStatus(next)}>
                <CheckCircle2 className="h-4 w-4" />
                Mover para: {SERVICE_STATUS_LABELS[next]}
              </Button>
            ))}
          </div>
        </PageSection>
      )}

      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
      <input ref={videoRef} type="file" accept="video/mp4" className="hidden" onChange={handleVideoUpload} />

      <Dialog open={shareDialogOpen} onOpenChange={(open) => { setShareDialogOpen(open); if (!open) setShareLink(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-text-accent" />
              Enviar OS ao prestador
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-text-secondary">
            Gere um link publico para visualizacao, aceite, inicio e conclusao sem exigir conta.
          </p>
          {!shareLink ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="share-provider-name" className={labelClass}>Nome do prestador</Label>
                <Input
                  id="share-provider-name"
                  placeholder="Ex: Joao Silva - Eletrica"
                  value={shareProviderName}
                  onChange={(event) => setShareProviderName(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-provider-email" className={labelClass}>Email do prestador</Label>
                <Input
                  id="share-provider-email"
                  type="email"
                  placeholder="prestador@email.com"
                  value={shareProviderEmail}
                  onChange={(event) => setShareProviderEmail(event.target.value)}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3 transition-colors hover:bg-[var(--field-bg-hover)]">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={shareIncludeCreds}
                  onChange={(event) => setShareIncludeCreds(event.target.checked)}
                />
                <span>
                  <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                    <KeyRound className="h-3.5 w-3.5 text-text-warning" />
                    Incluir credenciais de acesso
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-text-secondary">
                    Credenciais marcadas para OS serao visiveis no link publico.
                  </span>
                </span>
              </label>
              <Button onClick={generateShareLink} loading={generatingShare} className="w-full">
                <Send className="h-4 w-4" />
                Gerar link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="break-all rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2.5 font-mono text-xs text-text-secondary">
                {shareLink.url}
              </div>
              <p className="text-xs text-text-secondary">
                Expira: {new Date(shareLink.expires_at).toLocaleString('pt-BR')}
              </p>
              <div className="flex gap-2">
                <Button onClick={copyShareLink} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4" />
                  Copiar link
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (shareProviderEmail) {
                      window.open(`mailto:${shareProviderEmail}?subject=Ordem de Servico - ${order.title}&body=Ola ${shareProviderName || ''},\n\nVoce tem uma OS para executar:\n\n${shareLink.url}\n\nAcesse o link para ver todos os detalhes.`);
                    } else {
                      void copyShareLink();
                    }
                  }}
                >
                  {shareProviderEmail ? 'Enviar email' : 'Copiar'}
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-xs" onClick={() => setShareLink(null)}>
                Gerar novo link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Link de auditoria
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-6 text-text-secondary">
            Gere um link temporario para envio de fotos e notas sem criar uma conta.
          </p>
          {!auditLink ? (
            <Button onClick={generateAuditLink} loading={generatingLink} className="w-full">
              <Share2 className="h-4 w-4" />
              Gerar link (48h)
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="break-all rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2 font-mono text-xs text-text-secondary">
                {auditLink.url}
              </div>
              <p className="text-xs text-text-secondary">Expira em: {formatDate(auditLink.expires_at)}</p>
              <Button onClick={copyAuditLink} variant="outline" className="w-full">
                <Copy className="h-4 w-4" />
                Copiar link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
