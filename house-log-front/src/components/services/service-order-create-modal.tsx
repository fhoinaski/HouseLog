'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, CalendarClock, CheckCircle2, FileImage, ListChecks, Sparkles, UserCheck, Wrench } from 'lucide-react';
import { servicesApi, roomsApi, propertiesApi } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(2, 'Titulo obrigatorio'),
  system_type: z.string().min(1, 'Sistema obrigatorio'),
  priority: z.enum(['urgent', 'normal', 'preventive']),
  description: z.string().optional(),
  room_id: z.string().optional(),
  assigned_to: z.string().optional(),
  warranty_until: z.string().optional(),
  scheduled_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type ServiceFlow = 'quote' | 'direct';

const STEPS = [
  { icon: Sparkles, label: 'Tipo e Sistema' },
  { icon: UserCheck, label: 'Execucao e Agenda' },
  { icon: FileImage, label: 'Midias e Revisao' },
];

const SPECIALTY_ALIASES: Record<string, string> = {
  electrical: 'electrical',
  eletrica: 'electrical',
  'eletrica_predial': 'electrical',
  plumbing: 'plumbing',
  hidraulica: 'plumbing',
  structural: 'structural',
  estrutural: 'structural',
  waterproofing: 'waterproofing',
  impermeabilizacao: 'waterproofing',
  painting: 'painting',
  pintura: 'painting',
  flooring: 'flooring',
  piso: 'flooring',
  roofing: 'roofing',
  telhado: 'roofing',
  general: 'general',
  geral: 'general',
};

function normalizeSpecialty(value: string): string {
  return SPECIALTY_ALIASES[value.trim().toLowerCase()] ?? value.trim().toLowerCase();
}

function parseSpecialties(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as string[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSpecialty);
  } catch {
    return [];
  }
}

interface ServiceOrderCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onCreated?: (orderId: string) => void;
}

export function ServiceOrderCreateModal({
  open,
  onOpenChange,
  propertyId,
  onCreated,
}: ServiceOrderCreateModalProps) {
  const [step, setStep] = useState(0);
  const [serviceFlow, setServiceFlow] = useState<ServiceFlow>('quote');
  const [systemType, setSystemType] = useState('electrical');
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [problemVideo, setProblemVideo] = useState<File | null>(null);
  const [problemAudio, setProblemAudio] = useState<File | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: roomsData } = useSWR(['rooms', propertyId], () => roomsApi.list(propertyId));
  const { data: providersData } = useSWR(['providers', propertyId], () => propertiesApi.providers(propertyId));

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      priority: 'normal',
      system_type: 'electrical',
    },
  });

  const providerOptions = useMemo(() => {
    const providers = providersData?.providers ?? [];
    return providers.filter((p) => {
      const specialties = parseSpecialties(p.specialties);
      return specialties.length === 0 || specialties.includes(normalizeSpecialty(systemType));
    });
  }, [providersData, systemType]);

  const assignedTo = useWatch({ control, name: 'assigned_to' });

  function resetWizard() {
    setStep(0);
    setServiceFlow('quote');
    setSystemType('electrical');
    setBeforePhotos([]);
    setProblemVideo(null);
    setProblemAudio(null);
    setApiError(null);
    reset({
      priority: 'normal',
      system_type: 'electrical',
      assigned_to: undefined,
      room_id: undefined,
      scheduled_at: undefined,
      warranty_until: undefined,
      description: '',
      title: '',
    });
  }

  function closeModal(next: boolean) {
    if (!next) resetWizard();
    onOpenChange(next);
  }

  async function onSubmit(data: FormData) {
    setApiError(null);

    if (serviceFlow === 'direct' && !data.assigned_to) {
      setApiError('Selecione um prestador para execucao direta.');
      return;
    }

    try {
      const created = await servicesApi.create(propertyId, {
        ...data,
        room_id: data.room_id || undefined,
        assigned_to: serviceFlow === 'direct' ? data.assigned_to || undefined : undefined,
        warranty_until: data.warranty_until || undefined,
        scheduled_at: data.scheduled_at || undefined,
      });

      if (beforePhotos.length > 0) {
        for (const photo of beforePhotos) {
          await servicesApi.uploadPhoto(propertyId, created.order.id, photo, 'before');
        }
      }

      if (problemVideo) {
        await servicesApi.uploadVideo(propertyId, created.order.id, problemVideo);
      }

      if (problemAudio) {
        await servicesApi.uploadAudio(propertyId, created.order.id, problemAudio);
      }

      onCreated?.(created.order.id);
      closeModal(false);
    } catch (e) {
      setApiError((e as Error).message || 'Erro ao criar OS');
    }
  }

  const canGoStep2 = Boolean(watch('title')?.trim()) && Boolean(watch('system_type') || systemType);
  const canGoStep3 = serviceFlow === 'quote' || Boolean(assignedTo);

  return (
    <Dialog open={open} onOpenChange={closeModal}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Wrench className="h-4 w-4 text-primary-600" />
            Nova Ordem de Servico
          </DialogTitle>
          <DialogDescription>
            Processo guiado em etapas para abrir OS de forma rapida e clara.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-4 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            {STEPS.map((s, idx) => {
              const Icon = s.icon;
              const active = idx === step;
              const done = idx < step;
              return (
                <div key={s.label} className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                      done ? 'bg-primary-600 text-white' : active ? 'bg-primary-100 text-primary-700' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={cn('text-[11px] sm:text-xs truncate', active ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                    {s.label}
                  </span>
                  {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
                </div>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 overflow-y-auto space-y-4">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="os-title">Titulo *</Label>
                <Input id="os-title" placeholder="Ex.: Vazamento na cozinha" {...register('title')} />
                {errors.title && <p className="text-xs text-(--color-danger)">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Tipo da OS *</Label>
                  <Select
                    value={serviceFlow}
                    onValueChange={(v) => {
                      const next = v as ServiceFlow;
                      setServiceFlow(next);
                      if (next === 'quote') setValue('assigned_to', undefined);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quote">Solicitar orcamentos</SelectItem>
                      <SelectItem value="direct">Execucao direta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Sistema *</Label>
                  <Select
                    defaultValue="electrical"
                    onValueChange={(v) => {
                      setValue('system_type', v);
                      setSystemType(v);
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SYSTEM_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.system_type && <p className="text-xs text-(--color-danger)">{errors.system_type.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Prioridade *</Label>
                <Select defaultValue="normal" onValueChange={(v) => setValue('priority', v as FormData['priority'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_PRIORITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="os-description">Descricao</Label>
                <Textarea
                  id="os-description"
                  rows={3}
                  placeholder="Descreva o problema com detalhes para melhorar o atendimento"
                  {...register('description')}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cômodo</Label>
                <Select onValueChange={(v) => setValue('room_id', v === '__none__' ? undefined : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar comodo (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem comodo</SelectItem>
                    {(roomsData?.rooms ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Prestador</Label>
                {providerOptions.length > 0 ? (
                  <Select onValueChange={(v) => setValue('assigned_to', v === '__none__' ? undefined : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={serviceFlow === 'direct' ? 'Selecione o prestador' : 'Opcional'} />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceFlow === 'quote' && <SelectItem value="__none__">Nao definir agora</SelectItem>}
                      {providerOptions.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground rounded-lg bg-muted p-3">
                    Nenhum prestador compativel para este sistema no momento.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="scheduled_at">Agendamento</Label>
                  <Input id="scheduled_at" type="datetime-local" {...register('scheduled_at')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="warranty_until">Garantia ate</Label>
                  <Input id="warranty_until" type="date" {...register('warranty_until')} />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
                <ListChecks className="h-4 w-4 shrink-0 mt-0.5" />
                {serviceFlow === 'quote'
                  ? 'Modo orcamento: prestadores compativeis podem responder com proposta.'
                  : 'Modo execucao direta: OS vai direto para o prestador selecionado.'}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="before_photos">Fotos do problema</Label>
                  <Input
                    id="before_photos"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setBeforePhotos(Array.from(e.target.files ?? []))}
                  />
                </div>
                <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground flex items-center justify-center">
                  <Building2 className="h-4 w-4 mr-1" />
                  {beforePhotos.length} arquivo(s)
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="problem_video">Video (opcional)</Label>
                  <Input
                    id="problem_video"
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setProblemVideo(e.target.files?.[0] ?? null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="problem_audio">Audio (opcional)</Label>
                  <Input
                    id="problem_audio"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setProblemAudio(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-(--color-primary-border) bg-(--color-primary-light) p-3 text-sm text-(--color-primary)">
                Revise e conclua: a OS sera criada com o fluxo selecionado e os anexos serao enviados automaticamente.
              </div>
            </div>
          )}

          {apiError && (
            <div className="rounded-lg border border-(--color-danger-border) bg-(--color-danger-light) px-4 py-3 text-sm text-(--color-danger)">
              {apiError}
            </div>
          )}
        </form>

        <div className="px-5 pb-5 pt-3 border-t border-border flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (step === 0) {
                closeModal(false);
                return;
              }
              setStep(step - 1);
            }}
            className="min-w-28"
          >
            {step === 0 ? 'Cancelar' : 'Voltar'}
          </Button>

          {step < 2 ? (
            <Button
              type="button"
              onClick={() => {
                if (step === 0 && !canGoStep2) {
                  setApiError('Preencha titulo e sistema para continuar.');
                  return;
                }
                if (step === 1 && !canGoStep3) {
                  setApiError('Selecione um prestador para execucao direta.');
                  return;
                }
                setApiError(null);
                setStep(step + 1);
              }}
              className="min-w-28"
            >
              Continuar
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit(onSubmit)} loading={isSubmitting} className="min-w-28">
              <CalendarClock className="h-4 w-4" />
              Criar OS
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
