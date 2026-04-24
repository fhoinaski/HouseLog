'use client';

import { use } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Activity, Wrench, ShieldCheck, Clock, FileText,
  TrendingUp, Download, RefreshCw,
} from 'lucide-react';
import { reportsApi, propertiesApi } from '@/lib/api';
import { HealthReportPDF } from '@/components/pdf/HealthReportPDF';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((m) => m.PDFDownloadLink),
  { ssr: false, loading: () => <Button variant="outline" size="sm" disabled><Download className="h-3.5 w-3.5" />PDF</Button> }
);
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn, scoreColor, scoreBg, formatCurrency, formatDate } from '@/lib/utils';

const FACTOR_META: Record<string, { label: string; max: number; icon: React.ElementType; description: string }> = {
  maintenance_compliance: {
    label: 'Compliance de manutenção',
    max: 30,
    icon: RefreshCw,
    description: 'Percentual de manutenções preventivas realizadas no prazo',
  },
  service_backlog: {
    label: 'Backlog de serviços',
    max: 20,
    icon: Wrench,
    description: 'Penalidade por OS urgentes em aberto há mais de 7 dias',
  },
  preventive_ratio: {
    label: 'Índice preventivo',
    max: 20,
    icon: ShieldCheck,
    description: 'Proporção de OS preventivas vs corretivas no total',
  },
  age_penalty: {
    label: 'Penalidade de idade',
    max: 15,
    icon: Clock,
    description: 'Depreciação baseada no ano de construção do imóvel',
  },
  document_completeness: {
    label: 'Completude documental',
    max: 15,
    icon: FileText,
    description: 'Cobertura de documentos obrigatórios e vigentes',
  },
};

function ScoreGauge({ score }: { score: number }) {
  const r = 60;
  const circ = Math.PI * r; // half-circle
  const dash = (score / 100) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="160" height="90" viewBox="0 0 160 90">
          {/* Background arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none" stroke="var(--border-subtle)" strokeWidth="12" strokeLinecap="round"
          />
          {/* Score arc */}
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke={score < 30 ? 'var(--text-danger)' : score < 60 ? 'var(--text-warning)' : score < 80 ? 'var(--text-success)' : 'var(--interactive-primary-bg)'}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(dash / circ) * 220} 220`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className={cn('text-4xl font-medium', scoreColor(score))}>{score}</span>
          <span className="text-xs text-text-secondary">de 100</span>
        </div>
      </div>
      <span className={cn('mt-1 text-sm font-medium', scoreColor(score))}>
        {score >= 80 ? 'Excelente' : score >= 60 ? 'Bom' : score >= 30 ? 'Atenção' : 'Crítico'}
      </span>
    </div>
  );
}

function FactorBar({
  factorKey, value, max,
}: {
  factorKey: string; value: number; max: number;
}) {
  const meta = FACTOR_META[factorKey];
  if (!meta) return null;
  const Icon = meta.icon;
  const pct = (value / max) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-secondary" />
          <span className="font-medium">{meta.label}</span>
        </div>
        <span className={cn('font-medium tabular-nums', scoreColor(pct))}>
          {value}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn('h-full rounded-full transition-all duration-700', scoreBg(pct))}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-text-secondary">{meta.description}</p>
    </div>
  );
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: scoreData, isLoading: scoreLoading, mutate: mutateScore } = useSWR(
    ['health-score', id],
    () => reportsApi.healthScore(id)
  );

  const { data: valuationData, isLoading: valuationLoading } = useSWR(
    ['valuation', id],
    () => reportsApi.valuationPdf(id)
  );

  const { data: propData } = useSWR(['property', id], () => propertiesApi.get(id));
  const property = propData?.property;

  function handleExportJson() {
    if (!valuationData) return;
    const blob = new Blob([JSON.stringify(valuationData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${property?.name ?? id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-3xl space-y-6 px-4 py-4 safe-bottom sm:px-5 sm:py-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/properties/${id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-medium">Relatório do imóvel</h1>
            {property && (
              <p className="text-sm text-text-secondary">{property.name}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => mutateScore()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Recalcular
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleExportJson}
            disabled={valuationLoading || !valuationData}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar JSON
          </Button>
          {scoreData && valuationData && (
            <PDFDownloadLink
              document={
                <HealthReportPDF
                  score={scoreData.score}
                  breakdown={scoreData.breakdown}
                  valuation={valuationData}
                />
              }
              fileName={`relatorio-saude-${property?.name ?? id}-${new Date().toISOString().slice(0, 10)}.pdf`}
            >
              {({ loading }) => (
                <Button variant="outline" size="sm" disabled={loading}>
                  <Download className="h-3.5 w-3.5" />
                  {loading ? 'Gerando...' : 'Exportar PDF'}
                </Button>
              )}
            </PDFDownloadLink>
          )}
        </div>
      </div>

      {/* Health Score card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-text-accent" />
            Score de saúde
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          {scoreLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-interactive-primary-bg border-t-transparent" />
            </div>
          ) : scoreData ? (
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
              <ScoreGauge score={scoreData.score} />
              <div className="flex-1 space-y-5 w-full">
                {Object.entries(scoreData.breakdown).map(([key, value]) => (
                  <FactorBar
                    key={key}
                    factorKey={key}
                    value={value as number}
                    max={FACTOR_META[key]?.max ?? 100}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-text-secondary text-sm text-center py-6">
              Não foi possível calcular o score. Tente recalcular.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Valuation summary */}
      {!valuationLoading && valuationData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-text-success" />
              Sumário de valoração
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-bg-subtle p-4 text-center">
                <dt className="text-xs text-text-secondary mb-1">Total despesas</dt>
                <dd className="text-lg font-medium text-text-primary">{formatCurrency(valuationData.expenses_total ?? 0)}</dd>
              </div>
              <div className="rounded-xl bg-bg-subtle p-4 text-center">
                <dt className="text-xs text-text-secondary mb-1">Total serviços</dt>
                <dd className="text-lg font-medium text-text-primary">{formatCurrency(valuationData.services_total ?? 0)}</dd>
              </div>
              <div className="rounded-xl bg-bg-accent-subtle p-4 text-center">
                <dt className="mb-1 text-xs text-text-accent">Score atual</dt>
                <dd className={cn('text-lg font-medium', scoreColor(valuationData.health_score ?? 0))}>
                  {valuationData.health_score ?? 0}/100
                </dd>
              </div>
            </dl>
            {valuationData.generated_at && (
              <p className="text-xs text-text-secondary mt-4 text-right">
                Gerado em {formatDate(valuationData.generated_at)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Property details */}
      {property && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-text-primary">Dados do imóvel</CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Nome', value: property.name },
                { label: 'Tipo', value: property.type },
                { label: 'Endereço', value: property.address },
                { label: 'Cidade', value: property.city },
                property.area_m2 && { label: 'Área', value: `${property.area_m2} m²` },
                property.year_built && { label: 'Ano', value: String(property.year_built) },
                property.structure && { label: 'Estrutura', value: property.structure },
                { label: 'Cadastrado', value: formatDate(property.created_at) },
              ].filter(Boolean).map((item, i) => (
                <div key={i}>
                  <dt className="text-xs text-text-secondary">{(item as { label: string }).label}</dt>
                  <dd className="font-medium mt-0.5 text-text-primary">{(item as { value: string }).value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
