'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { handoverPackageCreateSchema } from '@houselog/contracts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { HandoverPackage, HandoverPackageCreateInput } from '@/lib/api';

const PACKAGE_TYPES: Array<{ value: HandoverPackageCreateInput['type']; label: string }> = [
  { value: 'handover', label: 'Entrega tecnica' },
  { value: 'move_in', label: 'Entrada' },
  { value: 'move_out', label: 'Saida' },
  { value: 'inspection', label: 'Vistoria' },
];

const PACKAGE_STATUSES: Array<{ value: HandoverPackageCreateInput['status']; label: string }> = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'in_review', label: 'Em revisao' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'completed', label: 'Concluido' },
  { value: 'archived', label: 'Arquivado' },
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
    formState: { errors },
  } = useForm<HandoverPackageCreateInput>({
    resolver: zodResolver(handoverPackageCreateSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (!open) return;
    reset(pkg ? toFormValues(pkg) : DEFAULT_VALUES);
  }, [open, reset, pkg]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{pkg ? 'Editar dossie' : 'Novo dossie de entrega'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pkg-title">Titulo *</Label>
              <Input id="pkg-title" placeholder="Ex.: Entrega tecnica — Apto 42" {...register('title')} />
              {errors.title && <p className="text-xs text-text-danger">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select
                defaultValue={pkg?.type ?? DEFAULT_VALUES.type}
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
                defaultValue={pkg?.status ?? DEFAULT_VALUES.status}
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
              <Label htmlFor="pkg-version">Versao *</Label>
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
              <Label htmlFor="pkg-completed-at">Data de conclusao</Label>
              <Input id="pkg-completed-at" type="date" {...register('completed_at')} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pkg-description">Descricao</Label>
              <Textarea
                id="pkg-description"
                rows={3}
                placeholder="Contexto tecnico, escopo e observacoes gerais do dossie"
                {...register('description')}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pkg-notes">Notas</Label>
              <Textarea
                id="pkg-notes"
                rows={3}
                placeholder="Observacoes internas, pendencias ou informacoes adicionais"
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
              {pkg ? 'Salvar alteracoes' : 'Criar dossie'}
            </Button>
          </div>
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
