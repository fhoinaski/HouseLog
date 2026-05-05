'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { renovationCreateSchema } from '@houselog/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Renovation, RenovationCreateInput } from '@/lib/api';

const RENOVATION_CATEGORIES: Array<{ value: RenovationCreateInput['category']; label: string }> = [
  { value: 'structural', label: 'Estrutural' },
  { value: 'electrical', label: 'Eletrica' },
  { value: 'plumbing', label: 'Hidraulica' },
  { value: 'finishing', label: 'Acabamento' },
  { value: 'layout', label: 'Layout' },
  { value: 'roofing', label: 'Cobertura' },
  { value: 'waterproofing', label: 'Impermeabilizacao' },
  { value: 'painting', label: 'Pintura' },
  { value: 'flooring', label: 'Piso' },
  { value: 'other', label: 'Outro' },
];

const RENOVATION_STATUSES: Array<{ value: RenovationCreateInput['status']; label: string }> = [
  { value: 'planned', label: 'Planejada' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluida' },
  { value: 'cancelled', label: 'Cancelada' },
];

const DEFAULT_VALUES: RenovationCreateInput = {
  title: '',
  category: 'other',
  status: 'planned',
  description: null,
  started_at: null,
  completed_at: null,
  contractor_name: null,
  cost: null,
  notes: null,
  before_photos: [],
  after_photos: [],
};

type RenovationFormDialogProps = {
  open: boolean;
  renovation: Renovation | null;
  submitting: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RenovationCreateInput) => Promise<void>;
};

export function RenovationFormDialog({
  open,
  renovation,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: RenovationFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<RenovationCreateInput>({
    resolver: zodResolver(renovationCreateSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const category = useWatch({ control, name: 'category' });
  const status = useWatch({ control, name: 'status' });

  useEffect(() => {
    if (!open) return;
    reset(renovation ? toFormValues(renovation) : DEFAULT_VALUES);
  }, [open, renovation, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{renovation ? 'Editar reforma' : 'Nova reforma'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="renovation-title">Titulo *</Label>
              <Input id="renovation-title" placeholder="Ex.: Reforma da area gourmet" {...register('title')} />
              {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select
                value={category ?? DEFAULT_VALUES.category}
                onValueChange={(value) => setValue('category', value as RenovationCreateInput['category'], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RENOVATION_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                value={status ?? DEFAULT_VALUES.status}
                onValueChange={(value) => setValue('status', value as RenovationCreateInput['status'], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RENOVATION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="renovation-description">Descricao</Label>
              <Textarea id="renovation-description" rows={3} placeholder="Escopo, contexto tecnico e areas afetadas" {...register('description')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renovation-started">Inicio</Label>
              <Input id="renovation-started" type="date" {...register('started_at')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renovation-completed">Conclusao</Label>
              <Input id="renovation-completed" type="date" {...register('completed_at')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renovation-contractor">Contratado</Label>
              <Input id="renovation-contractor" placeholder="Empresa ou profissional responsavel" {...register('contractor_name')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renovation-cost">Custo</Label>
              <Input
                id="renovation-cost"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                {...register('cost', {
                  setValueAs: (value) => value === '' ? null : Number(value),
                })}
              />
              {errors.cost && <p className="text-xs text-text-danger">{errors.cost.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="renovation-notes">Notas</Label>
              <Textarea id="renovation-notes" rows={3} placeholder="Observacoes operacionais, pendencias ou decisoes tecnicas" {...register('notes')} />
            </div>
          </div>

          {error && (
            <div className="rounded-[var(--radius-md)] border-half border-border-danger bg-bg-danger px-3 py-2 text-sm text-text-danger">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              {renovation ? 'Salvar alteracoes' : 'Criar reforma'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toFormValues(renovation: Renovation): RenovationCreateInput {
  return {
    room_id: renovation.room_id,
    service_order_id: renovation.service_order_id,
    document_id: renovation.document_id,
    title: renovation.title,
    description: renovation.description,
    category: renovation.category,
    status: renovation.status,
    started_at: renovation.started_at,
    completed_at: renovation.completed_at,
    contractor_name: renovation.contractor_name,
    contractor_id: renovation.contractor_id,
    cost: renovation.cost,
    notes: renovation.notes,
    before_photos: renovation.before_photos,
    after_photos: renovation.after_photos,
  };
}
