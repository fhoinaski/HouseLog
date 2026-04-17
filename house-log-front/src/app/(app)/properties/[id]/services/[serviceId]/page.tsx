'use client';

import { use, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft, Camera, Video, Share2, CheckCircle2, Clock,
  Wrench, AlertTriangle, MapPin, User, DollarSign, Calendar,
  ShieldCheck, Trash2, Copy,
} from 'lucide-react';
import { servicesApi, type ServiceOrder } from '@/lib/api';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
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

export default function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; serviceId: string }>;
}) {
  const { id: propertyId, serviceId } = use(params);
  const router = useRouter();
  const toast = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const [photoType, setPhotoType] = useState<'before' | 'after'>('before');
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditLink, setAuditLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const { data, mutate } = useSWR(
    ['service', propertyId, serviceId],
    () => servicesApi.get(propertyId, serviceId)
  );

  const order = data?.order;

  async function advanceStatus(next: string) {
    try {
      await servicesApi.updateStatus(propertyId, serviceId, next);
      await mutate();
      toast({ title: `Status: ${SERVICE_STATUS_LABELS[next]}`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Erro ao atualizar status', description: (e as Error).message, variant: 'destructive' });
    }
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !order) return;
    setUploadingMedia(true);
    try {
      await servicesApi.uploadPhoto(propertyId, serviceId, file, photoType);
      await mutate();
      toast({ title: `Foto "${photoType === 'before' ? 'antes' : 'depois'}" enviada`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Erro no upload', description: (e as Error).message, variant: 'destructive' });
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
      toast({ title: 'Vídeo enviado', variant: 'success' });
    } catch (e) {
      toast({ title: 'Erro no upload', description: (e as Error).message, variant: 'destructive' });
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
      toast({ title: 'Erro ao gerar link', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setGeneratingLink(false);
    }
  }

  async function copyAuditLink() {
    if (!auditLink) return;
    await navigator.clipboard.writeText(auditLink.url);
    toast({ title: 'Link copiado!', variant: 'success' });
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const beforePhotos = JSON.parse(order.before_photos || '[]') as string[];
  const afterPhotos = JSON.parse(order.after_photos || '[]') as string[];
  const checklist = JSON.parse(order.checklist || '[]') as { item: string; done: boolean }[];
  const nextStatuses = STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{order.title}</h1>
            {order.priority === 'urgent' && <AlertTriangle className="h-4 w-4 text-rose-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={STATUS_VARIANT[order.status]}>{SERVICE_STATUS_LABELS[order.status]}</Badge>
            <Badge variant={PRIORITY_VARIANT[order.priority]}>{SERVICE_PRIORITY_LABELS[order.priority]}</Badge>
          </div>
        </div>
      </div>

      {/* Meta */}
      <Card>
        <CardContent className="p-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Sistema</dt>
              <dd className="font-medium">{SYSTEM_TYPE_LABELS[order.system_type]}</dd>
            </div>
            {order.room_name && (
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Cômodo</dt>
                <dd className="font-medium flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {order.room_name}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Solicitado por</dt>
              <dd className="font-medium flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> {order.requested_by_name}
              </dd>
            </div>
            {order.assigned_to_name && (
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Atribuído a</dt>
                <dd className="font-medium">{order.assigned_to_name}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Criada em</dt>
              <dd className="font-medium flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> {formatDate(order.created_at)}
              </dd>
            </div>
            {order.cost && (
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Custo</dt>
                <dd className="font-medium flex items-center gap-1 text-emerald-600">
                  <DollarSign className="h-3.5 w-3.5" /> {formatCurrency(order.cost)}
                </dd>
              </div>
            )}
            {order.warranty_until && (
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Garantia até</dt>
                <dd className="font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {formatDate(order.warranty_until)}
                </dd>
              </div>
            )}
            {order.scheduled_at && (
              <div>
                <dt className="text-xs text-[var(--muted-foreground)] mb-0.5">Agendado</dt>
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

      {/* Checklist */}
      {checklist.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Checklist</CardTitle></CardHeader>
          <CardContent className="p-6 pt-0 space-y-2">
            {checklist.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className={cn('h-4 w-4 flex-shrink-0', item.done ? 'text-emerald-500' : 'text-slate-300')} />
                <span className={item.done ? 'line-through text-[var(--muted-foreground)]' : ''}>{item.item}</span>
              </div>
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
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Antes</p>
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
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Depois</p>
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
            <p className="text-sm text-[var(--muted-foreground)] text-center py-4">Nenhuma foto enviada</p>
          )}
          {order.video_url && (
            <div>
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Vídeo</p>
              <a href={order.video_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:underline">
                <Video className="h-4 w-4" /> Ver vídeo
              </a>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Status actions */}
      {nextStatuses.length > 0 && (
        <div className="border-t border-[var(--border)] pt-4 flex gap-3 flex-wrap">
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

      {/* Audit link dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-4 w-4" /> Link de Auditoria
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">
            Gere um link temporário para que o prestador envie fotos e notas sem criar uma conta.
          </p>
          {!auditLink ? (
            <Button onClick={generateAuditLink} loading={generatingLink} className="w-full">
              <Share2 className="h-4 w-4" /> Gerar Link (48h)
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-[var(--muted)] px-3 py-2 text-xs font-mono break-all">
                {auditLink.url}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">
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
