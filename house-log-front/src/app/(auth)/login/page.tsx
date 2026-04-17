'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, ShieldCheck, BarChart3, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type FormData = z.infer<typeof schema>;

const FEATURES = [
  { icon: Building2,    text: 'Gestão completa de múltiplos imóveis' },
  { icon: Wrench,       text: 'Ordens de serviço e manutenção preventiva' },
  { icon: BarChart3,    text: 'Relatórios financeiros e health score' },
  { icon: ShieldCheck,  text: 'Equipes com controle de permissões' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await login(data.email, data.password);
      router.push(redirect);
    } catch (e) {
      setError((e as Error).message || 'Credenciais inválidas');
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — decorative */}
      <div className="hidden lg:flex lg:w-[44%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #0d1117 0%, #111827 100%)' }}>
        {/* Gradient orb */}
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #4f46e5, transparent)' }} />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-700/40">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">HouseLog</span>
        </div>

        {/* Headline */}
        <div className="relative space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Gestão de imóveis<br />
              <span style={{ background: 'linear-gradient(90deg, #818cf8, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                inteligente e profissional
              </span>
            </h2>
            <p className="mt-3 text-slate-400 text-sm leading-relaxed">
              Controle total do seu patrimônio imobiliário em um só lugar.
            </p>
          </div>

          <ul className="space-y-3">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 border border-primary-500/20">
                  <Icon className="h-3.5 w-3.5 text-primary-400" />
                </div>
                <span className="text-sm text-slate-400">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-slate-600">© 2025 HouseLog. Todos os direitos reservados.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 bg-[var(--background)]">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">HouseLog</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Entrar na conta</h1>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Bem-vindo de volta ao HouseLog
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-[0_4px_24px_var(--shadow-color)]">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-rose-500">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-rose-500">{errors.password.message}</p>
                )}
              </div>

              {error && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-400">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                Entrar
              </Button>
            </form>

            <div className="mt-5 pt-5 border-t border-[var(--border)] text-center text-sm text-[var(--muted-foreground)]">
              Não tem conta?{' '}
              <Link href="/register" className="font-semibold text-primary-500 hover:text-primary-600 transition-colors">
                Criar conta grátis
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
