'use client';

import { use, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  CheckCircle2,
  Layers3,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth-context';
import {
  technicalSystemsApi,
  type CreateTechnicalSystemInput,
  type TechnicalSystem,
  type TechnicalSystemStatus,
  type TechnicalSystemType,
} from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';

const SYSTEM_TYPES: Array<{ value: TechnicalSystemType; label: string }> = [
  { value: 'electrical', label: 'Eletrica' },
  { value: 'plumbing', label: 'Hidraulica' },
  { value: 'sewage', label: 'Esgoto' },
  { value: 'gas', label: 'Gas' },
  { value: 'hvac', label: 'Climatizacao' },
  { value: 'solar', label: 'Energia solar' },
  { value: 'automation', label: 'Automacao' },
  { value: 'network', label: 'Rede' },
  { value: 'pool', label: 'Piscina' },
  { value: 'irrigation', label: 'Irrigacao' },
  { value: 'security', label: 'Seguranca' },
  { value: 'fire', label: 'Incendio' },
  { value: 'waterproofing', label: 'Impermeabilizacao' },
  { value: 'roofing', label: 'Cobertura' },
  { value: 'structural', label: 'Estrutural' },
  { value: 'finishes', label: 'Acabamentos' },
  { value: 'custom', label: 'Personalizado' },
];

const STATUS_OPTIONS: Array<{ value: TechnicalSystemStatus; label: string }> = [
  { value: 'active', label: 'Ativo' },
  { value: 'attention', label: 'Atenção' },
  { value: 'critical', label: 'Critico' },
  { value: 'inactive', label: 'Inativo' },
  { value: 'replaced', label: 'Substituido' },
];

const STATUS_STYLES: Record<TechnicalSystemStatus, string> = {
  active: 'bg-bg-success text-text-success',
  attention: 'bg-bg-warning text-text-warning',
  critical: 'bg-bg-danger text-text-danger',
  inactive: 'bg-bg-subtle text-text-secondary',
  replaced: 'bg-bg-accent-subtle text-text-accent',
};

type SystemFormState = {
  name: string;
  type: TechnicalSystemType;
  description: string;
  location_summary: string;
  installation_date: string;
  last_inspection_at: string;
  status: TechnicalSystemStatus;
};

const DEFAULT_FORM: SystemFormState = {
  name: '',
  type: 'electrical',
  description: '',
  location_summary: '',
  installation_date: '',
  last_inspection_at: '',
  status: 'active',
};

function typeLabel(type: TechnicalSystemType): string {
  return SYSTEM_TYPES.find((item) => item.value === type)?.label ?? type;
}

function statusLabel(status: TechnicalSystemStatus): string {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

function toForm(system: TechnicalSystem): SystemFormState {
  return {
    name: system.name,
    type: system.type,
    description: system.description ?? '',
    location_summary: system.location_summary ?? '',
    installation_date: system.installation_date ?? '',
    last_inspection_at: system.last_inspection_at ?? '',
    status: system.status,
  };
}

function toPayload(form: SystemFormState): CreateTechnicalSystemInput {
  return {
    name: form.name.trim(),
    type: form.type,
    description: form.description.trim() || null,
    location_summary: form.location_summary.trim() || null,
    installation_date: form.installation_date || null,
    last_inspection_at: form.last_inspection_at || null,
    status: form.status,
  };
}

export default function PropertySystemsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingSystem, setEditingSystem] = useState<TechnicalSystem | null>(null);
  const [form, setForm] = useState<SystemFormState>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(['technical-systems', id], () =>
    technicalSystemsApi.list(id)
  );

  const systems = useMemo(() => data?.systems ?? [], [data?.systems]);
  const canManage = user?.role !== 'provider' && user?.role !== 'temp_provider';

  const statusCounts = useMemo(() => {
    return systems.reduce<Record<TechnicalSystemStatus, number>>(
      (acc, system) => {
        acc[system.status] += 1;
        return acc;
      },
      { active: 0, attention: 0, critical: 0, inactive: 0, replaced: 0 }
    );
  }, [systems]);

  function openCreate() {
    setEditingSystem(null);
    setForm(DEFAULT_FORM);
    setFormOpen(true);
  }

  function openEdit(system: TechnicalSystem) {
    setEditingSystem(system);
    setForm(toForm(system));
    setFormOpen(true);
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = toPayload(form);

    if (!payload.name) {
      toast.error('Informe o nome do sistema.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSystem) {
        await technicalSystemsApi.update(id, editingSystem.id, payload);
        toast.success('Sistema técnico atualizado.');
      } else {
        await technicalSystemsApi.create(id, payload);
        toast.success('Sistema técnico cadastrado.');
      }
      await mutate();
      setFormOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar o sistema.';
      toast.error('Erro ao salvar sistema', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function removeSystem(system: TechnicalSystem) {
    if (!window.confirm(`Remover "${system.name}" do prontuario tecnico?`)) return;
    setDeletingId(system.id);
    try {
      await technicalSystemsApi.delete(id, system.id);
      await mutate();
      toast.success('Sistema técnico removido.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível remover o sistema.';
      toast.error('Erro ao remover sistema', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Sistemas tecnicos"
        title="Sistemas"
        description="Infraestrutura tecnica do imovel organizada por tipo, localizacao, estado operacional e historico de inspeção."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Adicionar sistema
            </Button>
          ) : null
        }
      />

      <PageSection
        title="Leitura operacional"
        description="Resumo da base tecnica cadastrada para este imovel."
        tone="strong"
        density="compact"
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-3">
            <p className="text-xs text-text-tertiary">Sistemas cadastrados</p>
            <p className="mt-1 text-2xl font-light tabular-nums text-text-primary">{systems.length}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-bg-warning px-3 py-3">
            <p className="text-xs text-text-tertiary">Em atenção</p>
            <p className="mt-1 text-2xl font-light tabular-nums text-text-warning">
              {statusCounts.attention + statusCounts.critical}
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] bg-bg-success px-3 py-3">
            <p className="text-xs text-text-tertiary">Ativos</p>
            <p className="mt-1 text-2xl font-light tabular-nums text-text-success">{statusCounts.active}</p>
          </div>
        </div>
      </PageSection>

      {isLoading && (
        <div className="grid gap-3 md:grid-cols-2">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="hl-skeleton h-40 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <EmptyState
          icon={<ShieldAlert className="h-6 w-6" aria-hidden="true" />}
          title="Não foi possível carregar os sistemas técnicos"
          description={error instanceof Error ? error.message : 'Tente novamente em instantes.'}
          actions={<Button variant="outline" onClick={() => void mutate()}>Tentar novamente</Button>}
          tone="strong"
          density="spacious"
        />
      )}

      {!isLoading && !error && systems.length === 0 && (
        <EmptyState
          icon={<Layers3 className="h-6 w-6" aria-hidden="true" />}
          title="Nenhum sistema técnico cadastrado ainda."
          description="Cadastre elétrica, hidráulica, automação, cobertura, segurança e demais sistemas para iniciar o prontuário técnico premium."
          actions={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar primeiro sistema
              </Button>
            ) : null
          }
          tone="subtle"
          density="spacious"
        />
      )}

      {!isLoading && !error && systems.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {systems.map((system) => {
            const needsAttention = system.status === 'attention' || system.status === 'critical';
            return (
              <article
                key={system.id}
                className="rounded-[var(--radius-xl)] border border-border-subtle bg-bg-surface p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn('border-0', STATUS_STYLES[system.status])}>
                        {statusLabel(system.status)}
                      </Badge>
                      <span className="text-xs font-medium text-text-tertiary">{typeLabel(system.type)}</span>
                    </div>
                    <h2 className="mt-3 text-base font-medium leading-tight text-text-primary">{system.name}</h2>
                    {system.description && (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">{system.description}</p>
                    )}
                  </div>
                  {needsAttention ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-text-warning" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-text-success" aria-hidden="true" />
                  )}
                </div>

                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
                    <dt className="text-xs text-text-tertiary">Localização</dt>
                    <dd className="mt-0.5 text-text-secondary">
                      {system.location_summary || 'Localização não informada'}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
                      <dt className="text-xs text-text-tertiary">Instalação</dt>
                      <dd className="mt-0.5 text-text-secondary">
                        {system.installation_date ? formatDate(system.installation_date) : 'Não informada'}
                      </dd>
                    </div>
                    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
                      <dt className="text-xs text-text-tertiary">Última inspeção</dt>
                      <dd className="mt-0.5 text-text-secondary">
                        {system.last_inspection_at ? formatDate(system.last_inspection_at) : 'Sem inspeção'}
                      </dd>
                    </div>
                  </div>
                </dl>

                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(system)}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-text-danger hover:bg-bg-danger"
                      loading={deletingId === system.id}
                      onClick={() => void removeSystem(system)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remover
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSystem ? 'Editar sistema técnico' : 'Adicionar sistema técnico'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="system-name">Nome</Label>
                <Input
                  id="system-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Quadro eletrico principal"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) => setForm((current) => ({ ...current, type: value as TechnicalSystemType }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm((current) => ({ ...current, status: value as TechnicalSystemStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="system-location">Localização resumida</Label>
                <Input
                  id="system-location"
                  value={form.location_summary}
                  onChange={(event) => setForm((current) => ({ ...current, location_summary: event.target.value }))}
                  placeholder="Ex.: pavimento térreo, casa de máquinas, shaft norte"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="system-installation">Data de instalação</Label>
                <Input
                  id="system-installation"
                  type="date"
                  value={form.installation_date}
                  onChange={(event) => setForm((current) => ({ ...current, installation_date: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="system-inspection">Última inspeção</Label>
                <Input
                  id="system-inspection"
                  type="date"
                  value={form.last_inspection_at}
                  onChange={(event) => setForm((current) => ({ ...current, last_inspection_at: event.target.value }))}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="system-description">Descrição</Label>
                <Textarea
                  id="system-description"
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Resumo técnico, observações relevantes e contexto operacional."
                  rows={4}
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={submitting}>
                {editingSystem ? 'Salvar alterações' : 'Adicionar sistema'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
