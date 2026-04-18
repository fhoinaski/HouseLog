'use client';

import { useMemo, useState } from 'react';
import { Send, Wallet, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type ProviderBidDialogProps = {
  requestId: string;
  requestTitle: string;
};

export function ProviderBidDialog({ requestId, requestTitle }: ProviderBidDialogProps) {
  const [open, setOpen] = useState(false);
  const [technicalProposal, setTechnicalProposal] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFormValid = useMemo(() => {
    const parsedAmount = Number(amount);
    return technicalProposal.trim().length >= 20 && Number.isFinite(parsedAmount) && parsedAmount > 0;
  }, [technicalProposal, amount]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      // Placeholder behavior for UI-first flow.
      // Integrate API call here when endpoint contract is finalized in the provider app.
      await new Promise((resolve) => setTimeout(resolve, 500));
      setOpen(false);
      setTechnicalProposal('');
      setAmount('');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Send className="h-4 w-4" />
          Enviar Orcamento
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wrench className="h-5 w-5 text-primary-500" />
            Enviar Orcamento
          </DialogTitle>
          <DialogDescription>
            Solicitação: <span className="font-medium text-[var(--foreground)]">{requestTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input type="hidden" name="service_request_id" value={requestId} />

          <div className="space-y-2">
            <Label htmlFor={`proposal-${requestId}`}>Proposta tecnica</Label>
            <Textarea
              id={`proposal-${requestId}`}
              name="scope"
              value={technicalProposal}
              onChange={(event) => setTechnicalProposal(event.target.value)}
              placeholder="Descreva abordagem, materiais, prazo e etapas de execucao."
              className="min-h-36"
              required
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Minimo recomendado de 20 caracteres para dar contexto tecnico.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`amount-${requestId}`}>Valor do orcamento (R$)</Label>
            <div className="relative">
              <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <Input
                id={`amount-${requestId}`}
                name="amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="pl-10"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!isFormValid || isSubmitting}>
              <Send className="h-4 w-4" />
              Confirmar Envio
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
