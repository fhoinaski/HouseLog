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
    <main className="relative min-h-screen overflow-hidden bg-bg-page px-4 py-5 text-text-primary sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(184,195,255,0.16),transparent_28rem),radial-gradient(circle_at_90%_12%,rgba(78,222,163,0.09),transparent_24rem)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <section className="relative mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-[1120px] items-center gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="hidden lg:block">
          <Link href="/splash" className="inline-flex items-center gap-3 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-tonal-bg)] text-text-accent">
              <Building2 className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-lg font-medium text-text-primary">HouseLog</span>
              <span className="block text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Architectural Lens</span>
            </span>
          </Link>

          <div className="mt-12 max-w-xl">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-accent">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-medium leading-tight text-text-primary">
              Gestão operacional com presença, contexto e precisão.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-text-secondary">
              HouseLog organiza patrimônio, manutenção e prestadores em uma interface técnica, discreta e pronta para decisões rápidas.
            </p>
          </div>

          <div className="mt-10 grid max-w-xl gap-3">
            {lensPoints.map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-[var(--radius-xl)] bg-[var(--surface-glass)] p-4 shadow-[var(--shadow-xs)] backdrop-blur-[var(--surface-blur)]">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-tonal-bg)] text-text-accent">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-text-primary">{label}</span>
                    <span className="mt-1 block text-sm leading-6 text-text-secondary">{value}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className={cn('mx-auto w-full max-w-[430px]', className)}>
          <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-glass)] p-5 shadow-[var(--shadow-lg)] backdrop-blur-[var(--surface-blur)] sm:p-6">
            <header className="mb-7">
              <Link href="/splash" className="mb-7 inline-flex items-center gap-3 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)] lg:hidden">
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-tonal-bg)] text-text-accent">
                  <Building2 className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-base font-medium text-text-primary">HouseLog</span>
                  <span className="block text-[10px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Architectural Lens</span>
                </span>
              </Link>

              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--button-tonal-bg)] px-3 py-1 text-xs font-medium text-text-accent">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h2 className="mt-4 text-2xl font-medium leading-tight text-text-primary">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
            </header>

            {children}
          </div>

          {footer && <div className="mt-5 text-center text-xs leading-5 text-text-tertiary">{footer}</div>}
        </div>
      </section>
    </main>
  );
}
