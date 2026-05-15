'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ScanLine } from 'lucide-react';
import type { LabelExtractResult } from '@/lib/api/inventory';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type OcrApplyFields = {
  brand?: string;
  model?: string;
  serial_number?: string;
  warranty_until?: string;
};

interface LabelOcrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraction: LabelExtractResult;
  onApply: (fields: OcrApplyFields) => void;
  isApplying: boolean;
}

export function LabelOcrDialog({
  open,
  onOpenChange,
  extraction,
  onApply,
  isApplying,
}: LabelOcrDialogProps) {
  // Initial values come from extraction at mount time.
  // The parent must pass a fresh `key` whenever a new extraction arrives so
  // this component remounts and gets correct initial state — no useEffect needed.
  const [brand, setBrand] = useState(extraction.manufacturer ?? '');
  const [model, setModel] = useState(extraction.model ?? '');
  const [serialNumber, setSerialNumber] = useState(extraction.serialNumber ?? '');
  const [warrantyUntil, setWarrantyUntil] = useState(extraction.warrantyUntil ?? '');
  const [showRaw, setShowRaw] = useState(false);

  const confidencePct = Math.round(extraction.confidence * 100);
  const confidenceColor =
    confidencePct >= 80
      ? 'text-text-success'
      : confidencePct >= 50
        ? 'text-[var(--color-warning)]'
        : 'text-text-danger';

  function handleApply() {
    onApply({
      brand: brand.trim() || undefined,
      model: model.trim() || undefined,
      serial_number: serialNumber.trim() || undefined,
      warranty_until: warrantyUntil || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent/15">
              <ScanLine className="h-4 w-4 text-text-accent" />
            </div>
            <DialogTitle>Leitura de etiqueta</DialogTitle>
          </div>
          <DialogDescription className="mt-1">
            Revise e ajuste os campos extraídos antes de aplicar ao item.
          </DialogDescription>
        </DialogHeader>

        {/* Confidence indicator */}
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border-half border-border-subtle bg-bg-subtle px-3 py-2 text-sm">
          <span className="text-text-secondary">Confiança da leitura</span>
          <span className={cn('font-medium tabular-nums', confidenceColor)}>
            {confidencePct}%
          </span>
        </div>

        {/* Editable fields */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ocr-brand">Marca / Fabricante</Label>
            <Input
              id="ocr-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Não identificado"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ocr-model">Modelo</Label>
            <Input
              id="ocr-model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Não identificado"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ocr-serial">Número de série (S/N)</Label>
            <Input
              id="ocr-serial"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Não identificado"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ocr-warranty">Garantia até</Label>
            <Input
              id="ocr-warranty"
              type="date"
              value={warrantyUntil}
              onChange={(e) => setWarrantyUntil(e.target.value)}
            />
          </div>
        </div>

        {/* Read-only extra data */}
        {(extraction.capacity ?? extraction.voltage ?? extraction.manufactureDate) && (
          <div className="rounded-[var(--radius-md)] border-half border-border-subtle bg-bg-subtle px-3 py-2">
            <p className="mb-1.5 text-xs font-medium text-text-secondary">
              Dados técnicos adicionais (somente leitura)
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {extraction.capacity && (
                <>
                  <dt className="text-text-tertiary">Capacidade</dt>
                  <dd className="text-text-primary">{extraction.capacity}</dd>
                </>
              )}
              {extraction.voltage && (
                <>
                  <dt className="text-text-tertiary">Tensão</dt>
                  <dd className="text-text-primary">{extraction.voltage}</dd>
                </>
              )}
              {extraction.manufactureDate && (
                <>
                  <dt className="text-text-tertiary">Fabricação</dt>
                  <dd className="text-text-primary">{extraction.manufactureDate}</dd>
                </>
              )}
            </dl>
          </div>
        )}

        {/* Raw text accordion */}
        {extraction.rawExtractedText && (
          <div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="flex w-full items-center justify-between text-xs text-text-tertiary hover:text-text-secondary"
            >
              <span>Texto bruto extraído</span>
              {showRaw ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {showRaw && (
              <pre className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded-[var(--radius-md)] border-half border-border-subtle bg-bg-subtle px-3 py-2 text-xs text-text-secondary">
                {extraction.rawExtractedText}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={isApplying}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            loading={isApplying}
            className="flex-1"
          >
            Aplicar campos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
