'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardCheck, Copy, Printer, ShieldCheck } from 'lucide-react';
import {
  buildPublicHandoverAcceptancePrintData,
  buildPublicHandoverAcceptanceSummary,
  type HandoverPackagePublic,
} from '@houselog/contracts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PublicHandoverError, publicHandoverApi } from '@/lib/api/handover-public';

type PublicHandoverAcceptanceProps = {
  token: string;
  handoverPackage: HandoverPackagePublic;
  onAccepted: (handoverPackage: HandoverPackagePublic) => void;
  formatDateTime: (value: string | null | undefined) => string;
};

function resolveAcceptanceError(error: unknown): string {
  if (!(error instanceof PublicHandoverError)) {
    return 'Nao foi possivel registrar o aceite agora. Tente novamente em instantes.';
  }

  if (error.code === 'LINK_EXPIRED') return 'Este link expirou. Solicite uma nova chave ao responsavel pela entrega.';
  if (error.code === 'PACKAGE_REVOKED') return 'Este pacote foi revogado e nao pode mais receber aceite.';
  if (error.code === 'PACKAGE_ALREADY_ACCEPTED') return 'Esta entrega digital ja foi aceita anteriormente.';
  if (error.code === 'VALIDATION_ERROR') return 'Revise nome, email e confirmacao de ciencia para registrar o aceite.';
  return 'Nao foi possivel registrar o aceite agora. Tente novamente em instantes.';
}

export function PublicHandoverAcceptance({
  token,
  handoverPackage,
  onAccepted,
  formatDateTime,
}: PublicHandoverAcceptanceProps) {
  const printInstructionsId = 'public-handover-print-instructions';
  const [acceptedByName, setAcceptedByName] = useState('');
  const [acceptedByEmail, setAcceptedByEmail] = useState('');
  const [acceptanceNotes, setAcceptanceNotes] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isAccepted = handoverPackage.status === 'accepted';
  const receipt = handoverPackage.acceptanceReceipt;
  const printData = buildPublicHandoverAcceptancePrintData(handoverPackage);

  async function copyAcceptanceSummary() {
    setIsCopying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await navigator.clipboard.writeText(buildPublicHandoverAcceptanceSummary(handoverPackage));
      setSuccessMessage('Resumo do aceite copiado.');
    } catch {
      setErrorMessage('Nao foi possivel copiar o resumo agora.');
    } finally {
      setIsCopying(false);
    }
  }

  function printAcceptanceReceipt() {
    setErrorMessage(null);
    setSuccessMessage(null);
    window.print();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (!acceptedTerms) {
        setErrorMessage('Confirme a ciencia para registrar o aceite.');
        return;
      }

      const result = await publicHandoverApi.accept(token, {
        acceptedByName,
        acceptedByEmail,
        acceptanceNotes: acceptanceNotes.trim() || null,
        acceptedTerms: true,
      });
      onAccepted(result.package);
      setSuccessMessage('Recebimento digital confirmado com sucesso.');
    } catch (error) {
      setErrorMessage(resolveAcceptanceError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAccepted && !receipt) {
    return (
      <Card variant="raised" density="comfortable">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-success text-text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Entrega aceita</CardTitle>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                O recebimento digital deste pacote foi confirmado.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-[var(--radius-lg)] bg-bg-success px-4 py-3">
            <p className="text-xs font-medium text-text-success">Data do aceite</p>
            <p className="mt-1 text-sm leading-6 text-text-primary">{formatDateTime(handoverPackage.accepted_at)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isAccepted && receipt) {
    return (
      <>
        {printData && (
          <style>{`
            @media print {
              @page { margin: 18mm; }
              body * { visibility: hidden !important; }
              #public-handover-acceptance-print,
              #public-handover-acceptance-print * { visibility: visible !important; }
              #public-handover-acceptance-print {
                display: block !important;
                position: absolute !important;
                inset: 0 auto auto 0 !important;
                width: 100% !important;
                background: white !important;
                color: #111827 !important;
                padding: 0 !important;
              }
            }
          `}</style>
        )}
        <Card variant="raised" density="comfortable">
          <CardHeader className="pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-success text-text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base">Comprovante de aceite digital</CardTitle>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  Recebimento confirmado com o registro da entrega digital.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] bg-bg-success px-4 py-3">
                <p className="text-xs font-medium text-text-success">Status</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">Recebimento confirmado</p>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Data do aceite</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">{formatDateTime(receipt.acceptedAt)}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Aceito por</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">{receipt.acceptedByName}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Email</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">{receipt.acceptedByEmailMasked}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Data de emissao</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">{formatDateTime(receipt.issuedAt)}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Validade</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">{formatDateTime(receipt.expiresAt)}</p>
              </div>
            </div>

            {receipt.acceptanceNotes && (
              <div className="rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3">
                <p className="text-xs font-medium text-text-tertiary">Observacoes</p>
                <p className="mt-1 text-sm leading-6 text-text-primary">{receipt.acceptanceNotes}</p>
              </div>
            )}

            {errorMessage && (
              <p role="alert" className="rounded-[var(--radius-lg)] bg-bg-danger px-4 py-3 text-sm leading-6 text-text-danger">
                {errorMessage}
              </p>
            )}
            {successMessage && (
              <p aria-live="polite" className="rounded-[var(--radius-lg)] bg-bg-success px-4 py-3 text-sm leading-6 text-text-success">
                {successMessage}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="outline" loading={isCopying} onClick={() => void copyAcceptanceSummary()}>
                <Copy className="h-4 w-4" aria-hidden="true" />
                Copiar resumo do aceite
              </Button>
              {printData && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={printAcceptanceReceipt}
                  aria-describedby={printInstructionsId}
                >
                  <Printer className="h-4 w-4" aria-hidden="true" />
                  Imprimir ou salvar em PDF
                </Button>
              )}
            </div>

            <p id={printInstructionsId} className="text-sm leading-6 text-text-secondary">
              O navegador abrirá a janela de impressão. Para guardar o arquivo, escolha a opção &quot;Salvar como PDF&quot;.
            </p>
          </CardContent>
        </Card>

        {printData && (
          <section
            id="public-handover-acceptance-print"
            className="hidden font-sans text-[#111827]"
            aria-hidden="true"
          >
            <div className="mx-auto max-w-[760px] space-y-8">
              <header className="border-b border-[#d1d5db] pb-6">
                <p className="text-sm font-semibold uppercase text-[#374151]">HouseLog</p>
                <h1 className="mt-3 text-3xl font-semibold text-[#111827]">{printData.title}</h1>
                <p className="mt-2 text-base text-[#166534]">{printData.status}</p>
              </header>

              <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#6b7280]">Imovel</p>
                  <p className="mt-1 text-base font-medium">{printData.propertyName}</p>
                  <p className="mt-1 text-sm text-[#374151]">{printData.propertyAddress}</p>
                  <p className="mt-1 text-sm text-[#374151]">{printData.propertyCity}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#6b7280]">Pacote</p>
                  <p className="mt-1 text-base font-medium">{printData.packageTitle}</p>
                  <p className="mt-1 text-sm text-[#374151]">Emitido em {formatDateTime(printData.issuedAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#6b7280]">Aceito por</p>
                  <p className="mt-1 text-base font-medium">{printData.acceptedByName}</p>
                  <p className="mt-1 text-sm text-[#374151]">{printData.acceptedByEmailMasked}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#6b7280]">Data do aceite</p>
                  <p className="mt-1 text-base font-medium">{formatDateTime(printData.acceptedAt)}</p>
                </div>
                {printData.responsibleDisplay && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold uppercase text-[#6b7280]">Responsavel pela entrega</p>
                    <p className="mt-1 text-base font-medium">{printData.responsibleDisplay}</p>
                  </div>
                )}
                {printData.acceptanceNotes && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold uppercase text-[#6b7280]">Observacoes do aceite</p>
                    <p className="mt-1 text-sm leading-6 text-[#374151]">{printData.acceptanceNotes}</p>
                  </div>
                )}
              </div>

              <footer className="border-t border-[#d1d5db] pt-5 text-xs leading-5 text-[#4b5563]">
                Este comprovante foi gerado a partir do pacote publico de entrega digital HouseLog.
              </footer>
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <Card variant="raised" density="comfortable">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base">Aceite digital</CardTitle>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Confirme o recebimento deste pacote de entrega digital.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm font-medium text-text-primary">
              Nome
              <Input
                value={acceptedByName}
                onChange={(event) => setAcceptedByName(event.target.value)}
                autoComplete="name"
                required
                maxLength={120}
                placeholder="Seu nome completo"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium text-text-primary">
              Email
              <Input
                value={acceptedByEmail}
                onChange={(event) => setAcceptedByEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
                maxLength={160}
                placeholder="seu@email.com"
              />
            </label>
          </div>

          <label className="space-y-1.5 text-sm font-medium text-text-primary">
            Observacoes
            <Textarea
              value={acceptanceNotes}
              onChange={(event) => setAcceptanceNotes(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Opcional"
            />
          </label>

          <label className="flex gap-3 rounded-[var(--radius-lg)] bg-bg-subtle px-4 py-3 text-sm leading-6 text-text-secondary">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              required
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
            />
            <span>
              Declaro ciencia de que recebi acesso a este pacote digital de entrega do imovel.
            </span>
          </label>

            {errorMessage && (
              <p role="alert" className="rounded-[var(--radius-lg)] bg-bg-danger px-4 py-3 text-sm leading-6 text-text-danger">
              {errorMessage}
            </p>
          )}
          {successMessage && (
              <p aria-live="polite" className="rounded-[var(--radius-lg)] bg-bg-success px-4 py-3 text-sm leading-6 text-text-success">
              {successMessage}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} disabled={!acceptedTerms || isSubmitting} className="w-full sm:w-auto">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Confirmar recebimento digital
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
