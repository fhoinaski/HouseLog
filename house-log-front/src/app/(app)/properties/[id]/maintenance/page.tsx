'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Wrench,
} from 'lucide-react';
import { maintenanceApi, type MaintenanceSchedule } from '@/lib/api';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetricCard } from '@/components/ui/metric-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SYSTEM_TYPE_LABELS, cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
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
  s,
  onEdit,
  onDelete,
  onMarkDone,
}: {
  s: MaintenanceSchedule;
  onEdit: (s: MaintenanceSchedule) => void;
  onDelete: (s: MaintenanceSchedule) => void;
  onMarkDone: (s: MaintenanceSchedule) => void;
}) {
  const overdue = s.is_overdue;
  const dueLabel = s.next_due
    ? overdue
      ? `Vencida há ${Math.abs(s.days_until_due ?? 0)}d`
      : s.days_until_due === 0
        ? 'Vence hoje'
        : `${s.days_until_due}d restantes`
    : 'Sem data';

  return (
    <article className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 text-text-primary">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
            overdue ? 'bg-bg-danger text-text-danger' : 'bg-bg-accent-subtle text-text-accent'
          )}
        >
          <Wrench className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{s.title}</p>
              {s.description && (
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-text-secondary">{s.description}</p>
              )}
            </div>
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-1 text-xs font-medium',
                overdue ? 'text-text-danger' : 'text-text-warning'
              )}
            >
              {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              {dueLabel}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {SYSTEM_TYPE_LABELS[s.system_type] ?? s.system_type}
            </Badge>
            <Badge variant={overdue ? 'destructive' : 'outline'} className="text-xs">
              {FREQUENCY_LABELS[s.frequency]}
            </Badge>
            {s.next_due && <span className="text-xs text-text-secondary">Próxima: {formatDate(s.next_due)}</span>}
            {s.last_done && <span className="text-xs text-text-secondary">Última execução: {formatDate(s.last_done)}</span>}
            {s.responsible && <span className="text-xs text-text-secondary">Responsável: {s.responsible}</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:justify-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 min-h-8 w-8 text-text-success hover:bg-bg-success"
            title="Marcar como realizado"
            aria-label="Marcar como realizado"
            onClick={() => onMarkDone(s)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 min-h-8 w-8 text-text-secondary"
            aria-label="Editar agendamento"
            onClick={() => onEdit(s)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 min-h-8 w-8 text-text-danger hover:bg-bg-danger"
            aria-label="Remover agendamento"
            onClick={() => onDelete(s)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </article>
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

  const { data, mutate, isLoading } = useSWR(['maintenance', id], () => maintenanceApi.list(id));

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
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
      toast.success('Agendamento removido');
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
      toast.success('Marcado como realizado');
    } catch (e) {
      toast.error('Erro', { description: (e as Error).message });
    } finally {
      setMarkDoneItem(null);
      setAutoCreateOs(false);
    }
  }

  function Section({
    title,
    description,
    items,
  }: {
    title: string;
    description: string;
    items: MaintenanceSchedule[];
  }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>
          <p className="text-xs leading-5 text-text-secondary">{description}</p>
        </div>
        {items.map((s) => (
          <ScheduleCard key={s.id} s={s} onEdit={openEdit} onDelete={setDeleteItem} onMarkDone={setMarkDoneItem} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-4 safe-bottom sm:px-5 sm:py-5">
      <PageHeader
        density="editorial"
        eyebrow="Prontuário técnico"
        title="Manutenção preventiva"
        description="Rotina de conservação, inspeções e recorrências que sustentam a saúde técnica e a governança operacional do imóvel."
        actions={
          <Button type="button" onClick={openNew}>
            <Plus className="h-4 w-4" />
            Novo agendamento
          </Button>
        }
      />

      {isLoading ? (
        <PageSection tone="strong" density="editorial">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
            ))}
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        </PageSection>
      ) : (
        <>
          <PageSection
            title="Saúde técnica preventiva"
            description="Indicadores para priorizar vencimentos, manter recorrências ativas e registrar execução no histórico técnico."
            tone="strong"
            density="editorial"
          >
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MetricCard label="Agendamentos" value={schedules.length} helper="Rotinas cadastradas" icon={RefreshCw} />
              <MetricCard
                label="Vencidos"
                value={overdue.length}
                helper={overdue.length > 0 ? 'Requer ação' : 'Sem pendências'}
                icon={AlertTriangle}
                tone={overdue.length > 0 ? 'danger' : 'default'}
              />
              <MetricCard
                label="Próximos 30 dias"
                value={upcoming.length}
                helper="Janela operacional"
                icon={Clock}
                tone={upcoming.length > 0 ? 'warning' : 'default'}
              />
              <MetricCard label="Em dia" value={rest.length} helper="Rotinas controladas" icon={CheckCircle2} tone="success" />
            </div>
          </PageSection>

          <PageSection
            title="Plano preventivo"
            description="Agenda recorrente do imóvel, organizada por urgência para apoiar decisão, execução e auditoria."
            density="editorial"
          >
            {schedules.length === 0 ? (
              <EmptyState
                icon={<RefreshCw className="h-5 w-5" />}
                title="Nenhuma rotina preventiva cadastrada"
                description="Crie o primeiro agendamento para registrar inspeções, revisões e recorrências no prontuário técnico do imóvel."
                actions={
                  <Button type="button" variant="outline" onClick={openNew}>
                    <Plus className="h-4 w-4" />
                    Criar agendamento
                  </Button>
                }
              />
            ) : (
              <div className="space-y-6">
                <Section
                  title="Vencidos"
                  description="Itens que exigem regularização para reduzir risco operacional."
                  items={overdue}
                />
                <Section
                  title="Próximos 30 dias"
                  description="Rotinas que devem entrar no planejamento imediato."
                  items={upcoming}
                />
                <Section
                  title="Em dia"
                  description="Recorrências controladas e registradas no histórico."
                  items={rest}
                />
              </div>
            )}
          </PageSection>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar manutenção' : 'Nova manutenção'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-2 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Sistema *</Label>
                <Select
                  defaultValue={editItem?.system_type ?? 'electrical'}
                  onValueChange={(v) => setValue('system_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SYSTEM_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
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

            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="rounded-[var(--radius-md)] border-half border-border-danger bg-bg-danger px-3 py-2 text-sm text-text-danger">
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
          <label className="mt-2 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={autoCreateOs}
              onChange={(e) => setAutoCreateOs(e.target.checked)}
              className="h-4 w-4 rounded border-border-subtle"
            />
            <span className="text-sm text-text-primary">Criar OS de verificação automaticamente</span>
          </label>
          <div className="mt-4 flex gap-3">
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
          <div className="mt-4 flex gap-3">
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
