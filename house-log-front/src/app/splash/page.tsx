import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';

const noiseTexture = {
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
  opacity: 0.02,
} as const;

export default function SplashPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-page text-text-primary">
      <div className="pointer-events-none fixed inset-0 z-10" style={noiseTexture} />

      <main className="relative z-20 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-14 px-6 text-center">
        <div className="space-y-6">
          <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
            <div className="flex h-full w-full rotate-45 items-center justify-center rounded-3xl border-half border-border-subtle bg-bg-surface">
              <Building2 className="h-10 w-10 -rotate-45 text-text-accent" />
            </div>
          </div>

          <h1 className="text-3xl font-medium tracking-tight text-text-primary md:text-3xl">HouseLog</h1>
          <p className="mx-auto max-w-72 text-base font-regular tracking-wide text-text-secondary md:text-lg">
            A inteligência por trás do seu patrimônio
          </p>
        </div>

        <div className="w-full pt-4">
          <Link
            href="/dashboard"
            className="hl-btn-primary group relative flex w-full overflow-hidden px-8"
          >
            <span className="relative">Começar jornada</span>
            <ArrowRight className="relative ml-3 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </main>

      <div className="pointer-events-none absolute bottom-8 z-20 w-full text-center">
        <p className="text-xs font-medium tracking-wide text-text-tertiary">v 2.0.4 — Architectural Lens</p>
      </div>
    </div>
  );
}
