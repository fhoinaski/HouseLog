'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Home, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Role = 'owner' | 'manager' | 'provider' | 'temp_provider' | 'admin';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail valido'),
  password: z.string().min(6, 'A senha deve ter no minimo 6 caracteres'),
  remember: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function redirectByRole(role: Role): string {
  if (role === 'provider' || role === 'temp_provider') return '/provider/dashboard';
  return '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: false },
  });

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  async function onSubmit(values: LoginFormValues) {
    try {
      await login(values.email, values.password);

      const userRaw = localStorage.getItem('hl_user');
      const role = userRaw ? (JSON.parse(userRaw) as { role?: Role }).role : 'owner';
      router.push(redirectByRole(role ?? 'owner'));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao entrar';
      const normalized = message.toLowerCase();

      if (normalized.includes('network') || normalized.includes('fetch')) {
        toast.error('Verifique sua conexao');
        return;
      }

      toast.error('Credenciais invalidas', {
        description: message,
      });
    }
  }

  return (
    <main className="min-h-screen bg-(--hl-bg-page) px-6 py-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-97.5 flex-col">
        <div className="rounded-xl border border-neutral-100 bg-(--hl-bg-card) px-6 pb-6 pt-8">
          <header className="mb-8 flex flex-col items-center text-center">
            <div className="mb-3 flex h-13 w-13 items-center justify-center rounded-[14px] border-[1.5px] border-(--hl-border-light)">
              <Home className="h-6 w-6 text-(--color-primary)" strokeWidth={1.9} />
            </div>
            <h1 className="text-[24px] font-medium tracking-[-0.3px] text-(--hl-text-primary)">HouseLog</h1>
            <p className="mt-1 text-[11px] uppercase tracking-widest text-(--hl-text-tertiary)">
              THE ARCHITECTURAL LENS
            </p>
          </header>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <Label htmlFor="email">E-MAIL</Label>
              <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" {...register('email')} />
              {errors.email && (
                <p className="mt-1 text-[12px] text-(--hl-accent-red)">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">SENHA</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-8"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-(--hl-text-tertiary)"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-[12px] text-(--hl-accent-red)">{errors.password.message}</p>
              )}
            </div>

            <div className="mb-6 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-(--hl-text-secondary)">
                <input type="checkbox" {...register('remember')} />
                Lembrar de mim
              </label>
              <button type="button" className="text-[13px] font-medium text-(--hl-accent-orange)">
                Esqueceu a senha?
              </button>
            </div>

            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Entrar
                </>
              )}
            </Button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-(--hl-border-light)" />
              <span className="text-[12px] text-(--hl-text-tertiary)">ou</span>
              <span className="h-px flex-1 bg-(--hl-border-light)" />
            </div>

            <Button type="button" variant="outline" size="lg" className="w-full">
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path fill="currentColor" d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.5-5.4 3.5-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.2 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z" />
              </svg>
              Continuar com Google
            </Button>

            <p className="pt-1 text-center text-[13px] text-(--hl-text-secondary)">
              Nao tem uma conta?{' '}
              <Link href="/register" className="font-medium text-(--color-primary)">
                Criar conta
              </Link>
            </p>
          </form>
        </div>

        <footer className="mt-auto pt-6 text-center text-[11px] text-(--hl-text-tertiary)">
          HouseLog v1.0.0 · Gestao Operacional de Imoveis · {currentYear}
        </footer>
      </section>
    </main>
  );
}
