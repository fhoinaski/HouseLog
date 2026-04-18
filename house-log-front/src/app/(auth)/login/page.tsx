'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Building2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { MfaRequiredError, useAuth } from '@/lib/auth-context';
import { authInputClass, authInputShellClass, authLabelClass } from '@/components/auth/styles';
import { Button } from '@/components/ui/button';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type FormData = z.infer<typeof schema>;

const NOISE_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg%20viewBox%3D%270%200%20200%20200%27%20xmlns%3D%27http://www.w3.org/2000/svg%27%3E%3Cfilter%20id%3D%27noiseFilter%27%3E%3CfeTurbulence%20type%3D%27fractalNoise%27%20baseFrequency%3D%270.65%27%20numOctaves%3D%273%27%20stitchTiles%3D%27stitch%27/%3E%3C/filter%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20filter%3D%27url(%23noiseFilter)%27%20opacity%3D%270.02%27/%3E%3C/svg%3E\")";

export default function LoginPage() {
  const { login, completeMfa } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const inviteMatch = redirect.match(/^\/invite\/([^/?#]+)/);
  const inviteToken = inviteMatch?.[1];
  const [error, setError] = useState<string | null>(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaDigits, setMfaDigits] = useState(['', '', '', '', '', '']);
  const [isMfaSubmitting, setIsMfaSubmitting] = useState(false);
  const mfaRefs = useRef<Array<HTMLInputElement | null>>([]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  function routeAfterAuth() {
    const rawUser = localStorage.getItem('hl_user');
    let parsedUser: { role?: string } | null = null;
    if (rawUser) {
      try {
        parsedUser = JSON.parse(rawUser) as { role?: string };
      } catch {
        parsedUser = null;
      }
    }
    if (parsedUser?.role === 'provider' || parsedUser?.role === 'temp_provider') {
      router.replace('/provider/dashboard');
      return;
    }
    router.replace(redirect);
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await login(data.email, data.password);
      routeAfterAuth();
    } catch (e) {
      if (e instanceof MfaRequiredError) {
        setMfaChallengeToken(e.challengeToken);
        setMfaDigits(['', '', '', '', '', '']);
        setError(null);
        return;
      }
      setError((e as Error).message || 'Credenciais inválidas');
    }
  }

  function handleMfaChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(0, 1);
    const next = [...mfaDigits];
    next[index] = digit;
    setMfaDigits(next);
    if (digit && index < mfaRefs.current.length - 1) {
      mfaRefs.current[index + 1]?.focus();
    }
  }

  function handleMfaKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !mfaDigits[index] && index > 0) {
      mfaRefs.current[index - 1]?.focus();
    }
  }

  async function submitMfa() {
    if (!mfaChallengeToken) return;
    const code = mfaDigits.join('');
    if (code.length !== 6) {
      setError('Digite os 6 dígitos do autenticador.');
      return;
    }
    try {
      setError(null);
      setIsMfaSubmitting(true);
      await completeMfa(mfaChallengeToken, code);
      routeAfterAuth();
    } catch (e) {
      setError((e as Error).message || 'Código inválido. Tente novamente.');
    } finally {
      setIsMfaSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-12 text-foreground selection:bg-primary-700 selection:text-[#efefff]">
      <div className="pointer-events-none absolute inset-0 z-0 opacity-100">
        <div className="absolute inset-0 opacity-2" style={{ backgroundImage: NOISE_TEXTURE }} />
        <div className="absolute -right-[8%] -top-[12%] h-[60vh] w-[60vw] rounded-full bg-[radial-gradient(circle,rgba(184,195,255,0.09)_0%,rgba(11,19,38,0)_70%)] blur-[80px]" />
        <div className="absolute -bottom-[20%] -left-[10%] h-[50vh] w-[70vw] rotate-[-15deg] bg-[linear-gradient(135deg,rgba(78,222,163,0.07)_0%,rgba(11,19,38,0)_100%)] blur-[100px]" />
        <div className="absolute left-[10%] top-[20%] h-screen w-px rotate-25 bg-linear-to-b from-[rgba(218,226,253,0.05)] to-transparent" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-[calc(100dvh-6rem)] w-full max-w-md flex-col items-center justify-center">
        <div className="mb-12 flex flex-col items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-primary-400 to-primary-700 text-[#002388] shadow-[0_24px_48px_-20px_rgba(6,14,32,0.6)]">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-[3.2rem] leading-none font-black tracking-tight text-primary-400 sm:text-[3.5rem]">
              HouseLog
            </h1>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-[#c4c5d9]/80">
            Inteligencia arquitetonica para patrimonio
          </p>
        </div>

        <div className="w-full rounded-xl border border-zinc-500/15 bg-zinc-700/45 p-8 backdrop-blur-xl shadow-[0_40px_60px_-15px_rgba(6,14,32,0.4)] sm:p-10">
          <div className="mb-8 flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-[#dae2fd]">Acessar portal</h2>
            <p className="text-sm font-medium text-[#c4c5d9]">
              {inviteToken
                ? 'Autentique-se para aceitar seu convite e entrar no ecossistema do imovel.'
                : 'Autentique-se para entrar no seu ecossistema de propriedades.'}
            </p>
          </div>

          {inviteToken && (
            <div className="mb-6 rounded-lg bg-amber-700/20 px-4 py-3 text-sm font-medium text-[#ffddb8]">
              Convite detectado. Entre ou crie sua conta para continuar.
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className={authLabelClass}>
                Endereco de email
              </label>
              <div className={authInputShellClass}>
                <Mail className="h-5 w-5 text-[#8e90a2]" />
                <input
                  id="email"
                  type="email"
                  placeholder="nome@empresa.com"
                  autoComplete="email"
                  className={authInputClass}
                  {...register('email')}
                />
              </div>
              {errors.email && <p className="text-xs text-[#ffb4ab]">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className={authLabelClass}>
                  Senha
                </label>
                <button type="button" className="text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-primary-400 transition-colors hover:text-[#dde1ff]">
                  Esqueci
                </button>
              </div>
              <div className={authInputShellClass}>
                <Lock className="h-5 w-5 text-[#8e90a2]" />
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={authInputClass}
                  {...register('password')}
                />
              </div>
              {errors.password && <p className="text-xs text-[#ffb4ab]">{errors.password.message}</p>}
            </div>

            {mfaChallengeToken && (
              <div className="flex flex-col gap-3 pt-1">
                <label className="flex items-center gap-2 text-[0.6875rem] font-bold uppercase tracking-[0.05em] text-amber-400">
                  <ShieldCheck className="h-4 w-4" />
                  Codigo do autenticador
                </label>
                <div className="flex items-center justify-between gap-2">
                  {mfaDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        mfaRefs.current[index] = el;
                      }}
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(event) => handleMfaChange(index, event.target.value)}
                      onKeyDown={(event) => handleMfaKeyDown(index, event)}
                      className="h-12 w-10 rounded-md bg-zinc-950 text-center text-xl font-bold text-[#dae2fd] transition-all duration-300 focus:-translate-y-0.5 focus:bg-[#2d3449] focus:outline-none focus:ring-1 focus:ring-amber-400"
                      aria-label={`Digito ${index + 1} do codigo MFA`}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-[#93000a]/30 px-4 py-3 text-sm text-[#ffdad6]">
                {error}
              </div>
            )}

            <Button
              type={mfaChallengeToken ? 'button' : 'submit'}
              onClick={mfaChallengeToken ? submitMfa : undefined}
              disabled={isSubmitting || isMfaSubmitting}
              size="lg"
              className="mt-2 w-full font-bold uppercase tracking-widest"
            >
              {mfaChallengeToken ? 'Validar codigo' : 'Entrar'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="relative mt-8 pt-6 text-center">
            <div className="absolute left-0 top-0 h-px w-full bg-linear-to-r from-transparent via-[#2d3449] to-transparent" />
            <p className="text-sm text-[#c4c5d9]">
              Novo no HouseLog?{' '}
              <Link
                href={inviteToken ? `/register?invite=${inviteToken}&redirect=${encodeURIComponent(redirect)}` : '/register'}
                className="font-semibold text-emerald-400 underline decoration-emerald-400/30 underline-offset-4 transition-colors hover:text-[#6ffbbe]"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 rounded-full border border-zinc-500/10 bg-zinc-950/50 px-4 py-2 backdrop-blur-md">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(78,222,163,0.6)]" />
          <span className="text-[0.6875rem] font-medium uppercase tracking-widest text-[#c4c5d9]">
            Sistema operacional
          </span>
        </div>
      </section>
    </main>
  );
}
