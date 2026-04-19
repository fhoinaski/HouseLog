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
    <main className="relative min-h-screen overflow-hidden bg-bg-page px-4 py-5 text-text-primary sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(184,195,255,0.17),transparent_28rem),radial-gradient(circle_at_88%_6%,rgba(78,222,163,0.10),transparent_26rem)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <section className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-[1180px] flex-col">
        <header className="flex items-center justify-between gap-4 py-2">
          <Link href="/splash" className="inline-flex items-center gap-3 rounded-[var(--radius-md)] focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--button-tonal-bg)] text-text-accent">
              <Building2 className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span>
              <span className="block text-lg font-medium text-text-primary">HouseLog</span>
              <span className="block text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Architectural Lens</span>
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
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--button-tonal-bg)] px-3 py-1 text-xs font-medium text-text-accent">
              <ShieldCheck className="h-3.5 w-3.5" />
              Gestão operacional de imóveis
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-medium leading-tight text-text-primary sm:text-5xl">
              A inteligência por trás do seu patrimônio.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-text-secondary sm:text-lg">
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
                <div key={title} className="rounded-[var(--radius-xl)] bg-[var(--surface-glass)] p-4 shadow-[var(--shadow-xs)] backdrop-blur-[var(--surface-blur)]">
                  <Icon className="h-5 w-5 text-text-accent" strokeWidth={1.8} />
                  <p className="mt-4 text-sm font-medium text-text-primary">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-text-secondary">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[var(--radius-2xl)] bg-[var(--surface-glass)] p-5 shadow-[var(--shadow-lg)] backdrop-blur-[var(--surface-blur)] sm:p-6">
            <div className="rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">Lente operacional</p>
                  <h2 className="mt-2 text-2xl font-medium text-text-primary">Hoje</h2>
                </div>
                <span className="rounded-full bg-bg-success px-3 py-1 text-xs font-medium text-text-success">Estável</span>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {['Ativo', 'OS', 'Agenda'].map((label) => (
                  <div key={label} className="rounded-[var(--radius-md)] bg-[var(--surface-strong)] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">{label}</p>
                    <div className="mt-4 h-1.5 rounded-full bg-[var(--button-tonal-bg)]" />
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-2">
                {[
                  ['Solicitação registrada', 'Contexto, prioridade e evidências no mesmo ponto.'],
                  ['Orçamento em análise', 'Decisão clara antes da execução do serviço.'],
                  ['Execução documentada', 'Histórico preservado para auditoria operacional.'],
                ].map(([title, subtitle]) => (
                  <div key={title} className="rounded-[var(--radius-md)] bg-[var(--surface-strong)] px-3 py-3">
                    <p className="text-sm font-medium text-text-primary">{title}</p>
                    <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-text-tertiary">
              Interface editorial, técnica e mobile-first para decisões de patrimônio.
            </p>
          </div>
        </div>

        <footer className="pb-3 text-center text-xs text-text-tertiary">v 2.0.4 · Architectural Lens</footer>
      </section>
    </main>
  );
}
