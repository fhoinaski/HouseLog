'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { handoverChecklistItemCreateSchema } from '@houselog/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { HandoverChecklistItem, HandoverChecklistItemCreateInput } from '@/lib/api';

const ITEM_CATEGORIES: Array<{ value: HandoverChecklistItemCreateInput['category']; label: string }> = [
  { value: 'general', label: 'Geral' },
  { value: 'keys', label: 'Chaves' },
  { value: 'documents', label: 'Documentos' },
  { value: 'utilities', label: 'Utilidades' },
  { value: 'inventory', label: 'Inventario' },
  { value: 'cleaning', label: 'Limpeza' },
  { value: 'maintenance', label: 'Manutencao' },
  { value: 'safety', label: 'Seguranca' },
];

const ITEM_STATUSES: Array<{ value: HandoverChecklistItemCreateInput['status']; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'done', label: 'Concluido' },
  { value: 'issue', label: 'Pendencia' },
  { value: 'not_applicable', label: 'Nao aplicavel' },
];

const ITEM_CONDITIONS: Array<{ value: NonNullable<HandoverChecklistItemCreateInput['condition']>; label: string }> = [
  { value: 'new', label: 'Novo' },
  { value: 'good', label: 'Bom' },
  { value: 'fair', label: 'Regular' },
  { value: 'poor', label: 'Ruim' },
  { value: 'damaged', label: 'Danificado' },
];

const DEFAULT_VALUES: HandoverChecklistItemCreateInput = {
  title: '',
  description: null,
  category: 'general',
  required: true,
  status: 'pending',
  condition: null,
  notes: null,
  sort_order: 0,
  evidence_urls: [],
};

type HandoverChecklistItemFormDialogProps = {
  open: boolean;
  item: HandoverChecklistItem | null;
  submitting: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HandoverChecklistItemCreateInput) => Promise<void>;
};

export function HandoverChecklistItemFormDialog({
  open,
  item,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: HandoverChecklistItemFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<HandoverChecklistItemCreateInput>({
    resolver: zodResolver(handoverChecklistItemCreateSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const required = watch('required');

  useEffect(() => {
    if (!open) return;
    reset(item ? toFormValues(item) : DEFAULT_VALUES);
  }, [open, reset, item]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item do checklist' : 'Novo item do checklist'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ci-title">Titulo *</Label>
              <Input id="ci-title" placeholder="Ex.: Entrega de chaves do apartamento" {...register('title')} />
              {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select
                defaultValue={item?.category ?? DEFAULT_VALUES.category}
                onValueChange={(value) =>
                  setValue('category', value as HandoverChecklistItemCreateInput['category'], { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                defaultValue={item?.status ?? DEFAULT_VALUES.status}
                onValueChange={(value) =>
                  setValue('status', value as HandoverChecklistItemCreateInput['status'], { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Condicao</Label>
              <Select
                defaultValue={item?.condition ?? ''}
                onValueChange={(value) =>
                  setValue(
                    'condition',
                    value === '' ? null : (value as NonNullable<HandoverChecklistItemCreateInput['condition']>),
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nao informada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nao informada</SelectItem>
                  {ITEM_CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ci-sort-order">Ordem</Label>
              <Input
                id="ci-sort-order"
                type="number"
                min={0}
                step={1}
                {...register('sort_order', { valueAsNumber: true })}
              />
            </div>

            <div className="flex items-center gap-3 sm:col-span-2">
              <input
                id="ci-required"
                type="checkbox"
                checked={required ?? true}
                onChange={(e) => setValue('required', e.target.checked, { shouldValidate: true })}
                className="h-4 w-4 rounded accent-[var(--color-accent)]"
              />
              <Label htmlFor="ci-required" className="cursor-pointer">
                Item obrigatorio
              </Label>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ci-description">Descricao</Label>
              <Textarea
                id="ci-description"
                rows={3}
                placeholder="Contexto tecnico ou instrucoes para este item"
                {...register('description')}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="ci-notes">Notas</Label>
              <Textarea
                id="ci-notes"
                rows={3}
                placeholder="Observacoes adicionais, pendencias ou ressalvas"
                {...register('notes')}
              />
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
              {item ? 'Salvar alteracoes' : 'Criar item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toFormValues(item: HandoverChecklistItem): HandoverChecklistItemCreateInput {
  return {
    title: item.title,
    description: item.description,
    category: item.category,
    required: item.required,
    status: item.status,
    condition: item.condition,
    notes: item.notes,
    sort_order: item.sort_order,
    evidence_urls: item.evidence_urls,
  };
}
