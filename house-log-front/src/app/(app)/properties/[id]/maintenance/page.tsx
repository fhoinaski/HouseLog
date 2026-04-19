'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus, Wrench, CheckCircle2, AlertTriangle, Clock, Trash2, Pencil, RefreshCw,
} from 'lucide-react';
import { maintenanceApi, type MaintenanceSchedule } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { SYSTEM_TYPE_LABELS, formatDate, cn } from '@/lib/utils';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral',
  semiannual: 'Semestral', annual: 'Anual',
};

const schema = z.object({
  system_type: z.string().min(1, 'Sistema obrigatório'),
  title: z.string().min(2, 'Título obrigatório'),
  description: z.string().optional(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'semiannual', 'annual']),
  responsible: z.string().optional(),
  last_done: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function ScheduleCard({
  s, onEdit, onDelete, onMarkDone,
}: {
  s: MaintenanceSchedule;
  onEdit: (s: MaintenanceSchedule) => void;
  onDelete: (s: MaintenanceSchedule) => void;
  onMarkDone: (s: MaintenanceSchedule) => void;
}) {
  const overdue = s.is_overdue;
  const dueLabel = s.next_due
    ? overdue
      ? `Vencida ${Math.abs(s.days_until_due ?? 0)}d atrás`
      : s.days_until_due === 0
        ? 'Vence hoje'
        : `${s.days_until_due}d restantes`
    : 'Sem data';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            overdue ? 'bg-bg-danger' : 'bg-bg-accent-subtle'
          )}>
            <Wrench className={cn('h-4 w-4', overdue ? 'text-text-danger' : 'text-text-accent')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-text-primary">{s.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {SYSTEM_TYPE_LABELS[s.system_type] ?? s.system_type}
              </Badge>
              <span className="text-xs text-text-secondary">
                {FREQUENCY_LABELS[s.frequency]}
              </span>
              <span className={cn(
                'text-xs font-medium flex items-center gap-1',
                overdue ? 'text-text-danger' : 'text-text-warning'
              )}>
                {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                {dueLabel}
              </span>
            </div>
            {s.last_done && (
              <p className="text-xs text-text-secondary mt-0.5">
                Última execução: {formatDate(s.last_done)}
              </p>
            )}
            {s.responsible && (
              <p className="text-xs text-text-secondary mt-0.5">Responsável: {s.responsible}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-text-success hover:bg-bg-success"
              title="Marcar como feito"
              onClick={() => onMarkDone(s)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary" onClick={() => onEdit(s)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-text-danger hover:bg-bg-danger"
              onClick={() => onDelete(s)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MaintenancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MaintenanceSchedule | null>(null);
  const [deleteItem, setDeleteItem] = useState<MaintenanceSchedule | null>(null);
  const [markDoneItem, setMarkDoneItem] = useState<MaintenanceSchedule | null>(null);
  const [autoCreateOs, setAutoCreateOs] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data, mutate } = useSWR(['maintenance', id], () => maintenanceApi.list(id));

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { frequency: 'monthly', system_type: 'electrical' },
  });

  const schedules = data?.schedules ?? [];
  const overdue = schedules.filter((s) => s.is_overdue);
  const upcoming = schedules.filter((s) => !s.is_overdue && s.days_until_due !== null && (s.days_until_due ?? 999) <= 30);
  const rest = schedules.filter((s) => !s.is_overdue && ((s.days_until_due ?? 999) > 30 || s.days_until_due === null));

  function openNew() {
    setEditItem(null);
    reset({ frequency: 'monthly', system_type: 'electrical' });
    setApiError(null);
    setDialogOpen(true);
  }

  function openEdit(s: MaintenanceSchedule) {
    setEditItem(s);
    reset({
      system_type: s.system_type,
      title: s.title,
      description: s.description ?? undefined,
      frequency: s.frequency,
      responsible: s.responsible ?? undefined,
      last_done: s.last_done ?? undefined,
    });
    setApiError(null);
    setDialogOpen(true);
  }

  async function onSubmit(form: FormData) {
    setApiError(null);
    try {
      if (editItem) {
        await maintenanceApi.update(id, editItem.id, form);
        toast.success('Manutenção atualizada');
      } else {
        await maintenanceApi.create(id, form);
        toast.success('Manutenção criada');
      }
      await mutate();
      setDialogOpen(false);
    } catch (e) {
      setApiError((e as Error).message);
    }
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    try {
      await maintenanceApi.delete(id, deleteItem.id);
      await mutate();
      toast.success('Removido');
    } catch (e) {
      toast.error('Erro ao remover', { description: (e as Error).message });
    } finally {
      setDeleteItem(null);
    }
  }

  async function confirmMarkDone() {
    if (!markDoneItem) return;
    try {
      await maintenanceApi.markDone(id, markDoneItem.id, autoCreateOs);
      await mutate();
      toast.success('Marcado como realizado!');
    } catch (e) {
      toast.error('Erro', { description: (e as Error).message });
    } finally {
      setMarkDoneItem(null);
      setAutoCreateOs(false);
    }
  }

  function Section({ title, items }: { title: string; items: MaintenanceSchedule[] }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <h3 className="hl-section-title">{title}</h3>
        {items.map((s) => (
          <ScheduleCard key={s.id} s={s} onEdit={openEdit} onDelete={setDeleteItem} onMarkDone={setMarkDoneItem} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 safe-bottom">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-text-primary">Manutenção preventiva</h2>
          <p className="text-sm text-text-secondary">
            {schedules.length} agendamento{schedules.length !== 1 ? 's' : ''}
            {overdue.length > 0 && (
              <span className="ml-2 font-medium text-text-danger">· {overdue.length} vencido{overdue.length !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" />
          Novo agendamento
        </Button>
      </div>

      {schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RefreshCw className="mb-3 h-10 w-10 text-text-tertiary" />
          <p className="text-text-secondary text-sm">Nenhum agendamento cadastrado</p>
          <Button variant="outline" className="mt-3" onClick={openNew}>
            <Plus className="h-4 w-4" /> Criar agendamento
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <Section title="Vencidos" items={overdue} />
          <Section title="Próximos 30 dias" items={upcoming} />
          <Section title="Em dia" items={rest} />
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar manutenção' : 'Nova manutenção'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sistema *</Label>
                <Select
                  defaultValue={editItem?.system_type ?? 'electrical'}
                  onValueChange={(v) => setValue('system_type', v)}
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
                <Label>Frequência *</Label>
                <Select
                  defaultValue={editItem?.frequency ?? 'monthly'}
                  onValueChange={(v) => setValue('frequency', v as FormData['frequency'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-title">Título *</Label>
              <Input id="m-title" placeholder="Revisão do ar-condicionado..." {...register('title')} />
              {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="m-desc">Descrição</Label>
              <Input id="m-desc" placeholder="Opcional..." {...register('description')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="m-responsible">Responsável</Label>
                <Input id="m-responsible" placeholder="Nome ou empresa..." {...register('responsible')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m-last">Última execução</Label>
                <Input id="m-last" type="date" {...register('last_done')} />
              </div>
            </div>

            {apiError && (
              <div className="rounded-lg border-half border-border-danger bg-bg-danger px-3 py-2 text-sm text-text-danger">
                {apiError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                {editItem ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!markDoneItem} onOpenChange={() => { setMarkDoneItem(null); setAutoCreateOs(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como realizado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Confirma a execução de <strong className="text-text-primary">{markDoneItem?.title}</strong>?
            A próxima data será recalculada automaticamente.
          </p>
          <label className="flex items-center gap-3 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreateOs}
              onChange={(e) => setAutoCreateOs(e.target.checked)}
              className="h-4 w-4 rounded border-border-subtle"
            />
            <span className="text-sm text-text-primary">Criar OS de verificação automaticamente</span>
          </label>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setMarkDoneItem(null)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={confirmMarkDone} className="flex-1">
              <CheckCircle2 className="h-4 w-4" /> Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover agendamento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Tem certeza que deseja remover <strong className="text-text-primary">{deleteItem?.title}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteItem(null)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete} className="flex-1">
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
