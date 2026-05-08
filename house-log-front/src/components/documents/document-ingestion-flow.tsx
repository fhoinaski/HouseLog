import type {
  DocumentExtractionCandidate,
  DocumentExtractionCandidateStatus,
  DocumentExtractionCandidateType,
  DocumentExtractionDetail,
  DocumentExtractionSummary,
  DocumentIngestionJob,
  DocumentIngestionSummary,
} from '@houselog/contracts';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  CheckCircle2,
  CircleDashed,
  DatabaseZap,
  FileSearch,
  Layers3,
  ListChecks,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
} from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn, formatDate } from '@/lib/utils';

export const INGESTION_JOB_STATUS_LABELS: Record<DocumentIngestionJob['status'], string> = {
  queued: 'Na fila',
  processing: 'Processando',
  needs_review: 'Aguardando revisao',
  completed: 'Concluido',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

const INGESTION_JOB_STATUS_BADGES: Record<DocumentIngestionJob['status'], BadgeProps['variant']> = {
  queued: 'warning',
  processing: 'in_progress',
  needs_review: 'warning',
  completed: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
};

const INGESTION_JOB_STATUS_ICONS: Record<DocumentIngestionJob['status'], LucideIcon> = {
  queued: CircleDashed,
  processing: RefreshCw,
  needs_review: AlertCircle,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: CircleDashed,
};

const CANDIDATE_TYPE_LABELS: Record<DocumentExtractionCandidateType, string> = {
  technical_system: 'Sistema tecnico',
  warranty: 'Garantia',
  inventory_item: 'Item de inventario',
  maintenance_recommendation: 'Recomendacao de manutencao',
};

const CANDIDATE_TYPE_ICONS: Record<DocumentExtractionCandidateType, LucideIcon> = {
  technical_system: Layers3,
  warranty: ShieldCheck,
  inventory_item: Package,
  maintenance_recommendation: Wrench,
};

const CANDIDATE_STATUS_LABELS: Record<DocumentExtractionCandidateStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
  applied: 'Aplicado',
  superseded: 'Substituido',
};

const CANDIDATE_STATUS_BADGES: Record<DocumentExtractionCandidateStatus, BadgeProps['variant']> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  applied: 'success',
  superseded: 'secondary',
};

type MetricTone = 'default' | 'accent' | 'warning' | 'success' | 'danger';

type Metric = {
  label: string;
  value: number | string;
  tone?: MetricTone;
};

export function formatIngestionDateTime(value?: string | null): string {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function metricToneClass(tone: MetricTone = 'default'): string {
  if (tone === 'accent') return 'bg-bg-accent-subtle';
  if (tone === 'warning') return 'bg-bg-warning';
  if (tone === 'success') return 'bg-bg-success';
  if (tone === 'danger') return 'bg-bg-danger';
  return 'bg-[var(--surface-base)]';
}

function SummaryMetric({ metric }: { metric: Metric }) {
  return (
    <div className={cn('rounded-[var(--radius-lg)] p-3', metricToneClass(metric.tone))}>
      <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
        {metric.label}
      </p>
      <p className="mt-2 text-2xl font-light tabular-nums text-text-primary">{metric.value}</p>
    </div>
  );
}

export function IngestionStatusBadge({
  status,
}: {
  status: DocumentIngestionJob['status'] | DocumentExtractionCandidateStatus;
}) {
  if (isCandidateStatus(status)) {
    return <Badge variant={CANDIDATE_STATUS_BADGES[status]}>{CANDIDATE_STATUS_LABELS[status]}</Badge>;
  }

  return <Badge variant={INGESTION_JOB_STATUS_BADGES[status]}>{INGESTION_JOB_STATUS_LABELS[status]}</Badge>;
}

export function ConfidenceBadge({ score }: { score?: number | null }) {
  if (score == null) {
    return <Badge variant="outline">Confianca nao informada</Badge>;
  }

  const percent = Math.round(score * 100);
  const variant: BadgeProps['variant'] = percent >= 85 ? 'success' : percent >= 60 ? 'warning' : 'destructive';
  const label = percent >= 85 ? 'Alta' : percent >= 60 ? 'Media' : 'Baixa';

  return <Badge variant={variant}>{label}: {percent}%</Badge>;
}

export function IngestionSummaryCard({ summary }: { summary: DocumentIngestionSummary }) {
  const metrics: Metric[] = [
    { label: 'Jobs', value: summary.totalJobs, tone: summary.totalJobs > 0 ? 'accent' : 'default' },
    { label: 'Extracoes', value: summary.totalExtractions },
    { label: 'Revisoes pendentes', value: summary.pendingReviews, tone: summary.pendingReviews > 0 ? 'warning' : 'default' },
    { label: 'Candidates aprovados', value: summary.approvedCandidates, tone: summary.approvedCandidates > 0 ? 'success' : 'default' },
    { label: 'Candidates pendentes', value: summary.pendingCandidates, tone: summary.pendingCandidates > 0 ? 'warning' : 'default' },
    { label: 'Candidates aplicados', value: summary.appliedCandidates, tone: summary.appliedCandidates > 0 ? 'success' : 'default' },
    { label: 'Falhas', value: summary.failedJobs, tone: summary.failedJobs > 0 ? 'danger' : 'default' },
    { label: 'Ultimo status', value: summary.latestJobStatus ? INGESTION_JOB_STATUS_LABELS[summary.latestJobStatus] : '-' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((metric) => (
        <SummaryMetric key={metric.label} metric={metric} />
      ))}
    </div>
  );
}

export function IngestionJobCard({
  job,
  selected = false,
  onSelect,
}: {
  job: DocumentIngestionJob;
  selected?: boolean;
  onSelect?: (jobId: string) => void;
}) {
  const isFailed = job.status === 'failed';
  const StatusIcon = INGESTION_JOB_STATUS_ICONS[job.status];
  const Wrapper = onSelect ? 'button' : 'article';

  return (
    <Wrapper
      type={onSelect ? 'button' : undefined}
      onClick={onSelect ? () => onSelect(job.id) : undefined}
      className={cn(
        'w-full rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 text-left text-text-primary transition-colors',
        onSelect && 'hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
        selected && 'shadow-[0_0_0_1px_var(--border-focus)]',
        isFailed && 'bg-bg-danger'
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <IngestionStatusBadge status={job.status} />
            <span className="text-xs text-text-tertiary">{formatIngestionDateTime(job.createdAt)}</span>
          </div>
          <div className="mt-3 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-subtle text-text-secondary">
              <StatusIcon className={cn('h-4 w-4', job.status === 'processing' && 'animate-spin')} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">Job {job.id.slice(0, 8)}</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">
                Provedor: {job.provider === 'none' ? 'Pipeline interno' : job.provider}
                {job.modelName ? ` · Modelo: ${job.modelName}` : ''}
              </p>
            </div>
          </div>
          {job.lastError && (
            <p className="mt-3 line-clamp-2 text-xs leading-5 text-text-danger">{job.lastError}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-52">
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-strong)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">Tentativas</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-text-primary">{job.attempts}</p>
          </div>
          <div className="rounded-[var(--radius-md)] bg-[var(--surface-strong)] px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">Fim</p>
            <p className="mt-1 truncate text-sm font-medium text-text-primary">
              {job.finishedAt ? formatDate(job.finishedAt) : '-'}
            </p>
          </div>
        </div>
      </div>
    </Wrapper>
  );
}

export function IngestionJobList({
  jobs,
  selectedJobId,
  onSelectJob,
  emptyAction,
}: {
  jobs: DocumentIngestionJob[];
  selectedJobId?: string | null;
  onSelectJob?: (jobId: string) => void;
  emptyAction?: React.ReactNode;
}) {
  if (jobs.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks className="h-6 w-6" />}
        title="Nenhum job de ingestao ainda"
        description="Inicie a analise inteligente para criar a primeira trilha de processamento deste documento."
        tone="subtle"
        density="spacious"
        actions={emptyAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <IngestionJobCard
          key={job.id}
          job={job}
          selected={selectedJobId === job.id}
          onSelect={onSelectJob}
        />
      ))}
    </div>
  );
}

export function ExtractionSummaryList({
  extractions,
  selectedExtractionId,
  onSelectExtraction,
}: {
  extractions: DocumentExtractionSummary[];
  selectedExtractionId?: string | null;
  onSelectExtraction?: (extractionId: string) => void;
}) {
  if (extractions.length === 0) {
    return (
      <EmptyState
        icon={<FileSearch className="h-6 w-6" />}
        title="Nenhuma extracao neste job"
        description="Quando o processamento concluir, as extracoes resumidas aparecerao aqui."
        tone="subtle"
        density="compact"
      />
    );
  }

  return (
    <div className="space-y-2">
      {extractions.map((extraction) => (
        <button
          key={extraction.id}
          type="button"
          onClick={onSelectExtraction ? () => onSelectExtraction(extraction.id) : undefined}
          className={cn(
            'w-full rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-3 text-left transition-colors',
            onSelectExtraction && 'hover:bg-[var(--field-bg-hover)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
            selectedExtractionId === extraction.id && 'shadow-[0_0_0_1px_var(--border-focus)]'
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">Extracao {extraction.id.slice(0, 8)}</p>
              <p className="mt-1 text-xs text-text-secondary">
                Schema {extraction.schemaVersion}
                {extraction.modelName ? ` · ${extraction.modelName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ConfidenceBadge score={extraction.confidenceScore} />
              {extraction.hasNormalizedJson && <Badge variant="success">Normalizada</Badge>}
              {extraction.hasRawText && <Badge variant="outline">Texto extraido</Badge>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function ExtractionDetailPanel({ extraction }: { extraction?: DocumentExtractionDetail | null }) {
  if (!extraction) {
    return (
      <EmptyState
        icon={<DatabaseZap className="h-6 w-6" />}
        title="Selecione uma extracao"
        description="O detalhe visual mostrara resumo, confianca e contagens normalizadas sem abrir JSON bruto."
        tone="subtle"
        density="compact"
      />
    );
  }

  const normalized = extraction.normalizedJson;
  const counts = normalized
    ? [
        { label: 'Sistemas', value: normalized.technicalSystems.length },
        { label: 'Garantias', value: normalized.warranties.length },
        { label: 'Inventario', value: normalized.inventoryItems.length },
        { label: 'Manutencoes', value: normalized.maintenanceRecommendations.length },
      ]
    : [];

  return (
    <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Detalhe da extracao</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Documento tipo {normalized?.documentType ?? 'nao identificado'} · schema {extraction.schemaVersion}
          </p>
        </div>
        <ConfidenceBadge score={extraction.confidenceScore ?? normalized?.confidenceScore} />
      </div>

      {normalized?.summary && (
        <p className="mt-4 rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3 text-sm leading-6 text-text-secondary">
          {normalized.summary}
        </p>
      )}

      {counts.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {counts.map((item) => (
            <div key={item.label} className="rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3">
              <p className="text-[10px] uppercase tracking-[0.08em] text-text-tertiary">{item.label}</p>
              <p className="mt-1 text-lg font-light tabular-nums text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-secondary">Sem dados normalizados disponiveis para esta extracao.</p>
      )}

      {(extraction.hasRawJson || extraction.hasRawText) && (
        <p className="mt-4 text-xs leading-5 text-text-tertiary">
          Conteudo bruto disponivel no backend, oculto nesta etapa para preservar revisao segura.
        </p>
      )}
    </div>
  );
}

export type CandidateActionState = {
  approving?: boolean;
  rejecting?: boolean;
  applying?: boolean;
};

export type CandidateCardActions = {
  onApprove?: (candidate: DocumentExtractionCandidate) => void;
  onReject?: (candidate: DocumentExtractionCandidate) => void;
  onApply?: (candidate: DocumentExtractionCandidate) => void;
  state?: CandidateActionState;
};

export function CandidateCard({
  candidate,
  actions,
}: {
  candidate: DocumentExtractionCandidate;
  actions?: CandidateCardActions;
}) {
  const CandidateIcon = CANDIDATE_TYPE_ICONS[candidate.candidateType];
  const payloadKeys = Object.keys(candidate.payloadJson);
  const canReview = candidate.status === 'pending';
  const canApply = candidate.status === 'approved';

  return (
    <article className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 text-text-primary">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
            <CandidateIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {CANDIDATE_TYPE_LABELS[candidate.candidateType]}
            </p>
            <p className="mt-1 text-xs leading-5 text-text-secondary">
              Origem: {candidate.sourcePath} · campos mapeados: {payloadKeys.length}
            </p>
            {candidate.reviewNotes && (
              <p className="mt-2 text-xs leading-5 text-text-secondary">{candidate.reviewNotes}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <IngestionStatusBadge status={candidate.status} />
          <ConfidenceBadge score={candidate.confidenceScore} />
        </div>
      </div>
      {actions && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canReview}
            loading={actions.state?.approving}
            onClick={() => actions.onApprove?.(candidate)}
          >
            Aprovar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canReview}
            loading={actions.state?.rejecting}
            onClick={() => actions.onReject?.(candidate)}
          >
            Rejeitar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canApply}
            loading={actions.state?.applying}
            onClick={() => actions.onApply?.(candidate)}
            title={!canApply ? 'Aplique apenas candidates aprovados.' : undefined}
          >
            Aplicar ao prontuario
          </Button>
        </div>
      )}
    </article>
  );
}

export function CandidateList({
  candidates,
  getCandidateActions,
}: {
  candidates: DocumentExtractionCandidate[];
  getCandidateActions?: (candidate: DocumentExtractionCandidate) => CandidateCardActions;
}) {
  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title="Nenhum candidate gerado"
        description="Quando candidates forem gerados para uma extracao, eles aparecerao aqui para revisao e aplicacao controlada."
        tone="subtle"
        density="compact"
      />
    );
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.id}
          candidate={candidate}
          actions={getCandidateActions?.(candidate)}
        />
      ))}
    </div>
  );
}

function isCandidateStatus(status: string): status is DocumentExtractionCandidateStatus {
  return ['pending', 'approved', 'rejected', 'applied', 'superseded'].includes(status);
}
