'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FileText,
  Hourglass,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import {
  CandidateList,
  ExtractionDetailPanel,
  ExtractionSummaryList,
  IngestionJobList,
  IngestionStatusBadge,
  IngestionSummaryCard,
  formatIngestionDateTime,
} from '@/components/documents/document-ingestion-flow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import {
  documentIngestionApi,
  documentsApi,
  propertiesApi,
  type DocumentExtractionCandidate,
  type DocumentIngestionSummary,
} from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Nota fiscal',
  manual: 'Manual',
  project: 'Projeto',
  contract: 'Contrato',
  deed: 'Escritura',
  permit: 'Licenca/Alvara',
  insurance: 'Seguro',
  warranty: 'Garantia',
  inspection_report: 'Laudo/Inspecao',
  handover: 'Handover',
  other: 'Outro',
};

type IngestionState = 'empty' | 'processing' | 'review' | 'failed' | 'completed';
type ExtractionReviewAction = 'approved' | 'rejected' | 'partially_applied';
type ActionKey =
  | 'create-job'
  | `review-extraction:${ExtractionReviewAction}`
  | 'generate-candidates'
  | `approve-candidate:${string}`
  | `reject-candidate:${string}`
  | `apply-candidate:${string}`;

type StateCopy = {
  title: string;
  description: string;
  icon: typeof Sparkles;
  toneClass: string;
  badgeLabel: string;
};

const STATE_COPY: Record<IngestionState, StateCopy> = {
  empty: {
    title: 'Sem ingestao inteligente',
    description: 'Este documento ainda nao passou pela analise inteligente.',
    icon: CircleDashed,
    toneClass: 'bg-bg-subtle text-text-secondary',
    badgeLabel: 'Sem analise',
  },
  processing: {
    title: 'Analise em andamento',
    description: 'O documento esta na fila ou em processamento tecnico.',
    icon: Hourglass,
    toneClass: 'bg-bg-accent-subtle text-text-accent',
    badgeLabel: 'Processando',
  },
  review: {
    title: 'Aguardando revisao',
    description: 'Ha extracoes prontas para validacao humana antes de aplicar dados ao prontuario.',
    icon: ShieldAlert,
    toneClass: 'bg-bg-warning text-text-warning',
    badgeLabel: 'Pendente',
  },
  failed: {
    title: 'Falha na ingestao',
    description: 'A ultima analise falhou. Revise o historico e tente iniciar uma nova execucao.',
    icon: XCircle,
    toneClass: 'bg-bg-danger text-text-danger',
    badgeLabel: 'Falha',
  },
  completed: {
    title: 'Ingestao concluida',
    description: 'A analise terminou e o documento ja possui uma trilha de processamento registrada.',
    icon: CheckCircle2,
    toneClass: 'bg-bg-success text-text-success',
    badgeLabel: 'Concluido',
  },
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nao foi possivel carregar os dados agora.';
}

function resolveState(summary?: DocumentIngestionSummary): IngestionState {
  if (!summary || summary.totalJobs === 0) return 'empty';
  if (summary.latestJobStatus === 'queued' || summary.latestJobStatus === 'processing') return 'processing';
  if (summary.latestJobStatus === 'needs_review' || summary.pendingReviews > 0) return 'review';
  if (summary.latestJobStatus === 'failed' || summary.latestJobStatus === 'cancelled') return 'failed';
  return 'completed';
}

export default function DocumentIngestionPage({
  params,
}: {
  params: Promise<{ id: string; documentId: string }>;
}) {
  const { id: propertyId, documentId } = use(params);
  const [creating, setCreating] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedExtractionId, setSelectedExtractionId] = useState<string | null>(null);
  const [reviewStatusByExtraction, setReviewStatusByExtraction] = useState<Record<string, ExtractionReviewAction>>({});
  const [actionKey, setActionKey] = useState<ActionKey | null>(null);
  const [applyCandidateTarget, setApplyCandidateTarget] = useState<DocumentExtractionCandidate | null>(null);

  const { data: propertyData } = useSWR(['property', propertyId], () => propertiesApi.get(propertyId));
  const {
    data: documentData,
    error: documentError,
    isLoading: documentLoading,
  } = useSWR(['document', propertyId, documentId], () => documentsApi.get(propertyId, documentId));
  const {
    data: summaryData,
    error: summaryError,
    isLoading: summaryLoading,
    mutate: mutateSummary,
  } = useSWR(['document-ingestion-summary', propertyId, documentId], () =>
    documentIngestionApi.summary(propertyId, documentId)
  );
  const {
    data: jobsData,
    error: jobsError,
    isLoading: jobsLoading,
    mutate: mutateJobs,
  } = useSWR(['document-ingestion-jobs', propertyId, documentId], () =>
    documentIngestionApi.listJobs(propertyId, documentId, { limit: 20 })
  );
  const { data: selectedJobData, mutate: mutateSelectedJob } = useSWR(
    selectedJobId ? ['document-ingestion-job', propertyId, documentId, selectedJobId] : null,
    () => documentIngestionApi.getJob(propertyId, documentId, selectedJobId ?? '')
  );
  const { data: selectedExtractionData, mutate: mutateSelectedExtraction } = useSWR(
    selectedJobId && selectedExtractionId
      ? ['document-extraction-detail', propertyId, documentId, selectedJobId, selectedExtractionId]
      : null,
    () => documentIngestionApi.getExtraction(propertyId, documentId, selectedJobId ?? '', selectedExtractionId ?? '')
  );
  const { data: candidatesData, mutate: mutateCandidates } = useSWR(
    selectedJobId && selectedExtractionId
      ? ['document-extraction-candidates', propertyId, documentId, selectedJobId, selectedExtractionId]
      : null,
    () => documentIngestionApi.listCandidates(propertyId, documentId, selectedJobId ?? '', selectedExtractionId ?? '', { limit: 100 })
  );

  const summary = summaryData?.summary;
  const jobs = useMemo(() => jobsData?.data ?? [], [jobsData?.data]);
  const state = resolveState(summary);
  const stateCopy = STATE_COPY[state];
  const StateIcon = stateCopy.icon;
  const document = documentData?.document;
  const property = propertyData?.property;
  const hasActiveJob = jobs.some((job) => ['queued', 'processing', 'needs_review'].includes(job.status));
  const canCreateJob = !hasActiveJob && state !== 'processing';
  const pageLoading = documentLoading || summaryLoading || jobsLoading;
  const loadError = documentError ?? summaryError ?? jobsError;
  const selectedExtractions = useMemo(() => selectedJobData?.extractions ?? [], [selectedJobData?.extractions]);
  const selectedExtraction = selectedExtractionData?.extraction ?? null;
  const candidates = candidatesData?.candidates ?? [];

  const orderedJobs = useMemo(
    () => [...jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [jobs]
  );
  const selectedJob = selectedJobId ? orderedJobs.find((job) => job.id === selectedJobId) : undefined;
  const selectedReviewStatus = selectedExtractionId ? reviewStatusByExtraction[selectedExtractionId] : undefined;
  const canGenerateCandidates = Boolean(
    selectedJobId &&
    selectedExtractionId &&
    selectedExtraction &&
    candidates.length === 0 &&
    (selectedReviewStatus === 'approved' ||
      selectedReviewStatus === 'partially_applied' ||
      selectedJob?.status === 'completed')
  );

  useEffect(() => {
    if (orderedJobs.length === 0) {
      setSelectedJobId(null);
      return;
    }

    if (!selectedJobId || !orderedJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(orderedJobs[0].id);
    }
  }, [orderedJobs, selectedJobId]);

  useEffect(() => {
    if (selectedExtractions.length === 0) {
      setSelectedExtractionId(null);
      return;
    }

    if (!selectedExtractionId || !selectedExtractions.some((extraction) => extraction.id === selectedExtractionId)) {
      setSelectedExtractionId(selectedExtractions[0].id);
    }
  }, [selectedExtractions, selectedExtractionId]);

  async function handleCreateJob() {
    setCreating(true);
    setActionKey('create-job');
    try {
      const result = await documentIngestionApi.createJob(propertyId, documentId);
      setSelectedJobId(result.job.id);
      setSelectedExtractionId(null);
      await Promise.all([mutateSummary(), mutateJobs()]);
      toast.success('Analise inteligente iniciada');
    } catch (error) {
      toast.error('Nao foi possivel iniciar a analise', {
        description: getErrorMessage(error),
      });
    } finally {
      setCreating(false);
      setActionKey(null);
    }
  }

  async function refreshIngestionState() {
    await Promise.all([
      mutateSummary(),
      mutateJobs(),
      mutateSelectedJob(),
      mutateSelectedExtraction(),
      mutateCandidates(),
    ]);
  }

  async function handleReviewExtraction(status: ExtractionReviewAction) {
    if (!selectedJobId || !selectedExtractionId) return;

    setActionKey(`review-extraction:${status}`);
    try {
      await documentIngestionApi.reviewExtraction(propertyId, documentId, selectedJobId, selectedExtractionId, { status });
      setReviewStatusByExtraction((current) => ({ ...current, [selectedExtractionId]: status }));
      await refreshIngestionState();
      const message =
        status === 'approved'
          ? 'Extraction aprovada'
          : status === 'rejected'
            ? 'Extraction rejeitada'
            : 'Extraction marcada como parcialmente aplicada';
      toast.success(message);
    } catch (error) {
      toast.error('Nao foi possivel revisar a extraction', {
        description: getErrorMessage(error),
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleGenerateCandidates() {
    if (!selectedJobId || !selectedExtractionId || !canGenerateCandidates) return;

    setActionKey('generate-candidates');
    try {
      await documentIngestionApi.generateCandidates(propertyId, documentId, selectedJobId, selectedExtractionId);
      await refreshIngestionState();
      toast.success('Candidates gerados');
    } catch (error) {
      toast.error('Nao foi possivel gerar candidates', {
        description: getErrorMessage(error),
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleReviewCandidate(candidate: DocumentExtractionCandidate, status: 'approved' | 'rejected') {
    if (!selectedJobId || !selectedExtractionId || candidate.status !== 'pending') return;

    setActionKey(`${status === 'approved' ? 'approve' : 'reject'}-candidate:${candidate.id}`);
    try {
      await documentIngestionApi.reviewCandidate(propertyId, documentId, selectedJobId, selectedExtractionId, candidate.id, {
        status,
      });
      await refreshIngestionState();
      toast.success(status === 'approved' ? 'Candidate aprovado' : 'Candidate rejeitado');
    } catch (error) {
      toast.error('Nao foi possivel revisar o candidate', {
        description: getErrorMessage(error),
      });
    } finally {
      setActionKey(null);
    }
  }

  async function handleApplyCandidate(candidate: DocumentExtractionCandidate) {
    if (!selectedJobId || !selectedExtractionId || candidate.status !== 'approved') return;

    setActionKey(`apply-candidate:${candidate.id}`);
    try {
      await documentIngestionApi.applyCandidate(propertyId, documentId, selectedJobId, selectedExtractionId, candidate.id);
      await refreshIngestionState();
      toast.success('Candidate aplicado ao prontuario');
      setApplyCandidateTarget(null);
    } catch (error) {
      toast.error('Nao foi possivel aplicar o candidate', {
        description: getErrorMessage(error),
      });
    } finally {
      setActionKey(null);
    }
  }

  if (pageLoading && !summary && !document) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-4 sm:px-5 sm:py-5">
        <div className="hl-skeleton h-28 rounded-[var(--radius-xl)]" />
        <div className="grid gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="hl-skeleton h-24 rounded-[var(--radius-xl)]" />
          ))}
        </div>
        <div className="hl-skeleton h-64 rounded-[var(--radius-xl)]" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-4 sm:px-5 sm:py-5">
        <PageHeader
          density="editorial"
          eyebrow="Analise inteligente"
          title="Nao foi possivel carregar a ingestao"
          description="A consulta ao documento ou ao historico de processamento falhou."
          actions={
            <Button variant="outline" asChild>
              <Link href={`/properties/${propertyId}/documents`}>
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Erro ao carregar dados"
          description={getErrorMessage(loadError)}
          tone="strong"
          density="spacious"
          actions={
            <Button type="button" onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="editorial"
        eyebrow={property ? `${property.name} · Analise inteligente` : 'Analise inteligente'}
        title={document?.title ?? 'Documento'}
        description="Acompanhe o processamento inteligente deste documento antes de revisar extracoes e aplicar dados ao prontuario tecnico."
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href={`/properties/${propertyId}/documents`}>
                <ArrowLeft className="h-4 w-4" />
                Documentos
              </Link>
            </Button>
            {document?.file_url && (
              <Button variant="outline" asChild>
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4" />
                  Abrir arquivo
                </a>
              </Button>
            )}
            <Button
              type="button"
              onClick={handleCreateJob}
              loading={creating}
              disabled={!canCreateJob}
              title={hasActiveJob ? 'Ja existe uma analise ativa para este documento' : undefined}
            >
              <Sparkles className="h-4 w-4" />
              Iniciar analise inteligente
            </Button>
          </>
        }
      />

      <PageSection tone="strong" density="editorial">
        <div className="flex flex-col gap-4 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)]', stateCopy.toneClass)}>
              <StateIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-medium text-text-primary">{stateCopy.title}</h2>
                {summary?.latestJobStatus ? (
                  <IngestionStatusBadge status={summary.latestJobStatus} />
                ) : (
                  <Badge variant="secondary">{stateCopy.badgeLabel}</Badge>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-text-secondary">{stateCopy.description}</p>
              {document && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-tertiary">
                  <span>{DOC_TYPE_LABELS[document.type] ?? document.type}</span>
                  <span>·</span>
                  <span>Registrado em {formatDate(document.created_at)}</span>
                </div>
              )}
            </div>
          </div>
          {summary?.lastIngestionAt && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface-strong)] px-3 py-2 text-sm text-text-secondary">
              Ultima analise: <span className="font-medium text-text-primary">{formatIngestionDateTime(summary.lastIngestionAt)}</span>
            </div>
          )}
        </div>
      </PageSection>

      <PageSection
        title="Resumo da ingestao"
        description="Leitura consolidada do processamento deste documento."
        tone="surface"
        density="editorial"
      >
        {summary ? (
          <IngestionSummaryCard summary={summary} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="hl-skeleton h-24 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        )}
      </PageSection>

      <PageSection
        title="Jobs de analise"
        description="Historico de execucoes assincronas vinculadas a este documento."
        tone="strong"
        density="editorial"
        actions={
          hasActiveJob ? (
            <span className="inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-bg-accent-subtle px-3 py-2 text-xs font-medium text-text-accent">
              <Clock3 className="h-3.5 w-3.5" />
              Analise ativa
            </span>
          ) : null
        }
      >
        <IngestionJobList
          jobs={orderedJobs}
          selectedJobId={selectedJobId}
          onSelectJob={setSelectedJobId}
          emptyAction={
            <Button type="button" onClick={handleCreateJob} loading={creating}>
              <Sparkles className="h-4 w-4" />
              Iniciar analise inteligente
            </Button>
          }
        />
      </PageSection>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <PageSection
          title="Extracoes do job"
          description="Resumo das extracoes encontradas no job selecionado."
          tone="surface"
          density="editorial"
        >
          <ExtractionSummaryList
            extractions={selectedExtractions}
            selectedExtractionId={selectedExtractionId}
            onSelectExtraction={setSelectedExtractionId}
          />
        </PageSection>

        <PageSection
          title="Detalhe visual"
          description="Dados normalizados em leitura operacional, sem abrir JSON bruto."
          tone="surface"
          density="editorial"
        >
          <ExtractionDetailPanel extraction={selectedExtraction} />
          <div className="flex flex-wrap gap-2 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedExtraction}
              loading={actionKey === 'review-extraction:approved'}
              onClick={() => handleReviewExtraction('approved')}
            >
              Aprovar extraction
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedExtraction}
              loading={actionKey === 'review-extraction:partially_applied'}
              onClick={() => handleReviewExtraction('partially_applied')}
            >
              Parcialmente aplicada
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!selectedExtraction}
              loading={actionKey === 'review-extraction:rejected'}
              onClick={() => handleReviewExtraction('rejected')}
            >
              Rejeitar extraction
            </Button>
          </div>
        </PageSection>
      </div>

      <PageSection
        title="Candidates"
        description="Revise candidates gerados a partir da extraction selecionada antes de aplicar dados ao prontuario."
        tone="strong"
        density="editorial"
        actions={
          <Button
            type="button"
            variant="outline"
            loading={actionKey === 'generate-candidates'}
            disabled={!canGenerateCandidates}
            title={!canGenerateCandidates ? 'Gere candidates apenas após aprovar ou marcar a extraction como parcialmente aplicada.' : undefined}
            onClick={handleGenerateCandidates}
          >
            <Sparkles className="h-4 w-4" />
            Gerar candidates
          </Button>
        }
      >
        <CandidateList
          candidates={candidates}
          getCandidateActions={(candidate) => ({
            onApprove: (target) => handleReviewCandidate(target, 'approved'),
            onReject: (target) => handleReviewCandidate(target, 'rejected'),
            onApply: setApplyCandidateTarget,
            state: {
              approving: actionKey === `approve-candidate:${candidate.id}`,
              rejecting: actionKey === `reject-candidate:${candidate.id}`,
              applying: actionKey === `apply-candidate:${candidate.id}`,
            },
          })}
        />
      </PageSection>

      <Dialog open={Boolean(applyCandidateTarget)} onOpenChange={(open) => !open && setApplyCandidateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar candidate ao prontuario?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-6 text-text-secondary">
              Esta acao cria ou atualiza o registro de dominio correspondente ao candidate aprovado. O conteudo bruto da extraction permanece oculto nesta tela.
            </p>
            {applyCandidateTarget && (
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-strong)] p-3 text-sm text-text-secondary">
                <span>Candidate {applyCandidateTarget.id.slice(0, 8)}</span>
                <IngestionStatusBadge status={applyCandidateTarget.status} />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setApplyCandidateTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                loading={applyCandidateTarget ? actionKey === `apply-candidate:${applyCandidateTarget.id}` : false}
                disabled={!applyCandidateTarget || applyCandidateTarget.status !== 'approved'}
                onClick={() => applyCandidateTarget && handleApplyCandidate(applyCandidateTarget)}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
