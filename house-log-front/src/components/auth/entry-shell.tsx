import type { ReactNode } from 'react';
import Link from 'next/link';
import { Building2, CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type EntryShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

const lensPoints = [
  { icon: Building2, label: 'Patrimônio', value: 'Ativos, cômodos e inventário em leitura única.' },
  { icon: ClipboardCheck, label: 'Operação', value: 'OS, orçamento, aprovação e execução no mesmo trilho.' },
  { icon: ShieldCheck, label: 'Rastreio', value: 'Histórico, documentos e decisões com contexto preservado.' },
];

export function EntryShell({ eyebrow, title, description, children, footer, className }: EntryShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-hl-bg px-4 py-5 text-hl-text sm:px-6 lg:px-8">
      <section className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-[1120px] items-center gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="hidden lg:block">
          <Link href="/splash" className="inline-flex items-center gap-3 rounded-[var(--hl-radius-control)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
              <Building2 className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-lg font-medium text-hl-text">HouseLog</span>
              <span className="block text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Calm OS</span>
            </span>
          </Link>

          <div className="mt-12 max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-primary">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-medium leading-tight text-hl-text">
              Gestão operacional com presença, contexto e precisão.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-hl-text-muted">
              HouseLog organiza patrimônio, manutenção e prestadores em uma interface técnica, discreta e pronta para decisões rápidas.
            </p>
          </div>

          <div className="mt-10 grid max-w-xl gap-3">
            {lensPoints.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-hl-text">{label}</span>
                    <span className="mt-1 block text-sm leading-6 text-hl-text-muted">{value}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className={cn('mx-auto w-full max-w-[430px]', className)}>
          <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-5 shadow-hl-soft sm:p-6">
            <header className="mb-7">
              <Link href="/splash" className="mb-7 inline-flex items-center gap-3 rounded-[var(--hl-radius-control)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)] lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
                  <Building2 className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-base font-medium text-hl-text">HouseLog</span>
                  <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-hl-text-muted">Calm OS</span>
                </span>
              </Link>

              <div className="inline-flex items-center gap-2 rounded-full bg-hl-surface-muted px-3 py-1 text-xs font-medium text-hl-primary">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h2 className="mt-4 text-2xl font-medium leading-tight text-hl-text">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-hl-text-muted">{description}</p>
            </header>

            {children}
          </div>

          {footer && <div className="mt-5 text-center text-xs leading-5 text-hl-text-muted">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
