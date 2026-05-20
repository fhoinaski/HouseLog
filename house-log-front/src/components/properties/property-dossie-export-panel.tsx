'use client';

import type { ReactNode } from 'react';
import { AlertCircle, BookOpen, Camera, Download, FileText, ShieldCheck } from 'lucide-react';
import type { DossiePayload } from '@/lib/api';
import { Button } from '@/components/ui/button';

type Props = {
  dossie?: DossiePayload;
  exportedDossie?: DossiePayload | null;
  isPreviewLoading?: boolean;
  isExporting?: boolean;
  exportError?: string | null;
  onGenerate: () => void;
  renderDownload?: (dossie: DossiePayload) => ReactNode;
};

function countLabel(value: number, label: string) {
  return `${value} ${label}`;
}

export function PropertyDossieExportPanel({
  dossie,
  exportedDossie,
  isPreviewLoading = false,
  isExporting = false,
  exportError,
  onGenerate,
  renderDownload,
}: Props) {
  const canGenerate = Boolean(dossie) && !isExporting;

  return (
    <section className="rounded-[var(--hl-radius-lg)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-hl-accent">
            <BookOpen className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em]">Dossie tecnico PDF</p>
          </div>
          <h2 className="text-lg font-semibold text-hl-text">Entrega formal do prontuario do imovel</h2>
          <p className="max-w-2xl text-sm leading-6 text-hl-text-muted">
            Consolida dados tecnicos, ambientes, documentos, garantias, inventario, servicos concluidos e evidencias sem expor chaves privadas de midia.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button type="button" onClick={onGenerate} disabled={!canGenerate} size="sm">
            <Download className="h-3.5 w-3.5" />
            {isExporting ? 'Gerando...' : 'Gerar dossie PDF'}
          </Button>
          {exportedDossie && renderDownload?.(exportedDossie)}
        </div>
      </div>

      {isPreviewLoading ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="hl-skeleton h-16 rounded-[var(--hl-radius-md)]" />
          ))}
        </div>
      ) : dossie ? (
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<FileText className="h-4 w-4" />} label="Documentos" value={countLabel(dossie.documents.length, 'itens')} />
          <Metric icon={<ShieldCheck className="h-4 w-4" />} label="Garantias" value={countLabel(dossie.warranties.length, 'ativas/historicas')} />
          <Metric icon={<BookOpen className="h-4 w-4" />} label="Ambientes" value={countLabel(dossie.rooms.length, 'registrados')} />
          <Metric icon={<Camera className="h-4 w-4" />} label="Evidencias" value={countLabel(dossie.photo_evidence.length, 'servicos')} />
        </div>
      ) : (
        <div className="mt-5 rounded-[var(--hl-radius-md)] border border-hl-border bg-hl-surface-soft px-3 py-3 text-sm text-hl-text-muted">
          Nao foi possivel preparar o preview do dossie.
        </div>
      )}

      {exportError && (
        <div className="mt-4 flex items-start gap-2 rounded-[var(--hl-radius-md)] border border-[color-mix(in_srgb,var(--hl-danger)_28%,var(--hl-border))] bg-[color-mix(in_srgb,var(--hl-danger)_8%,var(--hl-surface))] px-3 py-2 text-sm text-hl-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{exportError}</span>
        </div>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[var(--hl-radius-md)] border border-hl-border bg-hl-surface-soft px-3 py-3">
      <div className="flex items-center gap-2 text-hl-text-muted">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-hl-text">{value}</p>
    </div>
  );
}
