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
  const totalDocuments = ingestionSummary?.totalDocuments ?? 0;
  const documentsWithIngestion = ingestionSummary?.documentsWithIngestion ?? 0;
  const pendingReviews = ingestionSummary?.pendingExtractionReviews ?? 0;
  const pendingCandidates = ingestionSummary?.pendingCandidates ?? 0;
  const appliedCandidates = ingestionSummary?.appliedCandidates ?? 0;
  const failedJobs = ingestionSummary?.failedJobs ?? 0;
  const processingJobs = ingestionSummary?.processingJobs ?? 0;
  const hasDocuments = totalDocuments > 0;
  const hasIngestion = documentsWithIngestion > 0 || (ingestionSummary?.totalJobs ?? 0) > 0;

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

  let score = Number.isFinite(property.health_score) ? property.health_score : 62;
  const highlights: string[] = [];
  const risks: string[] = [];
  const improvements: string[] = [];

  if (documentsWithIngestion > 0) {
    highlights.push(
      `${documentsWithIngestion} ${pluralize(
        documentsWithIngestion,
        'documento analisado',
        'documentos analisados'
      )} pelo prontuário inteligente.`
    );
    score += Math.min(6, documentsWithIngestion * 2);
  } else {
    risks.push('Os documentos existentes ainda não foram analisados.');
    improvements.push('Iniciar análise inteligente nos documentos disponíveis.');
    score -= 8;
  }

  if (appliedCandidates > 0) {
    highlights.push(
      `${appliedCandidates} ${pluralize(
        appliedCandidates,
        'dado aplicado',
        'dados aplicados'
      )} ao prontuário técnico.`
    );
    score += Math.min(10, appliedCandidates * 2);
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
    score -= Math.min(18, pendingReviews * 5);
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
    score -= Math.min(14, pendingCandidates * 4);
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
    score -= Math.min(22, failedJobs * 9);
  }

  if (processingJobs > 0) {
    highlights.push(
      `${processingJobs} ${pluralize(
        processingJobs,
        'análise em andamento',
        'análises em andamento'
      )}.`
    );
    score -= Math.min(5, processingJobs * 2);
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
    score -= Math.min(10, remainingDocuments * 2);
  }

  if (risks.length === 0) {
    highlights.push('Não há pendências abertas no prontuário inteligente.');
    score += 5;
  }

  const finalScore = clampScore(score);
  const nextImprovements = improvements.length > 0
    ? [...new Set(improvements)].slice(0, 4)
    : ['Manter documentos técnicos atualizados e revisar novas sugestões quando surgirem.'];

  return {
    score: finalScore,
    label: labelFromScore(finalScore),
    description:
      'Leitura inicial baseada no score cadastrado e nos sinais do prontuário inteligente. O índice orienta priorização, sem substituir uma avaliação técnica completa.',
    highlights,
    risks: risks.length > 0 ? risks : ['Nenhum risco relevante identificado nos sinais disponíveis.'],
    improvements: nextImprovements,
  };
}
