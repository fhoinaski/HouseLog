'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type PremiumFormSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export function PremiumFormSection({ title, description, children }: PremiumFormSectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>
        {description && <p className="text-xs leading-5 text-text-secondary">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function PremiumFormGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

export function PremiumFormError({ error }: { error?: string | null }) {
  if (!error) return null;

  return (
    <div className="rounded-[var(--radius-md)] border-half border-border-danger bg-bg-danger px-3 py-2 text-sm text-text-danger">
      {error}
    </div>
  );
}

type PremiumFormActionsProps = {
  submitting: boolean;
  submitLabel: string;
  onCancel: () => void;
};

export function PremiumFormActions({ submitting, submitLabel, onCancel }: PremiumFormActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-border-subtle pt-4 sm:flex-row sm:justify-between">
      <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" loading={submitting}>
        {submitLabel}
      </Button>
    </div>
  );
}
