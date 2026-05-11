'use client';

import { useState, type FormEvent } from 'react';
import { CheckCircle2, ClipboardCheck, Copy, ShieldCheck } from 'lucide-react';
import { buildPublicHandoverAcceptanceSummary, type HandoverPackagePublic } from '@houselog/contracts';

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
      <Card variant="raised" density="comfortable">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-success text-text-success">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base">Comprovante de aceite digital</CardTitle>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Recebimento confirmado com trilha operacional do pacote emitido.
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
            <p className="rounded-[var(--radius-lg)] bg-bg-danger px-4 py-3 text-sm leading-6 text-text-danger">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p className="rounded-[var(--radius-lg)] bg-bg-success px-4 py-3 text-sm leading-6 text-text-success">
              {successMessage}
            </p>
          )}

          <Button type="button" variant="outline" loading={isCopying} onClick={() => void copyAcceptanceSummary()}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copiar resumo do aceite
          </Button>
        </CardContent>
      </Card>
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
            <p className="rounded-[var(--radius-lg)] bg-bg-danger px-4 py-3 text-sm leading-6 text-text-danger">
              {errorMessage}
            </p>
          )}
          {successMessage && (
            <p className="rounded-[var(--radius-lg)] bg-bg-success px-4 py-3 text-sm leading-6 text-text-success">
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
