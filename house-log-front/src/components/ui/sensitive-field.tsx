'use client';

import * as React from 'react';
import { Copy, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { sensitiveFieldVariants } from '@/components/ui/visual-system';
import { cn } from '@/lib/utils';

export type SensitiveFieldProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onCopy'> &
  VariantProps<typeof sensitiveFieldVariants> & {
    label?: string;
    value?: string | null;
    hasValue?: boolean;
    maskedText?: string;
    emptyText?: string;
    revealLabel?: string;
    hideLabel?: string;
    copyLabel?: string;
    copiedLabel?: string;
    onReveal?: () => Promise<string | null | undefined> | string | null | undefined;
    onCopy?: (value: string) => void | Promise<void>;
    onError?: (error: unknown) => void;
  };

const SensitiveField = React.forwardRef<HTMLDivElement, SensitiveFieldProps>(
  (
    {
      className,
      tone,
      label,
      value,
      hasValue = Boolean(value),
      maskedText = 'Informacao protegida',
      emptyText = 'Sem informacao cadastrada',
      revealLabel = 'Revelar informacao',
      hideLabel = 'Ocultar informacao',
      copyLabel = 'Copiar informacao',
      copiedLabel = 'Copiado',
      onReveal,
      onCopy,
      onError,
      ...props
    },
    ref
  ) => {
    const [revealed, setRevealed] = React.useState(Boolean(value));
    const [resolvedValue, setResolvedValue] = React.useState<string | null>(value ?? null);
    const [loadingReveal, setLoadingReveal] = React.useState(false);
    const [loadingCopy, setLoadingCopy] = React.useState(false);
    const [copied, setCopied] = React.useState(false);

    React.useEffect(() => {
      setResolvedValue(value ?? null);
      setRevealed(Boolean(value));
    }, [value]);

    const state = !hasValue ? 'empty' : revealed && resolvedValue ? 'revealed' : 'masked';
    const displayValue = state === 'revealed' ? resolvedValue : hasValue ? maskedText : emptyText;

    async function handleReveal() {
      if (!hasValue) return;

      if (revealed) {
        setRevealed(false);
        return;
      }

      if (resolvedValue) {
        setRevealed(true);
        return;
      }

      if (!onReveal) return;

      setLoadingReveal(true);
      try {
        const nextValue = await onReveal();
        if (nextValue) {
          setResolvedValue(nextValue);
          setRevealed(true);
        }
      } catch (error) {
        onError?.(error);
      } finally {
        setLoadingReveal(false);
      }
    }

    async function handleCopy() {
      if (!resolvedValue) return;

      setLoadingCopy(true);
      try {
        await navigator.clipboard.writeText(resolvedValue);
        await onCopy?.(resolvedValue);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch (error) {
        onError?.(error);
      } finally {
        setLoadingCopy(false);
      }
    }

    return (
      <div
        ref={ref}
        className={cn(sensitiveFieldVariants({ tone, state, className }))}
        data-state={state}
        {...props}
      >
        <ShieldCheck className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          {label && <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</p>}
          <code
            className={cn(
              'block truncate text-xs font-mono',
              state === 'revealed' ? 'text-text-primary' : 'text-text-secondary'
            )}
            aria-live="polite"
          >
            {displayValue}
          </code>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-9 w-9 text-text-secondary hover:text-text-primary"
            disabled={!hasValue || loadingReveal || (!resolvedValue && !onReveal)}
            aria-label={revealed ? hideLabel : revealLabel}
            onClick={handleReveal}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="min-h-9 w-9 text-text-secondary hover:text-text-accent"
            disabled={!resolvedValue || loadingCopy}
            aria-label={copyLabel}
            onClick={handleCopy}
          >
            {copied ? <span className="text-[11px] font-medium text-text-success">{copiedLabel}</span> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }
);

SensitiveField.displayName = 'SensitiveField';

export { SensitiveField };
