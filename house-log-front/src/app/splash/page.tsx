import Link from 'next/link';
import { ArrowRight, Building2, CalendarCheck, ClipboardCheck, FileText, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

const pillars = [
  {
    icon: ClipboardCheck,
    title: 'Ordens de serviço',
    text: 'Solicitação, orçamento, aprovação e execução em um fluxo rastreável.',
  },
  {
    icon: CalendarCheck,
    title: 'Agenda operacional',
    text: 'Visitas, manutenção preventiva e prioridades do dia em leitura rápida.',
  },
  {
    icon: FileText,
    title: 'Documentos e histórico',
    text: 'Decisões, anexos e evidências preservados por imóvel e serviço.',
  },
];

export default function SplashPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-hl-bg px-4 py-5 text-hl-text sm:px-6 lg:px-8">
      <section className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1180px] flex-col">
        <header className="flex items-center justify-between gap-4 py-2">
          <Link href="/splash" className="inline-flex items-center gap-3 rounded-[var(--hl-radius-control)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--hl-primary)_15%,transparent)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--hl-radius-control)] bg-hl-surface-muted text-hl-primary">
              <Building2 className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-lg font-medium text-hl-text">HouseLog</span>
              <span className="block text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Calm OS</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild variant="tonal" size="sm" className="hidden sm:inline-flex">
              <Link href="/register">Criar conta</Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.08fr_0.92fr] lg:py-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-hl-surface-muted px-3 py-1 text-xs font-medium text-hl-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Gestão operacional de imóveis
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-tight text-hl-text sm:text-5xl">
              A inteligência por trás do seu patrimônio.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-hl-text-muted sm:text-lg">
              Conecte proprietários, gestores e prestadores em uma operação clara, rastreável e pronta para manutenção real.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="sm:min-w-44">
                <Link href="/login">
                  Começar jornada
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="sm:min-w-40">
                <Link href="/register">Criar conta</Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {pillars.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-4 shadow-hl-subtle">
                  <Icon className="h-5 w-5 text-hl-primary" strokeWidth={1.8} />
                  <p className="mt-4 text-sm font-medium text-hl-text">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-hl-text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--hl-radius-card)] border border-hl-border bg-hl-surface p-5 shadow-hl-soft sm:p-6">
            <div className="rounded-[var(--hl-radius-card)] bg-hl-surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">Lente operacional</p>
                  <h2 className="mt-2 text-2xl font-medium text-hl-text">Hoje</h2>
                </div>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--hl-success)_12%,var(--hl-surface))] px-3 py-1 text-xs font-medium text-hl-success">Estável</span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {['Ativo', 'OS', 'Agenda'].map((label) => (
                  <div key={label} className="rounded-[var(--hl-radius-control)] bg-hl-surface-muted p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-hl-text-muted">{label}</p>
                    <div className="mt-4 h-1.5 rounded-full bg-hl-border" />
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {[
                  ['Solicitação registrada', 'Contexto, prioridade e evidências no mesmo ponto.'],
                  ['Orçamento em análise', 'Decisão clara antes da execução do serviço.'],
                  ['Execução documentada', 'Histórico preservado para auditoria operacional.'],
                ].map(([title, subtitle]) => (
                  <div key={title} className="rounded-[var(--hl-radius-control)] bg-hl-surface-muted px-3 py-3">
                    <p className="text-sm font-medium text-hl-text">{title}</p>
                    <p className="mt-1 text-xs text-hl-text-muted">{subtitle}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-hl-text-muted">
              Interface editorial, técnica e mobile-first para decisões de patrimônio.
            </p>
          </div>
        </div>

        <footer className="pb-3 text-center text-xs text-hl-text-muted">v 2.0.4 · HouseLog Calm OS</footer>
      </section>
    </main>
  );
}
