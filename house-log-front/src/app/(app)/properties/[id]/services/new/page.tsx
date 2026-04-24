'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { servicesApi, roomsApi, propertiesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { SYSTEM_TYPE_LABELS } from '@/lib/utils';

const schema = z.object({
  title: z.string().min(2, 'Título obrigatório'),
  system_type: z.string().min(1, 'Sistema obrigatório'),
  priority: z.enum(['urgent', 'normal', 'preventive']),
  description: z.string().optional(),
  room_id: z.string().optional(),
  assigned_to: z.string().optional(),
  warranty_until: z.string().optional(),
  scheduled_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;
type ServiceFlow = 'quote' | 'direct';

const PRIORITY_LABELS = { urgent: 'Urgente', normal: 'Normal', preventive: 'Preventiva' };

const SPECIALTY_ALIASES: Record<string, string> = {
  electrical: 'electrical',
  eletrica: 'electrical',
  'elétrica': 'electrical',
  plumbing: 'plumbing',
  hidraulica: 'plumbing',
  'hidráulica': 'plumbing',
  structural: 'structural',
  estrutural: 'structural',
  waterproofing: 'waterproofing',
  impermeabilizacao: 'waterproofing',
  'impermeabilização': 'waterproofing',
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

export default function NewServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);
  const [serviceFlow, setServiceFlow] = useState<ServiceFlow>('quote');
  const [systemType, setSystemType] = useState('electrical');
  const [beforePhotos, setBeforePhotos] = useState<File[]>([]);
  const [problemVideo, setProblemVideo] = useState<File | null>(null);
  const [problemAudio, setProblemAudio] = useState<File | null>(null);

  const { data: roomsData } = useSWR(['rooms', id], () => roomsApi.list(id));
  const { data: providersData } = useSWR(['providers', id], () => propertiesApi.providers(id));

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'normal', system_type: 'electrical' },
  });

  const providerOptions = useMemo(() => {
    const providers = providersData?.providers ?? [];
    return providers.filter((p) => {
      const specialties = (() => {
        if (!p.specialties) return [] as string[];
        try {
          const parsed = JSON.parse(p.specialties) as string[];
          return Array.isArray(parsed) ? parsed.map(normalizeSpecialty) : [];
        } catch {
          return [] as string[];
        }
      })();

      return specialties.length === 0 || specialties.includes(normalizeSpecialty(systemType));
    });
  }, [providersData, systemType]);

  async function onSubmit(data: FormData) {
    setApiError(null);

    if (serviceFlow === 'direct' && !data.assigned_to) {
      setApiError('Selecione um prestador para execução direta.');
      return;
    }

    try {
      const res = await servicesApi.create(id, {
        ...data,
        room_id: data.room_id || undefined,
        assigned_to: serviceFlow === 'direct' ? data.assigned_to || undefined : undefined,
        warranty_until: data.warranty_until || undefined,
        scheduled_at: data.scheduled_at || undefined,
      });

      if (beforePhotos.length > 0) {
        for (const photo of beforePhotos) {
          await servicesApi.uploadPhoto(id, res.order.id, photo, 'before');
        }
      }

      if (problemVideo) {
        await servicesApi.uploadVideo(id, res.order.id, problemVideo);
      }

      if (problemAudio) {
        await servicesApi.uploadAudio(id, res.order.id, problemAudio);
      }

      router.push(`/properties/${id}/services/${res.order.id}`);
    } catch (e) {
      setApiError((e as Error).message || 'Erro ao criar OS');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-medium">Nova ordem de serviço</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base text-text-primary">Detalhes da OS</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" placeholder="Troca de disjuntor, reparo de vazamento..." {...register('title')} />
              {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo da OS *</Label>
                <Select
                  defaultValue="quote"
                  onValueChange={(v) => {
                    const flow = v as ServiceFlow;
                    setServiceFlow(flow);
                    if (flow === 'quote') setValue('assigned_to', undefined);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quote">Solicitar orçamentos (aberta)</SelectItem>
                    <SelectItem value="direct">Execução direta (prestador da equipe)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-text-secondary">
                  {serviceFlow === 'quote'
                    ? 'Prestadores orçam esta OS; nenhum prestador é definido agora.'
                    : 'A OS é enviada direto ao prestador selecionado para execução.'}
                </p>
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
              </div>

              <div className="space-y-1.5">
                <Label>Prioridade *</Label>
                <Select defaultValue="normal" onValueChange={(v) => setValue('priority', v as FormData['priority'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" rows={3}
                placeholder="Descreva o problema ou serviço em detalhes..." {...register('description')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="before_photos">Fotos do problema</Label>
              <Input
                id="before_photos"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setBeforePhotos(Array.from(e.target.files ?? []))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="problem_video">Vídeo (opcional)</Label>
                <Input
                  id="problem_video"
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setProblemVideo(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="problem_audio">Áudio (opcional)</Label>
                <Input
                  id="problem_audio"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setProblemAudio(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            {roomsData?.rooms && roomsData.rooms.length > 0 && (
              <div className="space-y-1.5">
                <Label>Cômodo</Label>
                <Select onValueChange={(v) => setValue('room_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cômodo (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {roomsData.rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="scheduled_at">Agendamento</Label>
              <Input id="scheduled_at" type="datetime-local" {...register('scheduled_at')} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Atribuir para prestador</Label>
                {providerOptions.length > 0 ? (
                  <Select onValueChange={(v) => setValue('assigned_to', v === '__none__' ? undefined : v)}>
                    <SelectTrigger><SelectValue placeholder={serviceFlow === 'direct' ? 'Selecione o prestador' : 'Nenhum (deixar em aberto)'} /></SelectTrigger>
                    <SelectContent>
                      {serviceFlow === 'quote' && <SelectItem value="__none__">Nenhum (deixar em aberto)</SelectItem>}
                      {providerOptions.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.name}
                          {p.email && <span className="text-text-secondary ml-1 text-xs">· {p.email}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-text-secondary py-2">
                    Nenhum prestador compatível com este tipo de serviço. Convide/cadastre na aba <strong>Equipe</strong>.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warranty_until">Garantia até</Label>
                <Input id="warranty_until" type="date" {...register('warranty_until')} />
              </div>
            </div>

            {apiError && (
              <div className="rounded-lg border-half border-border-danger bg-bg-danger px-4 py-3 text-sm text-text-danger">
                {apiError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Criar OS
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
