'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { handoverPackageCreateSchema } from '@houselog/contracts';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PremiumFormActions, PremiumFormError, PremiumFormGrid, PremiumFormSection } from './premium-form-layout';
import type { HandoverPackage, HandoverPackageCreateInput } from '@/lib/api';

const PACKAGE_TYPES: Array<{ value: HandoverPackageCreateInput['type']; label: string }> = [
  { value: 'handover', label: 'Entrega técnica' },
  { value: 'move_in', label: 'Entrada' },
  { value: 'move_out', label: 'Saída' },
  { value: 'inspection', label: 'Vistoria' },
];

const PACKAGE_STATUSES: Array<{ value: HandoverPackageCreateInput['status']; label: string }> = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'in_review', label: 'Em revisão' },
  { value: 'ready_to_issue', label: 'Pronto para emissão' },
  { value: 'issued', label: 'Emitido' },
  { value: 'accepted', label: 'Aceito' },
  { value: 'revoked', label: 'Revogado' },
  { value: 'expired', label: 'Expirado' },
];

const DEFAULT_VALUES: HandoverPackageCreateInput = {
  title: '',
  description: null,
  type: 'handover',
  status: 'draft',
  version: 1,
  notes: null,
  completed_at: null,
};

type HandoverPackageFormDialogProps = {
  open: boolean;
  pkg: HandoverPackage | null;
  submitting: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: HandoverPackageCreateInput) => Promise<void>;
};

export function HandoverPackageFormDialog({
  open,
  pkg,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: HandoverPackageFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<HandoverPackageCreateInput>({
    resolver: zodResolver(handoverPackageCreateSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const type = useWatch({ control, name: 'type' });
  const status = useWatch({ control, name: 'status' });

  useEffect(() => {
    if (!open) return;
    reset(pkg ? toFormValues(pkg) : DEFAULT_VALUES);
  }, [open, reset, pkg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pkg ? 'Editar dossiê' : 'Novo dossiê de entrega'}</DialogTitle>
          <DialogDescription>
            Estruture o dossiê de entrega, vistoria ou movimentação do imóvel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <PremiumFormSection title="Identificação" description="Informe título, tipo, status e versão do dossiê.">
            <PremiumFormGrid>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pkg-title">Título *</Label>
                <Input id="pkg-title" placeholder="Ex.: Entrega técnica - Apto 42" {...register('title')} />
                {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={type ?? DEFAULT_VALUES.type}
                  onValueChange={(value) => setValue('type', value as HandoverPackageCreateInput['type'], { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status *</Label>
                <Select
                  value={status ?? DEFAULT_VALUES.status}
                  onValueChange={(value) => setValue('status', value as HandoverPackageCreateInput['status'], { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGE_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-version">Versão *</Label>
                <Input
                  id="pkg-version"
                  type="number"
                  min={1}
                  step={1}
                  {...register('version', { valueAsNumber: true })}
                />
                {errors.version && <p className="text-xs text-text-danger">{errors.version.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pkg-completed-at">Data de conclusão</Label>
                <Input id="pkg-completed-at" type="date" {...register('completed_at')} />
              </div>
            </PremiumFormGrid>
          </PremiumFormSection>

          <PremiumFormSection title="Contexto" description="Descreva escopo técnico, observações e pendências do dossiê.">
            <PremiumFormGrid>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pkg-description">Descrição</Label>
                <Textarea
                  id="pkg-description"
                  rows={3}
                  placeholder="Contexto técnico, escopo e observações gerais do dossiê"
                  {...register('description')}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="pkg-notes">Notas</Label>
                <Textarea
                  id="pkg-notes"
                  rows={3}
                  placeholder="Observações internas, pendências ou informações adicionais"
                  {...register('notes')}
                />
              </div>
            </PremiumFormGrid>
          </PremiumFormSection>

          <PremiumFormError error={error} />

          <PremiumFormActions
            submitting={submitting}
            submitLabel={pkg ? 'Salvar alterações' : 'Criar'}
            onCancel={() => onOpenChange(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toFormValues(pkg: HandoverPackage): HandoverPackageCreateInput {
  return {
    title: pkg.title,
    description: pkg.description,
    type: pkg.type,
    status: pkg.status,
    version: pkg.version,
    notes: pkg.notes,
    completed_at: pkg.completed_at,
  };
}
