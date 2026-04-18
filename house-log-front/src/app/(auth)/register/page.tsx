'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, Building2, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { invitesApi } from '@/lib/api';
import { authInputClass, authInputShellClass, authLabelClass } from '@/components/auth/styles';
import { Button } from '@/components/ui/button';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  confirmPassword: z.string().min(8, 'Confirme sua senha'),
  role: z.enum(['admin', 'owner', 'provider']),
  phone: z.string().optional(),
  termsAccepted: z.boolean().refine((value) => value, {
    message: 'Você precisa aceitar os termos para continuar',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não conferem',
  path: ['confirmPassword'],
});

type FormData = z.infer<typeof schema>;

const NOISE_TEXTURE =
  "url(\"data:image/svg+xml,%3Csvg%20viewBox%3D%270%200%20200%20200%27%20xmlns%3D%27http://www.w3.org/2000/svg%27%3E%3Cfilter%20id%3D%27noiseFilter%27%3E%3CfeTurbulence%20type%3D%27fractalNoise%27%20baseFrequency%3D%270.65%27%20numOctaves%3D%273%27%20stitchTiles%3D%27stitch%27/%3E%3C/filter%3E%3Crect%20width%3D%27100%25%27%20height%3D%27100%25%27%20filter%3D%27url(%23noiseFilter)%27%20opacity%3D%270.02%27/%3E%3C/svg%3E\")";

const ROLE_OPTIONS: Array<{ value: FormData['role']; title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  {
    value: 'owner',
    title: 'Proprietário',
    description: 'Gestão do patrimônio e operações',
    icon: Building2,
  },
  {
    value: 'provider',
    title: 'Prestador',
    description: 'Execução de serviços e propostas',
    icon: ShieldCheck,
  },
  {
    value: 'admin',
    title: 'Administrador',
    description: 'Controle operacional avançado',
    icon: UserRound,
  },
];

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const inviteRole = searchParams.get('role');
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);
  const [isProviderInviteLocked, setIsProviderInviteLocked] = useState(false);
  const [step, setStep] = useState<'role' | 'details'>('role');

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'owner', termsAccepted: false },
  });

  const selectedRole = watch('role');
  const selectedRoleMeta = ROLE_OPTIONS.find((option) => option.value === selectedRole);

  useEffect(() => {
    let active = true;

    async function resolveInviteRole() {
      if (!inviteToken) return;
      try {
        const invite = await invitesApi.getInvite(inviteToken);
        if (!active) return;
        if (invite.role === 'provider') {
          setIsProviderInviteLocked(true);
          setValue('role', 'provider');
        }
      } catch {
        // Ignore; token validity is handled in invite acceptance flow.
      }
    }

    void resolveInviteRole();

    return () => {
      active = false;
    };
  }, [inviteToken, setValue]);

  useEffect(() => {
    const qName = searchParams.get('name');
    const qEmail = searchParams.get('email');
    const qPhone = searchParams.get('phone');
    const qRole = searchParams.get('role');

    if (qName) setValue('name', qName);
    if (qEmail) setValue('email', qEmail);
    if (qPhone) setValue('phone', qPhone);

    if (qRole === 'provider') setValue('role', 'provider');
    if (qRole === 'manager') setValue('role', 'owner');
    if (qRole === 'viewer') setValue('role', 'owner');
  }, [searchParams, setValue]);

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: isProviderInviteLocked ? 'provider' : data.role,
      });

      if (inviteToken) {
        const accepted = await invitesApi.acceptInvite(inviteToken);
        if (accepted.role === 'provider' || isProviderInviteLocked) {
          router.push('/provider/dashboard');
          return;
        }
        router.push(`/properties/${accepted.property_id}`);
        return;
      }

      router.push(redirect);
    } catch (e) {
      setError((e as Error).message || 'Erro ao criar conta');
    }
  }

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-background text-on-surface antialiased selection:bg-primary-700 selection:text-[#efefff]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-2" style={{ backgroundImage: NOISE_TEXTURE }} />

      <section className="relative hidden w-5/12 overflow-hidden bg-zinc-950 lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_20%,rgba(184,195,255,0.18),transparent_45%),radial-gradient(ellipse_at_85%_75%,rgba(78,222,163,0.14),transparent_45%),linear-gradient(160deg,#060e20_0%,#131b2e_55%,#222a3d_100%)]" />
        <div className="absolute inset-0 bg-linear-to-r from-background/90 via-background/55 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-600/70 shadow-[0_0_30px_rgba(184,195,255,0.1)]">
              <Building2 className="h-5 w-5 text-primary-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-[#dae2fd]">HouseLog</span>
          </div>

          <div className="max-w-md">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary-400">Nível corporativo</p>
            <h2 className="mb-4 text-3xl font-semibold leading-tight text-[#dae2fd]">
              Integridade estrutural com clareza digital.
            </h2>
            <p className="text-[#c4c5d9]">
              O centro de comando para portfólios imobiliários e gestão arquitetônica de ativos.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 flex w-full items-center justify-center p-6 sm:p-12 md:p-16 lg:w-7/12">
        <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-150 w-150 rounded-full bg-primary-700/10 blur-[120px]" />

        <div className="relative z-10 flex w-full max-w-115 flex-col gap-10">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-600">
              <Building2 className="h-4 w-4 text-primary-400" />
            </div>
            <span className="text-xl font-bold tracking-tight text-[#dae2fd]">HouseLog</span>
          </div>

          {step === 'role' ? (
            <>
              <header className="flex flex-col gap-3">
                <h1 className="text-4xl leading-none font-bold tracking-tight text-[#dae2fd] sm:text-[2.75rem]">
                  Escolha seu perfil
                </h1>
                <p className="text-lg text-[#c4c5d9]">
                  Defina como voce vai usar o HouseLog para continuar o cadastro.
                </p>
              </header>

              {inviteToken && (
                <div className="rounded-lg bg-amber-700/20 px-4 py-3 text-sm font-medium text-[#ffddb8]">
                  Você está se cadastrando por convite. O acesso será liberado automaticamente ao concluir.
                </div>
              )}

              <div className="flex flex-col gap-3">
                <label className={authLabelClass}>Tipo de perfil</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {ROLE_OPTIONS.map(({ value, title, description, icon: Icon }) => {
                    const disabled = isProviderInviteLocked && value !== 'provider';
                    return (
                      <label key={value} className={`relative cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
                        <input
                          type="radio"
                          value={value}
                          className="peer sr-only"
                          checked={selectedRole === value}
                          disabled={disabled}
                          onChange={() => setValue('role', value)}
                        />
                        <div className="h-full rounded-xl bg-zinc-800 p-4 transition-all duration-300 peer-checked:bg-zinc-600 peer-checked:shadow-[inset_0_0_0_1px_rgba(184,195,255,0.15)]">
                          <Icon className="mb-3 h-5 w-5 text-[#8e90a2] transition-colors peer-checked:text-primary-400" />
                          <p className="text-sm font-semibold text-[#dae2fd]">{title}</p>
                          <p className="mt-1 text-xs text-[#c4c5d9]">{description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {(inviteRole === 'provider' || isProviderInviteLocked) && (
                  <p className="text-xs text-[#c4c5d9]">
                    Perfil definido pelo convite: Prestador de Serviço (não editável).
                  </p>
                )}
              </div>

              <Button size="lg" className="w-full uppercase tracking-wide" onClick={() => setStep('details')}>
                Continuar
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="text-center">
                <p className="text-sm text-[#c4c5d9]">
                  Já tem conta?{' '}
                  <Link href="/login" className="font-medium text-primary-400 transition-colors hover:text-[#dde1ff]">
                    Entrar
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <header className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-4xl leading-none font-bold tracking-tight text-[#dae2fd] sm:text-[2.75rem]">
                    Criar conta
                  </h1>
                  <button
                    type="button"
                    onClick={() => setStep('role')}
                    className="text-xs font-semibold uppercase tracking-widest text-primary-400 transition-colors hover:text-[#dde1ff]"
                  >
                    Alterar perfil
                  </button>
                </div>
                <p className="text-lg text-[#c4c5d9]">
                  Perfil selecionado:{' '}
                  <span className="font-semibold text-primary-400">{selectedRoleMeta?.title ?? 'Proprietário'}</span>
                </p>
              </header>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="name" className={authLabelClass}>Nome completo</label>
                    <div className={authInputShellClass}>
                      <UserRound className="h-5 w-5 text-[#8e90a2]" />
                      <input
                        id="name"
                        type="text"
                        placeholder="Digite seu nome completo"
                        className={authInputClass}
                        {...register('name')}
                      />
                    </div>
                    {errors.name && <p className="text-xs text-[#ffb4ab]">{errors.name.message}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className={authLabelClass}>Email</label>
                    <div className={authInputShellClass}>
                      <Mail className="h-5 w-5 text-[#8e90a2]" />
                      <input
                        id="email"
                        type="email"
                        placeholder="nome@dominio.com"
                        className={authInputClass}
                        {...register('email')}
                      />
                    </div>
                    {errors.email && <p className="text-xs text-[#ffb4ab]">{errors.email.message}</p>}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="phone" className={authLabelClass}>Telefone (opcional)</label>
                    <div className={authInputShellClass}>
                      <input
                        id="phone"
                        type="tel"
                        placeholder="(11) 99999-0000"
                        className={authInputClass}
                        {...register('phone')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="password" className={authLabelClass}>Senha</label>
                      <div className={authInputShellClass}>
                        <input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          className={authInputClass}
                          {...register('password')}
                        />
                      </div>
                      {errors.password && <p className="text-xs text-[#ffb4ab]">{errors.password.message}</p>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label htmlFor="confirmPassword" className={authLabelClass}>Confirmar senha</label>
                      <div className={authInputShellClass}>
                        <input
                          id="confirmPassword"
                          type="password"
                          placeholder="••••••••"
                          className={authInputClass}
                          {...register('confirmPassword')}
                        />
                      </div>
                      {errors.confirmPassword && <p className="text-xs text-[#ffb4ab]">{errors.confirmPassword.message}</p>}
                    </div>
                  </div>
                </div>

                <label className="mt-1 flex cursor-pointer items-start gap-4">
                  <div className="relative mt-0.5 flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer h-5 w-5 appearance-none rounded bg-zinc-950 shadow-[inset_0_0_0_1px_rgba(67,70,86,0.3)] transition-colors checked:bg-primary-400"
                      {...register('termsAccepted')}
                    />
                    <span className="pointer-events-none absolute text-[0.9rem] text-[#002388] opacity-0 transition-opacity peer-checked:opacity-100">
                      ✓
                    </span>
                  </div>
                  <span className="text-sm leading-relaxed text-[#c4c5d9]">
                    Eu concordo com os{' '}
                    <a className="text-primary-400 underline decoration-primary-400/30 underline-offset-4 transition-colors hover:text-[#dde1ff]" href="#">
                      Termos de Serviço
                    </a>{' '}
                    e a{' '}
                    <a className="text-primary-400 underline decoration-primary-400/30 underline-offset-4 transition-colors hover:text-[#dde1ff]" href="#">
                      Política de Privacidade
                    </a>
                    .
                  </span>
                </label>
                {errors.termsAccepted && <p className="-mt-4 text-xs text-[#ffb4ab]">{errors.termsAccepted.message}</p>}

                {error && (
                  <div className="rounded-md bg-[#93000a]/30 px-4 py-3 text-sm text-[#ffdad6]">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  className="mt-2 w-full uppercase tracking-wide"
                >
                  {isSubmitting ? 'Criando conta...' : 'Cadastrar'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <div className="text-center">
                <p className="text-sm text-[#c4c5d9]">
                  Já tem conta?{' '}
                  <Link href="/login" className="font-medium text-primary-400 transition-colors hover:text-[#dde1ff]">
                    Entrar
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
