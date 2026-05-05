'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FolderKanban,
  PackageCheck,
  Pencil,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  handoverChecklistApi,
  handoverPackagesApi,
  renovationsApi,
  warrantiesApi,
  type HandoverChecklistItem,
  type HandoverChecklistItemCreateInput,
  type HandoverPackage,
  type HandoverPackageCreateInput,
  type Renovation,
  type RenovationCreateInput,
  type Warranty,
  type WarrantyCreateInput,
} from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { HandoverChecklistItemFormDialog } from './handover-checklist-item-form-dialog';
import { HandoverPackageFormDialog } from './handover-package-form-dialog';
import { RenovationFormDialog } from './renovation-form-dialog';
import { WarrantyFormDialog } from './warranty-form-dialog';

const WARRANTY_TYPE_LABELS: Record<string, string> = {
  service: 'Servico',
  equipment: 'Equipamento',
  material: 'Material',
  structural: 'Estrutural',
  appliance: 'Eletro',
  finish: 'Acabamento',
  other: 'Outro',
};

const WARRANTY_STATUS_LABELS: Record<string, string> = {
  active: 'Ativa',
  expired: 'Vencida',
  claimed: 'Acionada',
  void: 'Invalidada',
};

const RENOVATION_CATEGORY_LABELS: Record<string, string> = {
  structural: 'Estrutural',
  electrical: 'Eletrica',
  plumbing: 'Hidraulica',
  finishing: 'Acabamento',
  layout: 'Layout',
  roofing: 'Cobertura',
  waterproofing: 'Impermeabilizacao',
  painting: 'Pintura',
  flooring: 'Piso',
  other: 'Outro',
};

const RENOVATION_STATUS_LABELS: Record<string, string> = {
  planned: 'Planejada',
  in_progress: 'Em andamento',
  completed: 'Concluida',
  cancelled: 'Cancelada',
};

const HANDOVER_TYPE_LABELS: Record<string, string> = {
  handover: 'Entrega tecnica',
  move_in: 'Entrada',
  move_out: 'Saida',
  inspection: 'Vistoria',
};

const HANDOVER_STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  in_review: 'Em revisao',
  approved: 'Aprovado',
  completed: 'Concluido',
  archived: 'Arquivado',
};

const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  keys: 'Chaves',
  documents: 'Documentos',
  utilities: 'Utilidades',
  inventory: 'Inventario',
  cleaning: 'Limpeza',
  maintenance: 'Manutencao',
  safety: 'Seguranca',
  general: 'Geral',
};

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  done: 'Concluido',
  issue: 'Pendencia',
  not_applicable: 'Nao aplicavel',
};

const CHECKLIST_STATUS_OPTIONS: Array<{ value: HandoverChecklistItem['status']; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'done', label: 'Concluido' },
  { value: 'issue', label: 'Pendencia' },
  { value: 'not_applicable', label: 'Nao aplicavel' },
];

const STATUS_TONE: Record<string, string> = {
  active: 'bg-bg-success text-text-success',
  expired: 'bg-bg-subtle text-text-secondary',
  claimed: 'bg-bg-warning text-text-warning',
  void: 'bg-bg-danger text-text-danger',
  planned: 'bg-bg-subtle text-text-secondary',
  in_progress: 'bg-bg-accent-subtle text-text-accent',
  completed: 'bg-bg-success text-text-success',
  cancelled: 'bg-bg-danger text-text-danger',
  draft: 'bg-bg-subtle text-text-secondary',
  in_review: 'bg-bg-warning text-text-warning',
  approved: 'bg-bg-accent-subtle text-text-accent',
  archived: 'bg-bg-subtle text-text-tertiary',
  pending: 'bg-bg-subtle text-text-secondary',
  done: 'bg-bg-success text-text-success',
  issue: 'bg-bg-danger text-text-danger',
  not_applicable: 'bg-bg-subtle text-text-tertiary',
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge className={cn('border-0 text-xs', STATUS_TONE[status] ?? 'bg-bg-subtle text-text-secondary')}>{label}</Badge>;
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[...Array(4)].map((_, index) => (
        <div key={index} className="hl-skeleton h-40 rounded-[var(--radius-xl)]" />
      ))}
    </div>
  );
}

function ErrorState({ title, description, onRetry }: { title: string; description?: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<ShieldAlert className="h-6 w-6" aria-hidden="true" />}
      title={title}
      description={description ?? 'Tente novamente em instantes.'}
      actions={<Button variant="outline" onClick={onRetry}>Tentar novamente</Button>}
      tone="strong"
      density="spacious"
    />
  );
}

function SummaryText({ children }: { children: React.ReactNode }) {
  return <p className="line-clamp-2 text-sm leading-6 text-text-secondary">{children}</p>;
}

export function PropertyWarrantiesReadonly({ propertyId }: { propertyId: string }) {
  const { data, error, isLoading, mutate } = useSWR(['warranties', propertyId], () =>
    warrantiesApi.list(propertyId)
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingWarranty, setEditingWarranty] = useState<Warranty | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const warranties = data?.warranties ?? [];
  const activeCount = warranties.filter((warranty) => warranty.status === 'active').length;
  const expiredCount = warranties.filter((warranty) => warranty.status === 'expired').length;

  function openCreate() {
    setEditingWarranty(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(warranty: Warranty) {
    setEditingWarranty(warranty);
    setFormError(null);
    setFormOpen(true);
  }

  async function submitWarranty(input: WarrantyCreateInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingWarranty) {
        await warrantiesApi.update(propertyId, editingWarranty.id, input);
        toast.success('Garantia atualizada.');
      } else {
        await warrantiesApi.create(propertyId, input);
        toast.success('Garantia criada.');
      }
      await mutate();
      setFormOpen(false);
      setEditingWarranty(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel salvar a garantia.';
      setFormError(message);
      toast.error('Erro ao salvar garantia', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteWarranty(warranty: Warranty) {
    if (!window.confirm(`Excluir "${warranty.title}" do prontuario de garantias?`)) return;
    setDeletingId(warranty.id);
    try {
      await warrantiesApi.delete(propertyId, warranty.id);
      await mutate();
      toast.success('Garantia excluida.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel excluir a garantia.';
      toast.error('Erro ao excluir garantia', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Prontuario tecnico"
        title="Garantias"
        description="Garantias de servicos, equipamentos, materiais e acabamentos vinculadas ao historico tecnico do imovel."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova garantia
          </Button>
        }
      />

      <PageSection title="Leitura de garantias" description="Controle inicial read-only para prazos, fornecedores e cobertura." tone="strong" density="compact">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricBox label="Garantias" value={warranties.length} />
          <MetricBox label="Ativas" value={activeCount} tone="success" />
          <MetricBox label="Vencidas" value={expiredCount} tone={expiredCount > 0 ? 'warning' : 'default'} />
        </div>
      </PageSection>

      {isLoading && <LoadingGrid />}
      {!isLoading && error && (
        <ErrorState
          title="Nao foi possivel carregar as garantias"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => void mutate()}
        />
      )}
      {!isLoading && !error && warranties.length === 0 && (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}
          title="Nenhuma garantia registrada ainda"
          description="Quando garantias tecnicas forem cadastradas, elas aparecerao aqui com prazos, fornecedor e cobertura resumida."
          actions={
            <Button variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar primeira garantia
            </Button>
          }
          tone="subtle"
          density="spacious"
        />
      )}
      {!isLoading && !error && warranties.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {warranties.map((warranty) => (
            <WarrantyCard
              key={warranty.id}
              warranty={warranty}
              deleting={deletingId === warranty.id}
              onEdit={openEdit}
              onDelete={deleteWarranty}
            />
          ))}
        </div>
      )}

      <WarrantyFormDialog
        open={formOpen}
        warranty={editingWarranty}
        submitting={submitting}
        error={formError}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingWarranty(null);
            setFormError(null);
          }
        }}
        onSubmit={submitWarranty}
      />
    </div>
  );
}

function WarrantyCard({
  warranty,
  deleting,
  onEdit,
  onDelete,
}: {
  warranty: Warranty;
  deleting: boolean;
  onEdit: (warranty: Warranty) => void;
  onDelete: (warranty: Warranty) => void;
}) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-border-subtle bg-bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={warranty.status} label={WARRANTY_STATUS_LABELS[warranty.status] ?? warranty.status} />
            <span className="text-xs font-medium text-text-tertiary">
              {WARRANTY_TYPE_LABELS[warranty.warranty_type] ?? warranty.warranty_type}
            </span>
          </div>
          <h2 className="mt-3 text-base font-medium leading-tight text-text-primary">{warranty.title}</h2>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-text-success" aria-hidden="true" />
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <InfoCell label="Inicio" value={formatDate(warranty.start_date)} />
          <InfoCell label="Fim" value={formatDate(warranty.end_date)} />
        </div>
        <InfoCell label="Fornecedor" value={warranty.provider_name || 'Nao informado'} />
        <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
          <dt className="text-xs text-text-tertiary">Cobertura</dt>
          <dd className="mt-1">
            <SummaryText>{warranty.coverage || warranty.description || 'Cobertura nao informada.'}</SummaryText>
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(warranty)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-danger hover:bg-bg-danger"
          loading={deleting}
          onClick={() => void onDelete(warranty)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Excluir
        </Button>
      </div>
    </article>
  );
}

export function PropertyRenovationsReadonly({ propertyId }: { propertyId: string }) {
  const { data, error, isLoading, mutate } = useSWR(['renovations', propertyId], () =>
    renovationsApi.list(propertyId)
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingRenovation, setEditingRenovation] = useState<Renovation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const renovations = data?.renovations ?? [];
  const completedCount = renovations.filter((renovation) => renovation.status === 'completed').length;
  const inProgressCount = renovations.filter((renovation) => renovation.status === 'in_progress').length;
  const totalCost = renovations.reduce((sum, renovation) => sum + (renovation.cost ?? 0), 0);

  function openCreate() {
    setEditingRenovation(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(renovation: Renovation) {
    setEditingRenovation(renovation);
    setFormError(null);
    setFormOpen(true);
  }

  async function submitRenovation(input: RenovationCreateInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingRenovation) {
        await renovationsApi.update(propertyId, editingRenovation.id, input);
        toast.success('Reforma atualizada.');
      } else {
        await renovationsApi.create(propertyId, input);
        toast.success('Reforma criada.');
      }
      await mutate();
      setFormOpen(false);
      setEditingRenovation(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel salvar a reforma.';
      setFormError(message);
      toast.error('Erro ao salvar reforma', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRenovation(renovation: Renovation) {
    if (!window.confirm(`Excluir "${renovation.title}" do historico de reformas?`)) return;
    setDeletingId(renovation.id);
    try {
      await renovationsApi.delete(propertyId, renovation.id);
      await mutate();
      toast.success('Reforma excluida.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel excluir a reforma.';
      toast.error('Erro ao excluir reforma', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Historico premium"
        title="Reformas"
        description="Registro read-only de reformas e intervencoes tecnicas que alteram a memoria tecnica do imovel."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova reforma
          </Button>
        }
      />

      <PageSection title="Leitura das intervencoes" description="Resumo operacional de status, custo e execucao." tone="strong" density="compact">
        <div className="grid gap-2 sm:grid-cols-4">
          <MetricBox label="Reformas" value={renovations.length} />
          <MetricBox label="Em andamento" value={inProgressCount} tone={inProgressCount > 0 ? 'accent' : 'default'} />
          <MetricBox label="Concluidas" value={completedCount} tone="success" />
          <MetricBox label="Custo registrado" value={formatCurrency(totalCost)} />
        </div>
      </PageSection>

      {isLoading && <LoadingGrid />}
      {!isLoading && error && (
        <ErrorState
          title="Nao foi possivel carregar as reformas"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => void mutate()}
        />
      )}
      {!isLoading && !error && renovations.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" aria-hidden="true" />}
          title="Nenhuma reforma registrada ainda"
          description="Reformas, obras e intervencoes tecnicas aparecerao aqui com periodo, contratado, categoria e custo."
          actions={
            <Button variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar primeira reforma
            </Button>
          }
          tone="subtle"
          density="spacious"
        />
      )}
      {!isLoading && !error && renovations.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {renovations.map((renovation) => (
            <RenovationCard
              key={renovation.id}
              renovation={renovation}
              deleting={deletingId === renovation.id}
              onEdit={openEdit}
              onDelete={deleteRenovation}
            />
          ))}
        </div>
      )}

      <RenovationFormDialog
        open={formOpen}
        renovation={editingRenovation}
        submitting={submitting}
        error={formError}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingRenovation(null);
            setFormError(null);
          }
        }}
        onSubmit={submitRenovation}
      />
    </div>
  );
}

function RenovationCard({
  renovation,
  deleting,
  onEdit,
  onDelete,
}: {
  renovation: Renovation;
  deleting: boolean;
  onEdit: (renovation: Renovation) => void;
  onDelete: (renovation: Renovation) => void;
}) {
  return (
    <article className="rounded-[var(--radius-xl)] border border-border-subtle bg-bg-surface p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={renovation.status} label={RENOVATION_STATUS_LABELS[renovation.status] ?? renovation.status} />
            <span className="text-xs font-medium text-text-tertiary">
              {RENOVATION_CATEGORY_LABELS[renovation.category] ?? renovation.category}
            </span>
          </div>
          <h2 className="mt-3 text-base font-medium leading-tight text-text-primary">{renovation.title}</h2>
          {renovation.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">{renovation.description}</p>}
        </div>
        <FolderKanban className="h-5 w-5 shrink-0 text-text-accent" aria-hidden="true" />
      </div>

      <dl className="mt-4 grid gap-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <InfoCell label="Inicio" value={formatDate(renovation.started_at)} />
          <InfoCell label="Conclusao" value={formatDate(renovation.completed_at)} />
        </div>
        <InfoCell label="Contratado" value={renovation.contractor_name || 'Nao informado'} />
        <InfoCell label="Custo" value={renovation.cost != null ? formatCurrency(renovation.cost) : 'Nao informado'} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onEdit(renovation)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-text-danger hover:bg-bg-danger"
          loading={deleting}
          onClick={() => void onDelete(renovation)}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Excluir
        </Button>
      </div>
    </article>
  );
}

export function PropertyHandoverReadonly({ propertyId }: { propertyId: string }) {
  const { data, error, isLoading, mutate } = useSWR(['handover-packages', propertyId], () =>
    handoverPackagesApi.list(propertyId)
  );
  const packages = useMemo(() => data?.packages ?? [], [data?.packages]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const selectedPackage = packages.find((pkg) => pkg.id === selectedPackageId) ?? packages[0] ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<HandoverPackage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditingPkg(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(pkg: HandoverPackage) {
    setEditingPkg(pkg);
    setFormError(null);
    setFormOpen(true);
  }

  async function submitPackage(input: HandoverPackageCreateInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingPkg) {
        await handoverPackagesApi.update(propertyId, editingPkg.id, input);
        toast.success('Dossie atualizado.');
      } else {
        const result = await handoverPackagesApi.create(propertyId, input);
        setSelectedPackageId(result.package.id);
        toast.success('Dossie criado.');
      }
      await mutate();
      setFormOpen(false);
      setEditingPkg(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel salvar o dossie.';
      setFormError(message);
      toast.error('Erro ao salvar dossie', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function deletePackage(pkg: HandoverPackage) {
    if (!window.confirm(`Excluir "${pkg.title}" do historico de handover?`)) return;
    setDeletingId(pkg.id);
    try {
      await handoverPackagesApi.delete(propertyId, pkg.id);
      if (selectedPackageId === pkg.id) setSelectedPackageId(null);
      await mutate();
      toast.success('Dossie excluido.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel excluir o dossie.';
      toast.error('Erro ao excluir dossie', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Dossie tecnico"
        title="Handover"
        description="Pacotes de entrega tecnica e checklist para vistoria, pendencias e validacao do imovel."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo dossie
          </Button>
        }
      />

      {isLoading && <LoadingGrid />}
      {!isLoading && error && (
        <ErrorState
          title="Nao foi possivel carregar os dossies"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => void mutate()}
        />
      )}
      {!isLoading && !error && packages.length === 0 && (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
          title="Nenhum pacote de entrega registrado ainda"
          description="Quando houver dossies de entrega, vistoria, entrada ou saida, eles aparecerao aqui com progresso do checklist."
          actions={
            <Button variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Criar primeiro dossie
            </Button>
          }
          tone="subtle"
          density="spacious"
        />
      )}
      {!isLoading && !error && packages.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <PageSection title="Pacotes" description="Selecione um dossie para ver o checklist." tone="surface" density="compact">
            <div className="space-y-2">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={cn(
                    'group relative w-full rounded-[var(--radius-xl)] border border-border-subtle bg-bg-surface p-4 text-left transition-colors hover:bg-bg-subtle',
                    selectedPackage?.id === pkg.id && 'border-border-focus bg-bg-accent-subtle'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPackageId(pkg.id)}
                    className="absolute inset-0 rounded-[var(--radius-xl)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
                    aria-label={pkg.title}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={pkg.status} label={HANDOVER_STATUS_LABELS[pkg.status] ?? pkg.status} />
                        <span className="text-xs font-medium text-text-tertiary">{HANDOVER_TYPE_LABELS[pkg.type] ?? pkg.type}</span>
                      </div>
                      <p className="mt-3 text-sm font-medium text-text-primary">{pkg.title}</p>
                      {pkg.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{pkg.description}</p>}
                    </div>
                    <div className="relative z-10 flex shrink-0 items-center gap-1">
                      <span className="mr-1 text-xs text-text-tertiary">v{pkg.version}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar dossie"
                        onClick={() => openEdit(pkg)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir dossie"
                        loading={deletingId === pkg.id}
                        onClick={() => void deletePackage(pkg)}
                      >
                        <Trash2 className="h-4 w-4 text-text-danger" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </PageSection>

          {selectedPackage && <ChecklistPanel propertyId={propertyId} handoverPackage={selectedPackage} />}
        </div>
      )}

      <HandoverPackageFormDialog
        open={formOpen}
        pkg={editingPkg}
        submitting={submitting}
        error={formError}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingPkg(null);
            setFormError(null);
          }
        }}
        onSubmit={submitPackage}
      />
    </div>
  );
}

function ChecklistPanel({ propertyId, handoverPackage }: { propertyId: string; handoverPackage: HandoverPackage }) {
  const { data, error, isLoading, mutate } = useSWR(['handover-checklist', propertyId, handoverPackage.id], () =>
    handoverChecklistApi.list(propertyId, handoverPackage.id)
  );
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const progress = useMemo(() => calculateChecklistProgress(items), [items]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HandoverChecklistItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  function openCreate() {
    setEditingItem(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(item: HandoverChecklistItem) {
    setEditingItem(item);
    setFormError(null);
    setFormOpen(true);
  }

  async function submitItem(input: HandoverChecklistItemCreateInput) {
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingItem) {
        await handoverChecklistApi.update(propertyId, handoverPackage.id, editingItem.id, input);
        toast.success('Item atualizado.');
      } else {
        await handoverChecklistApi.create(propertyId, handoverPackage.id, input);
        toast.success('Item criado.');
      }
      await mutate();
      setFormOpen(false);
      setEditingItem(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel salvar o item.';
      setFormError(message);
      toast.error('Erro ao salvar item', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteItem(item: HandoverChecklistItem) {
    if (!window.confirm(`Excluir "${item.title}" do checklist?`)) return;
    setDeletingId(item.id);
    try {
      await handoverChecklistApi.delete(propertyId, handoverPackage.id, item.id);
      await mutate();
      toast.success('Item excluido.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel excluir o item.';
      toast.error('Erro ao excluir item', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  async function changeItemStatus(item: HandoverChecklistItem, status: HandoverChecklistItem['status']) {
    if (item.status === status) return;
    setUpdatingStatusId(item.id);
    try {
      await handoverChecklistApi.updateStatus(propertyId, handoverPackage.id, item.id, { status });
      await mutate();
      toast.success('Status atualizado.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nao foi possivel atualizar o status.';
      toast.error('Erro ao atualizar status', { description: message });
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <>
      <PageSection
        title={handoverPackage.title}
        description="Progresso do checklist de entrega tecnica."
        tone="strong"
        density="compact"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Novo item
          </Button>
        }
      >
        {isLoading && (
          <div className="space-y-3">
            <div className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
            {[...Array(4)].map((_, index) => (
              <div key={index} className="hl-skeleton h-20 rounded-[var(--radius-xl)]" />
            ))}
          </div>
        )}
        {!isLoading && error && (
          <ErrorState
            title="Nao foi possivel carregar o checklist"
            description={error instanceof Error ? error.message : undefined}
            onRetry={() => void mutate()}
          />
        )}
        {!isLoading && !error && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <MetricBox label="Itens" value={progress.total} />
              <MetricBox label="Concluidos" value={progress.done} tone="success" />
              <MetricBox label="Pendencias" value={progress.issue} tone={progress.issue > 0 ? 'danger' : 'default'} />
              <MetricBox label="Progresso" value={`${progress.percent}%`} tone="accent" />
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-bg-subtle">
              <div className="h-full rounded-full bg-bg-accent-subtle" style={{ width: `${progress.percent}%` }} />
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon={<FileCheck2 className="h-6 w-6" aria-hidden="true" />}
                title="Checklist ainda sem itens"
                description="Os itens de vistoria, evidencias e pendencias deste pacote aparecerao aqui quando forem cadastrados."
                actions={
                  <Button variant="outline" onClick={openCreate}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Adicionar primeiro item
                  </Button>
                }
                tone="subtle"
                density="spacious"
              />
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    deleting={deletingId === item.id}
                    updatingStatus={updatingStatusId === item.id}
                    onEdit={openEdit}
                    onDelete={deleteItem}
                    onStatusChange={changeItemStatus}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </PageSection>

      <HandoverChecklistItemFormDialog
        open={formOpen}
        item={editingItem}
        submitting={submitting}
        error={formError}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) {
            setEditingItem(null);
            setFormError(null);
          }
        }}
        onSubmit={submitItem}
      />
    </>
  );
}

function ChecklistItemRow({
  item,
  deleting,
  updatingStatus,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  item: HandoverChecklistItem;
  deleting: boolean;
  updatingStatus: boolean;
  onEdit: (item: HandoverChecklistItem) => void;
  onDelete: (item: HandoverChecklistItem) => void;
  onStatusChange: (item: HandoverChecklistItem, status: HandoverChecklistItem['status']) => void;
}) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-border-subtle bg-bg-surface px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={item.status}
              disabled={updatingStatus || deleting}
              onValueChange={(value) => onStatusChange(item, value as HandoverChecklistItem['status'])}
            >
              <SelectTrigger className="min-h-0 h-auto w-auto gap-0.5 border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:opacity-40">
                <StatusBadge status={item.status} label={CHECKLIST_STATUS_LABELS[item.status] ?? item.status} />
              </SelectTrigger>
              <SelectContent>
                {CHECKLIST_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-text-tertiary">{CHECKLIST_CATEGORY_LABELS[item.category] ?? item.category}</span>
            {item.required && <span className="text-xs font-medium text-text-warning">Obrigatorio</span>}
          </div>
          <p className="mt-2 text-sm font-medium text-text-primary">{item.title}</p>
          {item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-secondary">{item.description}</p>}
          {item.notes && <p className="mt-2 text-xs leading-5 text-text-secondary">Notas: {item.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {updatingStatus ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border-subtle border-t-text-accent" aria-hidden="true" />
          ) : item.status === 'issue' ? (
            <AlertTriangle className="h-4 w-4 text-text-danger" aria-hidden="true" />
          ) : item.status === 'done' ? (
            <CheckCircle2 className="h-4 w-4 text-text-success" aria-hidden="true" />
          ) : (
            <PackageCheck className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
          )}
          <Button variant="ghost" size="icon" aria-label="Editar item" disabled={updatingStatus} onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir item"
            loading={deleting}
            disabled={updatingStatus}
            onClick={() => void onDelete(item)}
          >
            <Trash2 className="h-4 w-4 text-text-danger" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function MetricBox({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-3',
        tone === 'success' && 'bg-bg-success',
        tone === 'warning' && 'bg-bg-warning',
        tone === 'danger' && 'bg-bg-danger',
        tone === 'accent' && 'bg-bg-accent-subtle'
      )}
    >
      <p className="text-xs text-text-tertiary">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-light tabular-nums text-text-primary',
          tone === 'success' && 'text-text-success',
          tone === 'warning' && 'text-text-warning',
          tone === 'danger' && 'text-text-danger',
          tone === 'accent' && 'text-text-accent'
        )}
      >
        {value}
      </p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 text-text-secondary">{value}</dd>
    </div>
  );
}

function calculateChecklistProgress(items: HandoverChecklistItem[]) {
  const total = items.length;
  const done = items.filter((item) => item.status === 'done').length;
  const issue = items.filter((item) => item.status === 'issue').length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, issue, percent };
}
