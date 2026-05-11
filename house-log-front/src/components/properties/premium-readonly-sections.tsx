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
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { HandoverChecklistItemFormDialog } from './handover-checklist-item-form-dialog';
import { HandoverPackageFormDialog } from './handover-package-form-dialog';
import { RenovationFormDialog } from './renovation-form-dialog';
import { WarrantyFormDialog } from './warranty-form-dialog';

const WARRANTY_TYPE_LABELS: Record<string, string> = {
  service:    'Serviço',
  equipment:  'Equipamento',
  material:   'Material',
  structural: 'Estrutural',
  appliance:  'Eletro',
  finish:     'Acabamento',
  other:      'Outro',
};

const WARRANTY_STATUS_LABELS: Record<string, string> = {
  active:   'Ativa',
  expired:  'Vencida',
  expiring: 'Vencendo',
  claimed:  'Acionada',
  void:     'Invalidada',
};

const RENOVATION_CATEGORY_LABELS: Record<string, string> = {
  structural:     'Estrutural',
  electrical:     'Elétrica',
  plumbing:       'Hidráulica',
  finishing:      'Acabamento',
  layout:         'Layout',
  roofing:        'Cobertura',
  waterproofing:  'Impermeabilização',
  painting:       'Pintura',
  flooring:       'Piso',
  other:          'Outro',
};

const RENOVATION_STATUS_LABELS: Record<string, string> = {
  planned:     'Planejada',
  in_progress: 'Em andamento',
  completed:   'Concluída',
  cancelled:   'Cancelada',
};

const HANDOVER_TYPE_LABELS: Record<string, string> = {
  handover:   'Entrega técnica',
  move_in:    'Entrada',
  move_out:   'Saída',
  inspection: 'Vistoria',
};

const HANDOVER_STATUS_LABELS: Record<string, string> = {
  draft:     'Rascunho',
  in_review: 'Em revisão',
  ready_to_issue: 'Pronto para emissão',
  issued: 'Emitido',
  accepted: 'Aceito',
  revoked: 'Revogado',
  expired: 'Expirado',
};

const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  keys:        'Chaves',
  documents:   'Documentos',
  utilities:   'Utilidades',
  inventory:   'Inventário',
  cleaning:    'Limpeza',
  maintenance: 'Manutenção',
  safety:      'Segurança',
  general:     'Geral',
};

const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  pending:        'Pendente',
  done:           'Concluído',
  issue:          'Pendência',
  not_applicable: 'Não aplicável',
};

const CHECKLIST_STATUS_OPTIONS: Array<{ value: HandoverChecklistItem['status']; label: string }> = [
  { value: 'pending',        label: 'Pendente' },
  { value: 'done',           label: 'Concluído' },
  { value: 'issue',          label: 'Pendência' },
  { value: 'not_applicable', label: 'Não aplicável' },
];


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
  const [pendingDeleteWarranty, setPendingDeleteWarranty] = useState<Warranty | null>(null);
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
      const message = err instanceof Error ? err.message : 'Não foi possível salvar a garantia.';
      setFormError(message);
      toast.error('Erro ao salvar garantia', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteWarranty() {
    if (!pendingDeleteWarranty) return;
    setDeletingId(pendingDeleteWarranty.id);
    try {
      await warrantiesApi.delete(propertyId, pendingDeleteWarranty.id);
      await mutate();
      toast.success('Garantia excluída.');
      setPendingDeleteWarranty(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir a garantia.';
      toast.error('Erro ao excluir garantia', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Prontuário técnico"
        title="Garantias"
        description="Garantias de serviços, equipamentos, materiais e acabamentos vinculadas ao histórico técnico do imóvel."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova garantia
          </Button>
        }
      />

      <PageSection title="Resumo das garantias" description="Controle de prazos, fornecedores e cobertura." tone="strong" density="compact">
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricBox label="Garantias" value={warranties.length} />
          <MetricBox label="Ativas" value={activeCount} tone="success" />
          <MetricBox label="Vencidas" value={expiredCount} tone={expiredCount > 0 ? 'warning' : 'default'} />
        </div>
      </PageSection>

      {isLoading && <LoadingGrid />}
      {!isLoading && error && (
        <ErrorState
          title="Não foi possível carregar as garantias"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => void mutate()}
        />
      )}
      {!isLoading && !error && warranties.length === 0 && (
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" aria-hidden="true" />}
          title="Nenhuma garantia registrada ainda"
          description="Quando garantias técnicas forem cadastradas, elas aparecerão aqui com prazos, fornecedor e cobertura resumida."
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
              onDelete={setPendingDeleteWarranty}
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

      <ConfirmDeleteDialog
        open={!!pendingDeleteWarranty}
        onOpenChange={(open) => { if (!open) setPendingDeleteWarranty(null); }}
        title="Excluir garantia?"
        itemName={pendingDeleteWarranty?.title}
        description="Esta ação remove a garantia do prontuário ativo do imóvel."
        onConfirm={() => void confirmDeleteWarranty()}
        isLoading={deletingId === pendingDeleteWarranty?.id}
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
          <InfoCell label="Início" value={formatDate(warranty.start_date)} />
          <InfoCell label="Fim" value={formatDate(warranty.end_date)} />
        </div>
        <InfoCell label="Fornecedor" value={warranty.provider_name || 'Não informado'} />
        <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-3 py-2">
          <dt className="text-xs text-text-tertiary">Cobertura</dt>
          <dd className="mt-1">
            <SummaryText>{warranty.coverage || warranty.description || 'Cobertura não informada.'}</SummaryText>
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
  const [pendingDeleteRenovation, setPendingDeleteRenovation] = useState<Renovation | null>(null);
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
      const message = err instanceof Error ? err.message : 'Não foi possível salvar a reforma.';
      setFormError(message);
      toast.error('Erro ao salvar reforma', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteRenovation() {
    if (!pendingDeleteRenovation) return;
    setDeletingId(pendingDeleteRenovation.id);
    try {
      await renovationsApi.delete(propertyId, pendingDeleteRenovation.id);
      await mutate();
      toast.success('Reforma excluída.');
      setPendingDeleteRenovation(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir a reforma.';
      toast.error('Erro ao excluir reforma', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Histórico técnico"
        title="Reformas"
        description="Registro de reformas e intervenções técnicas que alteram a memória técnica do imóvel."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova reforma
          </Button>
        }
      />

      <PageSection title="Resumo das reformas" description="Resumo de status, custo e execução." tone="strong" density="compact">
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
          title="Não foi possível carregar as reformas"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => void mutate()}
        />
      )}
      {!isLoading && !error && renovations.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-6 w-6" aria-hidden="true" />}
          title="Nenhuma reforma registrada ainda"
          description="Reformas, obras e intervenções técnicas aparecerão aqui com período, contratado, categoria e custo."
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
              onDelete={setPendingDeleteRenovation}
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

      <ConfirmDeleteDialog
        open={!!pendingDeleteRenovation}
        onOpenChange={(open) => { if (!open) setPendingDeleteRenovation(null); }}
        title="Excluir reforma?"
        itemName={pendingDeleteRenovation?.title}
        description="Esta ação remove a reforma do histórico técnico do imóvel."
        onConfirm={() => void confirmDeleteRenovation()}
        isLoading={deletingId === pendingDeleteRenovation?.id}
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
          <InfoCell label="Início" value={formatDate(renovation.started_at)} />
          <InfoCell label="Conclusão" value={formatDate(renovation.completed_at)} />
        </div>
        <InfoCell label="Contratado" value={renovation.contractor_name || 'Não informado'} />
        <InfoCell label="Custo" value={renovation.cost != null ? formatCurrency(renovation.cost) : 'Não informado'} />
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
  const [pendingDeletePkg, setPendingDeletePkg] = useState<HandoverPackage | null>(null);

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
        toast.success('Dossiê atualizado.');
      } else {
        const result = await handoverPackagesApi.create(propertyId, input);
        setSelectedPackageId(result.package.id);
        toast.success('Dossiê criado.');
      }
      await mutate();
      setFormOpen(false);
      setEditingPkg(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível salvar o dossiê.';
      setFormError(message);
      toast.error('Erro ao salvar dossiê', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeletePackage() {
    if (!pendingDeletePkg) return;
    setDeletingId(pendingDeletePkg.id);
    try {
      await handoverPackagesApi.delete(propertyId, pendingDeletePkg.id);
      if (selectedPackageId === pendingDeletePkg.id) setSelectedPackageId(null);
      await mutate();
      toast.success('Dossiê excluído.');
      setPendingDeletePkg(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir o dossiê.';
      toast.error('Erro ao excluir dossie', { description: message });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        eyebrow="Dossiê técnico"
        title="Handover"
        description="Pacotes de entrega técnica e checklist para vistoria, pendências e validação do imóvel."
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
          title="Não foi possível carregar os dossiês"
          description={error instanceof Error ? error.message : undefined}
          onRetry={() => void mutate()}
        />
      )}
      {!isLoading && !error && packages.length === 0 && (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" aria-hidden="true" />}
          title="Nenhum pacote de entrega registrado ainda"
          description="Quando houver dossiês de entrega, vistoria, entrada ou saída, eles aparecerão aqui com progresso do checklist."
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
          <PageSection title="Pacotes" description="Selecione um dossiê para ver o checklist." tone="surface" density="compact">
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
                        onClick={() => setPendingDeletePkg(pkg)}
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

      <ConfirmDeleteDialog
        open={!!pendingDeletePkg}
        onOpenChange={(open) => { if (!open) setPendingDeletePkg(null); }}
        title="Excluir pacote de entrega?"
        itemName={pendingDeletePkg?.title}
        description="Esta ação remove o dossiê e seu checklist do histórico de handover do imóvel."
        onConfirm={() => void confirmDeletePackage()}
        isLoading={deletingId === pendingDeletePkg?.id}
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
  const [pendingDeleteItem, setPendingDeleteItem] = useState<HandoverChecklistItem | null>(null);

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
      const message = err instanceof Error ? err.message : 'Não foi possível salvar o item.';
      setFormError(message);
      toast.error('Erro ao salvar item', { description: message });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDeleteItem() {
    if (!pendingDeleteItem) return;
    setDeletingId(pendingDeleteItem.id);
    try {
      await handoverChecklistApi.delete(propertyId, handoverPackage.id, pendingDeleteItem.id);
      await mutate();
      toast.success('Item excluído.');
      setPendingDeleteItem(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível excluir o item.';
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
      const message = err instanceof Error ? err.message : 'Não foi possível atualizar o status.';
      toast.error('Erro ao atualizar status', { description: message });
    } finally {
      setUpdatingStatusId(null);
    }
  }

  return (
    <>
      <PageSection
        title={handoverPackage.title}
        description="Progresso do checklist de entrega técnica."
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
            title="Não foi possível carregar o checklist"
            description={error instanceof Error ? error.message : undefined}
            onRetry={() => void mutate()}
          />
        )}
        {!isLoading && !error && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              <MetricBox label="Itens" value={progress.total} />
              <MetricBox label="Concluídos" value={progress.done} tone="success" />
              <MetricBox label="Pendências" value={progress.issue} tone={progress.issue > 0 ? 'danger' : 'default'} />
              <MetricBox label="Progresso" value={`${progress.percent}%`} tone="accent" />
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-bg-subtle">
              <div className="h-full rounded-full bg-bg-accent-subtle" style={{ width: `${progress.percent}%` }} />
            </div>

            {items.length === 0 ? (
              <EmptyState
                icon={<FileCheck2 className="h-6 w-6" aria-hidden="true" />}
                title="Checklist ainda sem itens"
                description="Os itens de vistoria, evidências e pendências deste pacote aparecerão aqui quando forem cadastrados."
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
                    onDelete={setPendingDeleteItem}
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

      <ConfirmDeleteDialog
        open={!!pendingDeleteItem}
        onOpenChange={(open) => { if (!open) setPendingDeleteItem(null); }}
        title="Excluir item do checklist?"
        itemName={pendingDeleteItem?.title}
        description="Esta ação remove o item do checklist de entrega técnica do imóvel."
        onConfirm={() => void confirmDeleteItem()}
        isLoading={deletingId === pendingDeleteItem?.id}
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
            {item.required && <span className="text-xs font-medium text-text-warning">Obrigatório</span>}
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
