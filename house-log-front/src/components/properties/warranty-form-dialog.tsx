'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { warrantyCreateSchema } from '@houselog/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Warranty, WarrantyCreateInput } from '@/lib/api';

const WARRANTY_TYPES: Array<{ value: WarrantyCreateInput['warranty_type']; label: string }> = [
  { value: 'service', label: 'Servico' },
  { value: 'equipment', label: 'Equipamento' },
  { value: 'material', label: 'Material' },
  { value: 'structural', label: 'Estrutural' },
  { value: 'appliance', label: 'Eletro' },
  { value: 'finish', label: 'Acabamento' },
  { value: 'other', label: 'Outro' },
];

const WARRANTY_STATUSES: Array<{ value: WarrantyCreateInput['status']; label: string }> = [
  { value: 'active', label: 'Ativa' },
  { value: 'expired', label: 'Vencida' },
  { value: 'claimed', label: 'Acionada' },
  { value: 'void', label: 'Invalidada' },
];

const DEFAULT_VALUES: WarrantyCreateInput = {
  title: '',
  warranty_type: 'service',
  status: 'active',
  provider_name: null,
  start_date: null,
  end_date: '',
  coverage: null,
  description: null,
  exclusions: null,
};

type WarrantyFormDialogProps = {
  open: boolean;
  warranty: Warranty | null;
  submitting: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: WarrantyCreateInput) => Promise<void>;
};

export function WarrantyFormDialog({
  open,
  warranty,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: WarrantyFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<WarrantyCreateInput>({
    resolver: zodResolver(warrantyCreateSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const warrantyType = useWatch({ control, name: 'warranty_type' });
  const status = useWatch({ control, name: 'status' });

  useEffect(() => {
    if (!open) return;
    reset(warranty ? toFormValues(warranty) : DEFAULT_VALUES);
  }, [open, reset, warranty]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{warranty ? 'Editar garantia' : 'Nova garantia'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="warranty-title">Titulo *</Label>
              <Input id="warranty-title" placeholder="Ex.: Garantia do sistema de ar condicionado" {...register('title')} />
              {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                value={warrantyType ?? DEFAULT_VALUES.warranty_type}
                onValueChange={(value) => setValue('warranty_type', value as WarrantyCreateInput['warranty_type'], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WARRANTY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status *</Label>
              <Select
                value={status ?? DEFAULT_VALUES.status}
                onValueChange={(value) => setValue('status', value as WarrantyCreateInput['status'], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WARRANTY_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="warranty-provider">Fornecedor</Label>
              <Input id="warranty-provider" placeholder="Empresa, profissional ou fabricante" {...register('provider_name')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="warranty-start">Inicio</Label>
              <Input id="warranty-start" type="date" {...register('start_date')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="warranty-end">Fim *</Label>
              <Input id="warranty-end" type="date" {...register('end_date')} />
              {errors.end_date && <p className="text-xs text-text-danger">{errors.end_date.message}</p>}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="warranty-coverage">Cobertura</Label>
              <Textarea id="warranty-coverage" rows={3} placeholder="Resumo objetivo do que esta coberto" {...register('coverage')} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="warranty-description">Descricao</Label>
              <Textarea id="warranty-description" rows={3} placeholder="Contexto tecnico, fornecedor, escopo e observacoes" {...register('description')} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="warranty-exclusions">Exclusoes</Label>
              <Textarea id="warranty-exclusions" rows={3} placeholder="Condicoes nao cobertas ou restricoes relevantes" {...register('exclusions')} />
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
              {warranty ? 'Salvar alteracoes' : 'Criar garantia'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toFormValues(warranty: Warranty): WarrantyCreateInput {
  return {
    room_id: warranty.room_id,
    service_order_id: warranty.service_order_id,
    document_id: warranty.document_id,
    inventory_item_id: warranty.inventory_item_id,
    title: warranty.title,
    warranty_type: warranty.warranty_type,
    status: warranty.status,
    provider_name: warranty.provider_name,
    start_date: warranty.start_date,
    end_date: warranty.end_date,
    coverage: warranty.coverage,
    description: warranty.description,
    exclusions: warranty.exclusions,
  };
}
