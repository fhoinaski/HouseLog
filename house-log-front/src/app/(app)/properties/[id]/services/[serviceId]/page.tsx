'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Camera, Video, Share2, CheckCircle2,
  AlertTriangle, MapPin, User, DollarSign, Calendar,
  ShieldCheck, Copy, Download, Send, KeyRound,
} from 'lucide-react';
import { servicesApi, propertiesApi, shareApi } from '@/lib/api';
import { ServiceOrderPDF } from '@/components/pdf/ServiceOrderPDF';
import { BeforeAfterSlider } from '@/components/ui/before-after-slider';
import { ServiceChat } from '@/components/services/service-chat';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <Button variant="outline" size="sm" disabled><Download className="h-3.5 w-3.5" />PDF</Button> }
);
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  SERVICE_STATUS_LABELS, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS,
  formatDate, formatCurrency, cn,
} from '@/lib/utils';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  requested: ['approved'],
  approved: ['in_progress'],
  in_progress: ['completed'],
  completed: ['verified', 'in_progress'],
  verified: [],
};

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  requested: 'requested', approved: 'approved', in_progress: 'in_progress',
  completed: 'completed', verified: 'verified',
};

const PRIORITY_VARIANT: Record<string, BadgeProps['variant']> = {
  urgent: 'urgent', normal: 'normal', preventive: 'preventive',
};

function safeParseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
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

  const { data, mutate } = useSWR(
    ['service', propertyId, serviceId],
    () => servicesApi.get(propertyId, serviceId)
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
      toast.success('Vídeo enviado');
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
    toast.success('Link copiado!');
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
    toast.success('Link copiado!');
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const beforePhotos = safeParseStringArray(order.before_photos);
  const afterPhotos = safeParseStringArray(order.after_photos);

  async function toggleChecklistItem(index: number) {
    const updated = checklist.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item
    );
    setChecklist(updated);
    try {
      await servicesApi.patchChecklist(propertyId, serviceId, updated);
    } catch {
      setChecklist(checklist); // revert on error
    }
  }
  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div className="max-w-3xl space-y-5 pb-20">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="truncate text-xl font-medium">{order.title}</h1>
            {order.priority === 'urgent' && <AlertTriangle className="h-4 w-4 shrink-0 text-(--color-danger)" />}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={STATUS_VARIANT[order.status]}>{SERVICE_STATUS_LABELS[order.status]}</Badge>
            <Badge variant={PRIORITY_VARIANT[order.priority]}>{SERVICE_PRIORITY_LABELS[order.priority]}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            Enviar
          </Button>
          {order && property && (
            <PDFDownloadLink
              document={<ServiceOrderPDF order={order} propertyName={property.name} />}
              fileName={`os-${order.id.slice(0,8)}-${new Date().toISOString().slice(0,10)}.pdf`}
            >
              {({ loading }) => (
                <Button variant="outline" size="sm" disabled={loading}>
                  <Download className="h-3.5 w-3.5" />
                  {loading ? '...' : 'PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* Meta */}
      <Card>
        <CardContent className="p-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="mb-0.5 text-xs text-muted-foreground">Sistema</dt>
              <dd className="font-medium">{SYSTEM_TYPE_LABELS[order.system_type]}</dd>
            </div>
            {order.room_name && (
              <div>
                <dt className="mb-0.5 text-xs text-muted-foreground">Cômodo</dt>
                <dd className="font-medium flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {order.room_name}
                </dd>
              </div>
            )}
            <div>
              <dt className="mb-0.5 text-xs text-muted-foreground">Solicitado por</dt>
              <dd className="font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {order.requested_by_name}
              </dd>
            </div>
            {order.assigned_to_name && (
              <div>
                <dt className="mb-0.5 text-xs text-muted-foreground">Atribuído a</dt>
                <dd className="font-medium">{order.assigned_to_name}</dd>
              </div>
            )}
            <div>
              <dt className="mb-0.5 text-xs text-muted-foreground">Criada em</dt>
              <dd className="font-medium flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(order.created_at)}
              </dd>
            </div>
            {order.cost && (
              <div>
                <dt className="mb-0.5 text-xs text-muted-foreground">Custo</dt>
                <dd className="font-medium flex items-center gap-1 text-(--color-success)">
                  <DollarSign className="h-3.5 w-3.5" /> {formatCurrency(order.cost)}
                </dd>
              </div>
            )}
            {order.warranty_until && (
              <div>
                <dt className="mb-0.5 text-xs text-muted-foreground">Garantia até</dt>
                <dd className="font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-(--color-success)" /> {formatDate(order.warranty_until)}
                </dd>
              </div>
            )}
            {order.scheduled_at && (
              <div>
                <dt className="mb-0.5 text-xs text-muted-foreground">Agendado</dt>
                <dd className="font-medium">{formatDate(order.scheduled_at)}</dd>
              </div>
            )}
          </dl>
          {order.description && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-1 text-xs text-muted-foreground">Descrição</p>
              <p className="text-sm whitespace-pre-wrap">{order.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Checklist — interactive */}
      {checklist.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Checklist</CardTitle>
              <span className="text-xs text-muted-foreground">
                {checklist.filter((i) => i.done).length}/{checklist.length} concluídos
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
              <div
                className="h-full rounded-full bg-(--color-success) transition-all duration-300"
                style={{ width: `${checklist.length ? (checklist.filter((i) => i.done).length / checklist.length) * 100 : 0}%` }}
              />
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0 space-y-1">
            {checklist.map((item, i) => (
              <button
                key={i}
                onClick={() => toggleChecklistItem(i)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <CheckCircle2 className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  item.done ? 'text-(--color-success)' : 'text-(--hl-text-tertiary)'
                )} />
                <span className={item.done ? 'line-through text-muted-foreground' : ''}>
                  {item.item}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Fotos</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                loading={uploadingMedia}
                onClick={() => { setPhotoType('before'); photoRef.current?.click(); }}
              >
                <Camera className="h-3.5 w-3.5" /> Antes
              </Button>
              <Button
                variant="outline" size="sm"
                loading={uploadingMedia}
                onClick={() => { setPhotoType('after'); photoRef.current?.click(); }}
              >
                <Camera className="h-3.5 w-3.5" /> Depois
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-4">
          {beforePhotos.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Antes</p>
              <div className="flex gap-2 flex-wrap">
                {beforePhotos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`antes-${i}`}
                    className="h-24 w-24 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}
          {afterPhotos.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Depois</p>
              <div className="flex gap-2 flex-wrap">
                {afterPhotos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`depois-${i}`}
                    className="h-24 w-24 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}
          {beforePhotos.length === 0 && afterPhotos.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma foto enviada</p>
          )}
          {order.video_url && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Vídeo</p>
              <a href={order.video_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline">
                <Video className="h-4 w-4" /> Ver vídeo
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Before/After slider — only when both sets have photos */}
      {beforePhotos.length > 0 && afterPhotos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparação Antes / Depois</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <BeforeAfterSlider
              before={beforePhotos[beforePhotos.length - 1]}
              after={afterPhotos[afterPhotos.length - 1]}
              className="max-h-72"
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Arraste para comparar
            </p>
          </CardContent>
        </Card>
      )}

      {/* Video + audit link */}
      <div className="flex gap-3 flex-wrap">
        <Button
          variant="outline"
          loading={uploadingMedia}
          onClick={() => videoRef.current?.click()}
        >
          <Video className="h-4 w-4" /> Enviar Vídeo
        </Button>
        <Button variant="outline" onClick={() => setAuditDialogOpen(true)}>
          <Share2 className="h-4 w-4" /> Link de Auditoria
        </Button>
      </div>

      <ServiceChat serviceOrderId={serviceId} title="Chat com prestador" />

      {/* Status actions */}
      {nextStatuses.length > 0 && (
        <div className="flex flex-wrap gap-3 border-t border-border pt-4">
          {nextStatuses.map((next) => (
            <Button key={next} onClick={() => advanceStatus(next)}
              variant={next === 'verified' ? 'default' : 'default'}>
              <CheckCircle2 className="h-4 w-4" />
              Mover para: {SERVICE_STATUS_LABELS[next]}
            </Button>
          ))}
        </div>
      )}

      {/* Hidden inputs */}
      <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
      <input ref={videoRef} type="file" accept="video/mp4" className="hidden" onChange={handleVideoUpload} />

      {/* Share with provider dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={(o) => { setShareDialogOpen(o); if (!o) setShareLink(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary-500" /> Enviar OS ao Prestador
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gere um link público. O prestador pode visualizar a OS, aceitar, iniciar e marcar como concluído — sem precisar de conta.
          </p>
          {!shareLink ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Nome do prestador (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: João Silva — Elétrica"
                  value={shareProviderName}
                  onChange={(e) => setShareProviderName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Email do prestador (opcional)</label>
                <input
                  type="email"
                  placeholder="prestador@email.com"
                  value={shareProviderEmail}
                  onChange={(e) => setShareProviderEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 transition-colors hover:bg-muted">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={shareIncludeCreds}
                  onChange={(e) => setShareIncludeCreds(e.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-(--color-warning)" />
                    Incluir senhas de acesso
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Credenciais marcadas como &ldquo;incluir em OS&rdquo; serão visíveis no link.
                  </p>
                </div>
              </label>
              <Button onClick={generateShareLink} loading={generatingShare} className="w-full">
                <Send className="h-4 w-4" /> Gerar Link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="break-all rounded-xl border border-border bg-muted px-3 py-2.5 font-mono text-xs text-muted-foreground">
                {shareLink.url}
              </div>
              <p className="text-xs text-muted-foreground">
                Expira: {new Date(shareLink.expires_at).toLocaleString('pt-BR')}
              </p>
              <div className="flex gap-2">
                <Button onClick={copyShareLink} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4" /> Copiar Link
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    if (shareProviderEmail) {
                      window.open(`mailto:${shareProviderEmail}?subject=Ordem de Serviço — ${order?.title}&body=Olá ${shareProviderName || ''},\n\nVocê tem uma OS para executar:\n\n${shareLink.url}\n\nAcesse o link para ver todos os detalhes.`);
                    } else {
                      copyShareLink();
                    }
                  }}
                >
                  {shareProviderEmail ? 'Enviar Email' : <Copy className="h-4 w-4" />}
                  {shareProviderEmail ? '' : 'Copiar'}
                </Button>
              </div>
              <Button variant="ghost" className="w-full text-xs" onClick={() => setShareLink(null)}>
                Gerar novo link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit link dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Link de Auditoria
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Gere um link temporário para que o prestador envie fotos e notas sem criar uma conta.
          </p>
          {!auditLink ? (
            <Button onClick={generateAuditLink} loading={generatingLink} className="w-full">
              <Share2 className="h-4 w-4" /> Gerar Link (48h)
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
                {auditLink.url}
              </div>
              <p className="text-xs text-muted-foreground">
                Expira em: {formatDate(auditLink.expires_at)}
              </p>
              <Button onClick={copyAuditLink} variant="outline" className="w-full">
                <Copy className="h-4 w-4" /> Copiar Link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
