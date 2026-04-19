'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EntryShell } from '@/components/auth/entry-shell';

type Role = 'owner' | 'manager' | 'provider' | 'temp_provider' | 'admin';

const loginSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
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
        toast.error('Verifique sua conexão');
        return;
      }

      toast.error('Credenciais inválidas', {
        description: message,
      });
    }
  }

  return (
    <EntryShell
      eyebrow="Acesso seguro"
      title="Entre no centro operacional"
      description="Acesse imóveis, ordens de serviço, orçamento, agenda e histórico com uma leitura objetiva."
      footer={`HouseLog v1.0.0 · Gestão operacional de imóveis · ${currentYear}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" {...register('email')} />
          {errors.email && <p className="hl-error">{errors.email.message}</p>}
        </div>

        <div>
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-12"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-md)] text-text-tertiary transition-colors hover:bg-[var(--interactive-ghost-hover)] hover:text-text-primary focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
          {errors.password && <p className="hl-error">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="flex min-h-11 items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" className="h-4 w-4 accent-[var(--provider-accent)]" {...register('remember')} />
            Lembrar de mim
          </label>
          <button type="button" className="min-h-11 rounded-[var(--radius-md)] px-1 text-sm font-medium text-text-accent transition-colors hover:text-text-accent-subtle focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]">
            Esqueceu a senha?
          </button>
        </div>

        <Button type="submit" size="lg" loading={isSubmitting} disabled={isSubmitting} className="w-full">
          {!isSubmitting && <LogIn className="h-4 w-4" />}
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-[var(--divider-color)]" />
          <span className="text-xs text-text-tertiary">ou</span>
          <span className="h-px flex-1 bg-[var(--divider-color)]" />
        </div>

        <Button type="button" variant="outline" size="lg" className="w-full">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path fill="currentColor" d="M12 10.2v3.9h5.4c-.2 1.2-1.4 3.5-5.4 3.5-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.2 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c6.9 0 9.1-4.8 9.1-7.3 0-.5-.1-.9-.1-1.3H12z" />
          </svg>
          Continuar com Google
        </Button>

        <p className="pt-1 text-center text-sm text-text-secondary">
          Não tem uma conta?{' '}
          <Link href="/register" className="font-medium text-text-accent hover:text-text-accent-subtle">
            Criar conta
          </Link>
        </p>
      </form>
    </EntryShell>
  );
}
