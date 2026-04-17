'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { servicesApi, roomsApi } from '@/lib/api';
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
  cost: z.coerce.number().min(0).optional().or(z.literal('')),
  warranty_until: z.string().optional(),
  scheduled_at: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const PRIORITY_LABELS = { urgent: 'Urgente', normal: 'Normal', preventive: 'Preventiva' };

export default function NewServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: roomsData } = useSWR(['rooms', id], () => roomsApi.list(id));

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'normal', system_type: 'electrical' },
  });

  async function onSubmit(data: FormData) {
    setApiError(null);
    try {
      const res = await servicesApi.create(id, {
        ...data,
        cost: data.cost === '' ? undefined : Number(data.cost),
        room_id: data.room_id || undefined,
        assigned_to: data.assigned_to || undefined,
        warranty_until: data.warranty_until || undefined,
        scheduled_at: data.scheduled_at || undefined,
      });
      router.push(`/properties/${id}/services/${res.order.id}`);
    } catch (e) {
      setApiError((e as Error).message || 'Erro ao criar OS');
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">Nova Ordem de Serviço</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Detalhes da OS</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Título *</Label>
              <Input id="title" placeholder="Troca de disjuntor, reparo de vazamento..." {...register('title')} />
              {errors.title && <p className="text-xs text-rose-500">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sistema *</Label>
                <Select defaultValue="electrical" onValueChange={(v) => setValue('system_type', v)}>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="scheduled_at">Agendamento</Label>
                <Input id="scheduled_at" type="datetime-local" {...register('scheduled_at')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost">Custo Estimado (R$)</Label>
                <Input id="cost" type="number" step="0.01" min={0} placeholder="0,00" {...register('cost')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="assigned_to">Atribuir para (ID do usuário)</Label>
                <Input id="assigned_to" placeholder="ID do prestador..." {...register('assigned_to')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warranty_until">Garantia até</Label>
                <Input id="warranty_until" type="date" {...register('warranty_until')} />
              </div>
            </div>

            {apiError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
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
