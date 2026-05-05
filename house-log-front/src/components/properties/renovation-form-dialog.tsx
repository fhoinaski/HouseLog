'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { renovationCreateSchema } from '@houselog/contracts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PremiumFormActions, PremiumFormError, PremiumFormGrid, PremiumFormSection } from './premium-form-layout';
import type { Renovation, RenovationCreateInput } from '@/lib/api';

const RENOVATION_CATEGORIES: Array<{ value: RenovationCreateInput['category']; label: string }> = [
  { value: 'structural', label: 'Estrutural' },
  { value: 'electrical', label: 'Elétrica' },
  { value: 'plumbing', label: 'Hidráulica' },
  { value: 'finishing', label: 'Acabamento' },
  { value: 'layout', label: 'Layout' },
  { value: 'roofing', label: 'Cobertura' },
  { value: 'waterproofing', label: 'Impermeabilização' },
  { value: 'painting', label: 'Pintura' },
  { value: 'flooring', label: 'Piso' },
  { value: 'other', label: 'Outro' },
];

const RENOVATION_STATUSES: Array<{ value: RenovationCreateInput['status']; label: string }> = [
  { value: 'planned', label: 'Planejada' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{renovation ? 'Editar reforma' : 'Nova reforma'}</DialogTitle>
          <DialogDescription>
            Organize escopo, datas, responsável e custo da intervenção.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <PremiumFormSection title="Identificação" description="Informe nome, categoria e status da reforma.">
            <PremiumFormGrid>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="renovation-title">Título *</Label>
              <Input id="renovation-title" placeholder="Ex.: Reforma da área gourmet" {...register('title')} />
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
              <Label htmlFor="renovation-description">Descrição</Label>
              <Textarea id="renovation-description" rows={3} placeholder="Escopo, contexto técnico e áreas afetadas" {...register('description')} />
            </div>
            </PremiumFormGrid>
          </PremiumFormSection>

          <PremiumFormSection title="Cronograma e custo" description="Registre datas, contratado, custo e observações operacionais.">
            <PremiumFormGrid>
            <div className="space-y-1.5">
              <Label htmlFor="renovation-started">Início</Label>
              <Input id="renovation-started" type="date" {...register('started_at')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renovation-completed">Conclusão</Label>
              <Input id="renovation-completed" type="date" {...register('completed_at')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="renovation-contractor">Contratado</Label>
              <Input id="renovation-contractor" placeholder="Empresa ou profissional responsável" {...register('contractor_name')} />
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
              <Textarea id="renovation-notes" rows={3} placeholder="Observações operacionais, pendências ou decisões técnicas" {...register('notes')} />
            </div>
            </PremiumFormGrid>
          </PremiumFormSection>

          <PremiumFormError error={error} />

          <PremiumFormActions
            submitting={submitting}
            submitLabel={renovation ? 'Salvar alterações' : 'Criar'}
            onCancel={() => onOpenChange(false)}
          />
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
