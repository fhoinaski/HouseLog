import type {
  DocumentExtractionCandidate,
  DocumentExtractionCandidateStatus,
  DocumentExtractionCandidateType,
  DocumentExtractionDetail,
  DocumentExtractionReviewStatus,
  DocumentExtractionSummary,
  DocumentIngestionJob,
  DocumentIngestionSummary,
} from '@houselog/contracts';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardCheck,
  DatabaseZap,
  FileSearch,
  Hourglass,
  Info,
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
  needs_review: 'Aguardando revisão',
  completed: 'Concluído',
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
  technical_system: 'Sistema técnico',
  warranty: 'Garantia',
  inventory_item: 'Item de inventário',
  maintenance_recommendation: 'Recomendação de manutenção',
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
  superseded: 'Substituído',
};

const CANDIDATE_STATUS_BADGES: Record<DocumentExtractionCandidateStatus, BadgeProps['variant']> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  applied: 'success',
  superseded: 'secondary',
};

const REVIEW_STATUS_LABELS: Record<DocumentExtractionReviewStatus, string> = {
  pending: 'Revisão pendente',
  approved: 'Revisão aprovada',
  rejected: 'Revisão rejeitada',
  partially_applied: 'Parcialmente aplicada',
};

const REVIEW_STATUS_BADGES: Record<DocumentExtractionReviewStatus, BadgeProps['variant']> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
  partially_applied: 'success',
};

const CANDIDATE_TYPE_ORDER: DocumentExtractionCandidateType[] = [
  'technical_system',
  'warranty',
  'inventory_item',
  'maintenance_recommendation',
];

type MetricTone = 'default' | 'accent' | 'warning' | 'success' | 'danger';

type Metric = {
  label: string;
  value: number | string;
  tone?: MetricTone;
  helper?: string;
};

type PipelineStepState = 'completed' | 'current' | 'pending' | 'error';

type PipelineStep = {
  key: string;
  label: string;
  description: string;
  state: PipelineStepState;
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
    <div className={cn('min-h-[104px] rounded-[var(--radius-lg)] p-3', metricToneClass(metric.tone))}>
      <div className="flex h-full flex-col justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
            {metric.label}
          </p>
          <p className="mt-2 text-2xl font-light tabular-nums text-text-primary">{metric.value}</p>
        </div>
        {metric.helper && <p className="text-xs leading-5 text-text-tertiary">{metric.helper}</p>}
      </div>
    </div>
  );
}

function pipelineStepClass(state: PipelineStepState): string {
  if (state === 'completed') return 'bg-bg-success text-text-success';
  if (state === 'current') return 'bg-bg-accent-subtle text-text-accent shadow-[0_0_0_1px_var(--border-focus)]';
  if (state === 'error') return 'bg-bg-danger text-text-danger';
  return 'bg-[var(--surface-base)] text-text-tertiary';
}

function pipelineStepIconClass(state: PipelineStepState): string {
  if (state === 'completed') return 'bg-bg-success-emphasis text-text-success';
  if (state === 'current') return 'bg-bg-accent text-text-inverse';
  if (state === 'error') return 'bg-bg-danger text-text-danger';
  return 'bg-bg-subtle text-text-tertiary';
}

function pipelineStepStatusLabel(state: PipelineStepState): string {
  if (state === 'completed') return 'Concluído';
  if (state === 'current') return 'Atual';
  if (state === 'error') return 'Erro';
  return 'Pendente';
}

function resolvePipelineStepStates(
  rawSteps: Array<Omit<PipelineStep, 'state'> & { completed: boolean; error?: boolean }>
): PipelineStep[] {
  const errorIndex = rawSteps.findIndex((step) => Boolean(step.error));
  const currentIndex = errorIndex >= 0 ? -1 : rawSteps.findIndex((step) => !step.completed);

  return rawSteps.map(({ completed, error, ...step }, index) => {
    if (error) return { ...step, state: 'error' };
    if (completed) return { ...step, state: 'completed' };
    if (index === currentIndex) return { ...step, state: 'current' };
    return { ...step, state: 'pending' };
  });
}

export function IngestionPipelineSteps({
  summary,
  selectedJob,
  selectedExtraction,
  candidates,
}: {
  summary?: DocumentIngestionSummary | null;
  selectedJob?: DocumentIngestionJob | null;
  selectedExtraction?: DocumentExtractionDetail | null;
  candidates: DocumentExtractionCandidate[];
}) {
  const latestJobStatus = selectedJob?.status ?? summary?.latestJobStatus ?? null;
  const jobHasError = latestJobStatus === 'failed' || latestJobStatus === 'cancelled';
  const hasJob = Boolean(selectedJob) || Boolean(summary && summary.totalJobs > 0);
  const hasExtraction = Boolean(selectedExtraction) || Boolean(summary && summary.totalExtractions > 0);
  const reviewStatus = selectedExtraction?.review?.status ?? null;
  const hasExtractionReview = Boolean(reviewStatus) || Boolean(summary && summary.totalReviews > 0);
  const hasCandidates = candidates.length > 0 || Boolean(summary && summary.totalCandidates > 0);
  const reviewedCandidates = candidates.filter((candidate) => candidate.status !== 'pending').length;
  const summaryReviewedCandidates =
    (summary?.approvedCandidates ?? 0) + (summary?.rejectedCandidates ?? 0) + (summary?.appliedCandidates ?? 0);
  const hasReviewedCandidates = hasCandidates && (
    (candidates.length > 0 && reviewedCandidates === candidates.length) ||
    (summary?.totalCandidates ?? 0) > 0 && summaryReviewedCandidates >= (summary?.totalCandidates ?? 0)
  );
  const hasAppliedData =
    candidates.some((candidate) => candidate.status === 'applied') || Boolean(summary && summary.appliedCandidates > 0);

  const steps = resolvePipelineStepStates([
    {
      key: 'document',
      label: 'Documento enviado',
      description: 'Arquivo registrado no acervo.',
      completed: true,
    },
    {
      key: 'job',
      label: 'Análise iniciada',
      description: latestJobStatus ? INGESTION_JOB_STATUS_LABELS[latestJobStatus] : 'Aguardando início.',
      completed: hasJob && !jobHasError,
      error: jobHasError,
    },
    {
      key: 'extraction',
      label: 'Extração criada',
      description: hasExtraction ? 'Leitura técnica disponível.' : 'Aguardando processamento.',
      completed: hasExtraction,
    },
    {
      key: 'review',
      label: 'Revisão da extração',
      description: reviewStatus ? REVIEW_STATUS_LABELS[reviewStatus] : 'Validação humana pendente.',
      completed: hasExtractionReview,
    },
    {
      key: 'candidates',
      label: 'Sugestões geradas',
      description: hasCandidates ? 'Sugestões prontas para decisão.' : 'Gerar após revisar a extração.',
      completed: hasCandidates,
    },
    {
      key: 'candidate-review',
      label: 'Sugestões revisadas',
      description: hasReviewedCandidates ? 'Todas as sugestões foram avaliadas.' : 'Aprovar ou rejeitar sugestões.',
      completed: hasReviewedCandidates,
    },
    {
      key: 'applied',
      label: 'Dados aplicados ao imóvel',
      description: hasAppliedData ? 'Prontuário atualizado.' : 'Aplicação manual dos aprovados.',
      completed: hasAppliedData,
    },
  ]);
  const currentStep = steps.find((step) => step.state === 'current' || step.state === 'error') ?? steps.at(-1);

  return (
    <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-text-primary">Guia do pipeline</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Etapa atual: <span className="font-medium text-text-primary">{currentStep?.label ?? 'Pipeline'}</span>
          </p>
        </div>
        <Badge variant={currentStep?.state === 'error' ? 'destructive' : 'outline'}>
          {currentStep ? pipelineStepStatusLabel(currentStep.state) : 'Status'}
        </Badge>
      </div>

      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Etapas da ingestão inteligente">
        {steps.map((step, index) => {
          const StepIcon = step.state === 'completed' ? CheckCircle2 : step.state === 'error' ? AlertTriangle : CircleDashed;

          return (
            <li
              key={step.key}
              aria-current={step.state === 'current' ? 'step' : undefined}
              className={cn('rounded-[var(--radius-lg)] p-3', pipelineStepClass(step.state))}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
                    pipelineStepIconClass(step.state)
                  )}
                  aria-hidden="true"
                >
                  <StepIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                    Etapa {index + 1}
                  </span>
                  <span className="mt-1 block text-sm font-medium text-text-primary">{step.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-text-secondary">{step.description}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
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
    return <Badge variant="outline">Confiança não informada</Badge>;
  }

  const percent = Math.round(score * 100);
  const variant: BadgeProps['variant'] = percent >= 85 ? 'success' : percent >= 60 ? 'warning' : 'destructive';
  const label = percent >= 85 ? 'Alta' : percent >= 60 ? 'Média' : 'Baixa';

  return <Badge variant={variant}>{label}: {percent}%</Badge>;
}

export function ReviewStatusBadge({ status }: { status?: DocumentExtractionReviewStatus | null }) {
  if (!status) {
    return <Badge variant="outline">Sem revisão registrada</Badge>;
  }

  return <Badge variant={REVIEW_STATUS_BADGES[status]}>{REVIEW_STATUS_LABELS[status]}</Badge>;
}

function primitiveLabel(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() ? value : null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  return null;
}

function readPayloadField(payload: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = primitiveLabel(payload[key]);
    if (value) return value;
  }
  return null;
}

function candidatePayloadSummary(candidate: DocumentExtractionCandidate): Array<{ label: string; value: string }> {
  const payload = candidate.payloadJson;
  const byType: Record<DocumentExtractionCandidateType, Array<{ label: string; keys: string[] }>> = {
    technical_system: [
      { label: 'Nome', keys: ['name', 'title'] },
      { label: 'Tipo', keys: ['type', 'systemType'] },
      { label: 'Local', keys: ['locationSummary', 'location'] },
      { label: 'Modelo', keys: ['model', 'brand'] },
    ],
    warranty: [
      { label: 'Garantia', keys: ['title', 'name'] },
      { label: 'Fornecedor', keys: ['providerName', 'provider'] },
      { label: 'Validade', keys: ['endDate', 'warrantyUntil'] },
      { label: 'Cobertura', keys: ['coverage', 'warrantyType'] },
    ],
    inventory_item: [
      { label: 'Item', keys: ['name', 'title'] },
      { label: 'Categoria', keys: ['category'] },
      { label: 'Modelo', keys: ['model', 'brand'] },
      { label: 'Quantidade', keys: ['quantity', 'unit'] },
    ],
    maintenance_recommendation: [
      { label: 'Recomendacao', keys: ['title', 'name'] },
      { label: 'Sistema', keys: ['systemType', 'type'] },
      { label: 'Prioridade', keys: ['priority'] },
      { label: 'Intervalo', keys: ['recommendedIntervalMonths'] },
    ],
  };

  const mapped = byType[candidate.candidateType]
    .map((item) => {
      const value = readPayloadField(payload, item.keys);
      return value ? { label: item.label, value } : null;
    })
    .filter((item): item is { label: string; value: string } => Boolean(item));

  if (mapped.length > 0) return mapped.slice(0, 4);

  return Object.entries(payload)
    .map(([key, value]) => {
      const label = primitiveLabel(value);
      return label ? { label: key, value: label } : null;
    })
    .filter((item): item is { label: string; value: string } => Boolean(item))
    .slice(0, 4);
}

export function IngestionSummaryCard({ summary }: { summary: DocumentIngestionSummary }) {
  const metrics: Metric[] = [
    { label: 'Processamentos', value: summary.totalJobs, tone: summary.totalJobs > 0 ? 'accent' : 'default', helper: 'Rodadas de análise' },
    { label: 'Extrações', value: summary.totalExtractions, helper: 'Dados técnicos encontrados' },
    { label: 'Revisões pendentes', value: summary.pendingReviews, tone: summary.pendingReviews > 0 ? 'warning' : 'default', helper: 'Precisam de validação' },
    { label: 'Sugestões pendentes', value: summary.pendingCandidates, tone: summary.pendingCandidates > 0 ? 'warning' : 'default', helper: 'Aguardam decisão' },
    { label: 'Sugestões aplicadas', value: summary.appliedCandidates, tone: summary.appliedCandidates > 0 ? 'success' : 'default', helper: 'Já entraram no prontuário' },
    { label: 'Falhas', value: summary.failedJobs, tone: summary.failedJobs > 0 ? 'danger' : 'default', helper: 'Execuções com erro' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
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
              <p className="text-sm font-medium text-text-primary">Processamento {job.id.slice(0, 8)}</p>
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
        title="Este documento ainda não foi analisado."
        description="A IA pode identificar sistemas técnicos, garantias, materiais e recomendações de manutenção."
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
  jobStatus,
  jobError,
  emptyActions,
}: {
  extractions: DocumentExtractionSummary[];
  selectedExtractionId?: string | null;
  onSelectExtraction?: (extractionId: string) => void;
  jobStatus?: DocumentIngestionJob['status'] | null;
  jobError?: string | null;
  emptyActions?: React.ReactNode;
}) {
  if (extractions.length === 0) {
    const isProcessing = jobStatus === 'queued' || jobStatus === 'processing';
    const isFailed = jobStatus === 'failed' || jobStatus === 'cancelled';
    const EmptyIcon = isProcessing ? Hourglass : isFailed ? AlertTriangle : FileSearch;
    const title = isProcessing
      ? 'Análise em andamento'
      : isFailed
        ? 'A análise não gerou extrações'
        : 'Nenhuma extração encontrada';
    const description = isProcessing
      ? 'O documento está sendo processado. Recarregue em alguns instantes para acompanhar a leitura.'
      : isFailed
        ? (jobError ?? 'A execução falhou antes de produzir uma leitura revisável.')
        : 'Este processamento ainda não possui dados extraídos. Se ele já terminou, tente iniciar uma nova análise.';

    return (
      <EmptyState
        icon={<EmptyIcon className={cn('h-6 w-6', isProcessing && 'animate-spin')} />}
        title={title}
        description={description}
        tone="subtle"
        density="compact"
        actions={emptyActions}
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
              <p className="text-sm font-medium text-text-primary">Extração {extraction.id.slice(0, 8)}</p>
              <p className="mt-1 text-xs text-text-secondary">
                Schema {extraction.schemaVersion}
                {extraction.modelName ? ` · ${extraction.modelName}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ConfidenceBadge score={extraction.confidenceScore} />
              {extraction.hasNormalizedJson && <Badge variant="success">Normalizada</Badge>}
              {extraction.hasRawText && <Badge variant="outline">Texto extraído</Badge>}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function ExtractionDetailPanel({
  extraction,
  reviewStatus,
  canGenerateCandidates,
  candidateGenerationHint,
}: {
  extraction?: DocumentExtractionDetail | null;
  reviewStatus?: DocumentExtractionReviewStatus | null;
  canGenerateCandidates?: boolean;
  candidateGenerationHint?: string;
}) {
  if (!extraction) {
    return (
      <EmptyState
        icon={<DatabaseZap className="h-6 w-6" />}
        title="Selecione uma extração"
        description="O detalhe visual mostrará resumo, confiança e contagens normalizadas sem abrir dados técnicos brutos."
        tone="subtle"
        density="compact"
      />
    );
  }

  const normalized = extraction.normalizedJson;
  const persistedReviewStatus = reviewStatus ?? extraction.review?.status ?? null;
  const counts = normalized
    ? [
        { label: 'Sistemas', value: normalized.technicalSystems.length },
        { label: 'Garantias', value: normalized.warranties.length },
        { label: 'Inventario', value: normalized.inventoryItems.length },
        { label: 'Manutencoes', value: normalized.maintenanceRecommendations.length },
      ]
    : [];
  const warnings = normalized?.warnings ?? [];

  return (
    <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">Leitura inteligente</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            Documento tipo {normalized?.documentType ?? 'não identificado'} · schema {extraction.schemaVersion}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ReviewStatusBadge status={persistedReviewStatus} />
          <ConfidenceBadge score={extraction.confidenceScore ?? normalized?.confidenceScore} />
        </div>
      </div>

      {normalized?.summary && (
        <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Resumo extraído</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{normalized.summary}</p>
        </div>
      )}

      {candidateGenerationHint && (
        <div
          className={cn(
            'mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] p-3 text-sm leading-6',
            canGenerateCandidates ? 'bg-bg-success text-text-success' : 'bg-bg-warning text-text-warning'
          )}
        >
          {canGenerateCandidates ? <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
          <p>{candidateGenerationHint}</p>
        </div>
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
        <p className="mt-4 text-sm text-text-secondary">Sem dados normalizados disponíveis para esta extração.</p>
      )}

      {warnings.length > 0 && (
        <div className="mt-4 rounded-[var(--radius-lg)] bg-bg-warning p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-text-warning">
            <AlertTriangle className="h-4 w-4" />
            Pontos de atenção
          </div>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-text-warning">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {(extraction.hasRawJson || extraction.hasRawText) && (
        <p className="mt-4 text-xs leading-5 text-text-tertiary">
          Dados técnicos brutos disponíveis no backend, ocultos nesta etapa para preservar uma revisão segura.
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
  const summary = candidatePayloadSummary(candidate);
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
      {summary.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {summary.map((item) => (
            <div key={`${item.label}-${item.value}`} className="rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">{item.label}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-5 text-text-primary">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <details className="group mt-4 rounded-[var(--radius-lg)] border border-border-subtle bg-[var(--surface-strong)] p-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-text-secondary">
          <span>Detalhe técnico da sugestão</span>
          <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
        </summary>
        <pre className="mt-3 max-h-72 overflow-auto rounded-[var(--radius-md)] bg-[var(--surface-base)] p-3 text-xs leading-5 text-text-secondary">
          {JSON.stringify(candidate.payloadJson, null, 2)}
        </pre>
      </details>
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
            title={!canApply ? 'Aplique apenas sugestões aprovadas.' : undefined}
          >
            Aplicar ao prontuário
          </Button>
        </div>
      )}
    </article>
  );
}

export function CandidateList({
  candidates,
  getCandidateActions,
  emptyDescription,
  emptyActions,
}: {
  candidates: DocumentExtractionCandidate[];
  getCandidateActions?: (candidate: DocumentExtractionCandidate) => CandidateCardActions;
  emptyDescription?: React.ReactNode;
  emptyActions?: React.ReactNode;
}) {
  if (candidates.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-6 w-6" />}
        title="Nenhuma sugestão gerada"
        description={emptyDescription ?? 'A extração pode não ter encontrado dados aplicáveis ou as sugestões ainda não foram geradas.'}
        tone="subtle"
        density="compact"
        actions={emptyActions}
      />
    );
  }

  return (
    <div className="space-y-4">
      {CANDIDATE_TYPE_ORDER.map((type) => {
        const groupedCandidates = candidates.filter((candidate) => candidate.candidateType === type);
        if (groupedCandidates.length === 0) return null;

        const CandidateIcon = CANDIDATE_TYPE_ICONS[type];

        return (
          <section key={type} className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-base)] px-3 py-2">
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
                  <CandidateIcon className="h-4 w-4" />
                </span>
                {CANDIDATE_TYPE_LABELS[type]}
              </div>
              <Badge variant="secondary">{groupedCandidates.length}</Badge>
            </div>
            {groupedCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                actions={getCandidateActions?.(candidate)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function isCandidateStatus(status: string): status is DocumentExtractionCandidateStatus {
  return ['pending', 'approved', 'rejected', 'applied', 'superseded'].includes(status);
}
