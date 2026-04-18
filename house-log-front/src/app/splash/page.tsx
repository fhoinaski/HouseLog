import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';

const noiseTexture = {
  backgroundImage:
    'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
  opacity: 0.02,
} as const;

export default function SplashPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-900 text-[#dae2fd]">
      <div className="pointer-events-none fixed inset-0 z-10" style={noiseTexture} />

      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/4 top-1/4 h-160 w-160 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-400/10 blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 h-120 w-120 translate-x-1/2 translate-y-1/2 rounded-full bg-emerald-400/10 blur-[90px]" />
        <div className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 bg-zinc-950/40 backdrop-blur-3xl" />
      </div>

      <main className="relative z-20 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-14 px-6 text-center">
        <div className="space-y-6">
          <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary-400/20 blur-[30px]" />
            <div className="flex h-full w-full rotate-45 items-center justify-center rounded-3xl border border-zinc-500/40 bg-[#2d3449]/60 shadow-[0_40px_60px_rgba(6,14,32,0.6)] backdrop-blur-2xl">
              <Building2 className="h-10 w-10 -rotate-45 text-primary-400" />
            </div>
          </div>

          <h1 className="text-5xl font-black tracking-tight text-primary-400 md:text-6xl">HouseLog</h1>
          <p className="mx-auto max-w-72 text-base font-light tracking-wide text-[#c4c5d9] md:text-lg">
            A inteligencia por tras do seu patrimonio
          </p>
        </div>

        <div className="w-full pt-4">
          <Link
            href="/dashboard"
            className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-linear-to-r from-primary-400 to-primary-700 px-8 py-4 text-base font-bold uppercase tracking-widest text-white shadow-[0_10px_30px_-10px_rgba(46,91,255,0.25)] transition-all duration-300 hover:scale-[1.02] hover:brightness-110 active:scale-95"
          >
            <span className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-linear-to-r from-white/10 to-transparent" />
            <span className="relative">Comecar jornada</span>
            <ArrowRight className="relative ml-3 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </main>

      <div className="pointer-events-none absolute bottom-8 z-20 w-full text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#8e90a2]">v 2.0.4 - Architectural Lens</p>
      </div>
    </div>
  );
}
