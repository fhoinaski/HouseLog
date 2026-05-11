import type { Property, PropertyDocumentIngestionSummary } from '@/lib/api';

export type PropertyTechnicalHealthLabel =
  | 'Excelente'
  | 'Bom'
  | 'Atenção'
  | 'Crítico'
  | 'Em formação';

export type PropertyTechnicalHealthView = {
  score: number | null;
  label: PropertyTechnicalHealthLabel;
  description: string;
  highlights: string[];
  risks: string[];
  improvements: string[];
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function labelFromScore(score: number): PropertyTechnicalHealthLabel {
  if (score >= 85) return 'Excelente';
  if (score >= 70) return 'Bom';
  if (score >= 50) return 'Atenção';
  return 'Crítico';
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildPropertyTechnicalHealthView(
  property: Pick<Property, 'health_score'>,
  ingestionSummary: PropertyDocumentIngestionSummary | null | undefined
): PropertyTechnicalHealthView {
  const baseScore = Number.isFinite(property.health_score) ? clampScore(property.health_score) : null;
  const totalDocuments = ingestionSummary?.totalDocuments ?? 0;
  const documentsWithIngestion = ingestionSummary?.documentsWithIngestion ?? 0;
  const pendingReviews = ingestionSummary?.pendingExtractionReviews ?? 0;
  const pendingCandidates = ingestionSummary?.pendingCandidates ?? 0;
  const appliedCandidates = ingestionSummary?.appliedCandidates ?? 0;
  const failedJobs = ingestionSummary?.failedJobs ?? 0;
  const processingJobs = ingestionSummary?.processingJobs ?? 0;
  const hasDocuments = totalDocuments > 0;
  const hasIngestion = documentsWithIngestion > 0 || (ingestionSummary?.totalJobs ?? 0) > 0;
  const highlights: string[] = [];
  const risks: string[] = [];
  const improvements: string[] = [];

  if (!hasDocuments && !hasIngestion) {
    return {
      score: null,
      label: 'Em formação',
      description:
        'A leitura técnica começa quando documentos do imóvel são enviados e analisados pelo prontuário inteligente.',
      highlights: ['Nenhum documento analisado ainda.'],
      risks: ['Ainda não há sinais técnicos suficientes para interpretar a saúde do imóvel.'],
      improvements: [
        'Enviar manuais, notas fiscais, garantias ou relatórios técnicos.',
        'Iniciar uma análise inteligente nos documentos do imóvel.',
      ],
    };
  }

  if (documentsWithIngestion > 0) {
    highlights.push(
      `${documentsWithIngestion} ${pluralize(
        documentsWithIngestion,
        'documento analisado',
        'documentos analisados'
      )} pelo prontuário inteligente.`
    );
  } else {
    risks.push('Os documentos existentes ainda não foram analisados.');
    improvements.push('Iniciar análise inteligente nos documentos disponíveis.');
  }

  if (appliedCandidates > 0) {
    highlights.push(
      `${appliedCandidates} ${pluralize(
        appliedCandidates,
        'dado aplicado',
        'dados aplicados'
      )} ao prontuário técnico.`
    );
  } else {
    improvements.push('Aplicar sugestões aprovadas ao prontuário do imóvel.');
  }

  if (pendingReviews > 0) {
    risks.push(
      `${pendingReviews} ${pluralize(
        pendingReviews,
        'extração aguarda revisão',
        'extrações aguardam revisão'
      )}.`
    );
    improvements.push('Revisar extrações pendentes para qualificar os dados técnicos.');
  }

  if (pendingCandidates > 0) {
    risks.push(
      `${pendingCandidates} ${pluralize(
        pendingCandidates,
        'sugestão aguarda decisão',
        'sugestões aguardam decisão'
      )}.`
    );
    improvements.push('Aprovar ou rejeitar sugestões antes de aplicar ao prontuário.');
  }

  if (failedJobs > 0) {
    risks.push(
      `${failedJobs} ${pluralize(
        failedJobs,
        'análise falhou',
        'análises falharam'
      )} e precisa de revisão.`
    );
    improvements.push('Resolver falhas de análise ou tentar novamente com o documento correto.');
  }

  if (processingJobs > 0) {
    highlights.push(
      `${processingJobs} ${pluralize(
        processingJobs,
        'análise em andamento',
        'análises em andamento'
      )}.`
    );
  }

  if (hasDocuments && documentsWithIngestion < totalDocuments) {
    const remainingDocuments = totalDocuments - documentsWithIngestion;
    risks.push(
      `${remainingDocuments} ${pluralize(
        remainingDocuments,
        'documento ainda não entrou',
        'documentos ainda não entraram'
      )} na análise inteligente.`
    );
    improvements.push('Completar a análise dos documentos restantes.');
  }

  if (risks.length === 0) {
    highlights.push('Não há pendências abertas no prontuário inteligente.');
  }

  const nextImprovements = improvements.length > 0
    ? [...new Set(improvements)].slice(0, 4)
    : ['Manter documentos técnicos atualizados e revisar novas sugestões quando surgirem.'];
  const hasReliableScore = baseScore !== null;

  return {
    score: baseScore,
    label: hasReliableScore ? labelFromScore(baseScore) : 'Em formação',
    description: hasReliableScore
      ? 'Leitura inicial baseada no indicador técnico cadastrado e nos sinais do prontuário inteligente.'
      : 'A saúde técnica será formada quando houver um indicador confiável para este imóvel.',
    highlights,
    risks: risks.length > 0 ? risks : ['Nenhum risco relevante identificado nos sinais disponíveis.'],
    improvements: nextImprovements,
  };
}
