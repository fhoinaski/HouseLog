'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ClipboardList, Home, Settings2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { invitesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type RoleChoice = 'owner' | 'manager' | 'provider';

type RegisterStep = 1 | 2 | 3;

const registerSchema = z
  .object({
    fullName: z.string().min(3, 'Informe nome completo com pelo menos 3 caracteres'),
    email: z.string().email('Informe um e-mail valido'),
    phoneNumber: z.string().min(14, 'Informe um telefone valido'),
    password: z.string().min(8, 'A senha deve ter no minimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirme a senha'),
    inviteToken: z.string().optional(),
    terms: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'As senhas nao conferem',
        path: ['confirmPassword'],
      });
    }
    if (!data.terms) {
      ctx.addIssue({
        code: 'custom',
        message: 'Aceite os termos para continuar',
        path: ['terms'],
      });
    }
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function roleToApiRole(role: RoleChoice): 'owner' | 'provider' {
  if (role === 'provider') return 'provider';
  return 'owner';
}

function dashboardRouteByRole(role: RoleChoice): string {
  return role === 'provider' ? '/provider/dashboard' : '/dashboard';
}

export default function RegisterPage() {
  const router = useRouter();
  const { register: authRegister } = useAuth();

  const [step, setStep] = useState<RegisterStep>(1);
  const [role, setRole] = useState<RoleChoice | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      inviteToken: '',
      terms: false,
    },
  });

  const phoneNumber = useWatch({ control, name: 'phoneNumber' }) ?? '';
  const needsInvite = role === 'manager' || role === 'provider';

  const roleCards = useMemo(
    () => [
      {
        key: 'owner' as const,
        title: 'Proprietario',
        desc: 'Gerencio meus imoveis',
        icon: Home,
      },
      {
        key: 'manager' as const,
        title: 'Gestor',
        desc: 'Administro imoveis de terceiros',
        icon: ClipboardList,
      },
      {
        key: 'provider' as const,
        title: 'Prestador',
        desc: 'Executo servicos',
        icon: Wrench,
      },
    ],
    []
  );

  async function submitRegistration(values: RegisterFormValues) {
    if (!role) return;

    try {
      if (needsInvite) {
        const token = values.inviteToken?.trim();
        if (!token) {
          toast.error('Codigo de convite obrigatorio');
          return;
        }

        try {
          await invitesApi.getInvite(token);
        } catch {
          toast.error('Codigo de convite invalido ou expirado');
          return;
        }
      }

      await authRegister({
        name: values.fullName,
        email: values.email,
        password: values.password,
        phone: values.phoneNumber,
        role: roleToApiRole(role),
      });

      if (needsInvite && values.inviteToken) {
        await invitesApi.acceptInvite(values.inviteToken.trim());
      }

      setStep(3);
      toast.success('Conta criada com sucesso');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta';
      const lower = message.toLowerCase();

      if (lower.includes('email') && (lower.includes('exists') || lower.includes('cadastrado'))) {
        toast.error('Este e-mail ja esta cadastrado');
        return;
      }

      if (lower.includes('invite') || lower.includes('convite')) {
        toast.error('Codigo de convite invalido ou expirado');
        return;
      }

      toast.error('Erro ao criar conta', { description: message });
    }
  }

  return (
    <main className="min-h-screen bg-(--hl-bg-page) px-6 py-8">
      <section className="mx-auto w-full max-w-97.5 rounded-xl border border-neutral-100 bg-(--hl-bg-card) px-6 pb-6 pt-7">
        <header className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-13 w-13 items-center justify-center rounded-[14px] border-[1.5px] border-(--hl-border-light)">
            <Home className="h-6 w-6 text-(--color-primary)" strokeWidth={1.9} />
          </div>
          <h1 className="text-[22px] font-medium tracking-[-0.3px] text-(--hl-text-primary)">HouseLog</h1>
        </header>

        <div className="mb-6 flex items-center justify-center gap-2">
          {[1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={dot === step ? 'h-1.5 w-5 rounded-[3px] bg-(--color-primary)' : 'h-1.5 w-1.5 rounded-full bg-(--hl-border-light)'}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-[20px] font-medium text-(--hl-text-primary)">Criar conta</h2>
              <p className="mt-1 text-[13px] text-(--hl-text-secondary)">Escolha como voce vai usar o HouseLog</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {roleCards.map((item) => {
                const selected = role === item.key;
                const Icon = item.icon;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setRole(item.key)}
                    className={
                      selected
                        ? 'rounded-[14px] border-[1.5px] border-(--color-primary) bg-(--color-neutral-50) p-[14px_12px] text-left transition-all duration-150'
                        : 'rounded-[14px] border-[1.5px] border-(--hl-border-light) bg-white p-[14px_12px] text-left transition-all duration-150'
                    }
                  >
                    <span
                      className={
                        selected
                          ? 'mb-2 inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--color-primary) text-white'
                          : 'mb-2 inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-(--color-neutral-50) text-neutral-800'
                      }
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <p className="text-[14px] font-medium text-(--hl-text-primary)">{item.title}</p>
                    <p className="mt-1 text-[12px] text-(--hl-text-secondary)">{item.desc}</p>
                  </button>
                );
              })}
            </div>

            {needsInvite && (
              <div className="rounded-r-[8px] border-l-[3px] border-l-(--color-warning) bg-(--color-warning-light) px-3 py-2.5 text-[12px] text-(--color-warning)">
                Voce precisa de um codigo de convite enviado pelo proprietario.
              </div>
            )}

            <Button type="button" size="lg" disabled={!role} onClick={() => setStep(2)} className="w-full">
              Continuar
            </Button>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleSubmit(submitRegistration)} className="space-y-4">
            <div>
              <h2 className="text-[20px] font-medium text-(--hl-text-primary)">Seus dados</h2>
              <p className="mt-1 text-[13px] text-(--hl-text-secondary)">Preencha suas informacoes basicas</p>
            </div>

            <div>
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" placeholder="Digite seu nome" {...register('fullName')} />
              {errors.fullName && <p className="mt-1 text-[12px] text-(--hl-accent-red)">{errors.fullName.message}</p>}
            </div>

            <div>
              <Label htmlFor="email">E-MAIL</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-[12px] text-(--hl-accent-red)">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="phoneNumber">TELEFONE</Label>
              <Input
                id="phoneNumber"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={phoneNumber}
                onChange={(event) => setValue('phoneNumber', formatPhone(event.target.value), { shouldValidate: true })}
              />
              {errors.phoneNumber && <p className="mt-1 text-[12px] text-(--hl-accent-red)">{errors.phoneNumber.message}</p>}
            </div>

            <div>
              <Label htmlFor="password">SENHA</Label>
              <Input id="password" type="password" placeholder="Minimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="mt-1 text-[12px] text-(--hl-accent-red)">{errors.password.message}</p>}
            </div>

            <div>
              <Label htmlFor="confirmPassword">CONFIRMAR SENHA</Label>
              <Input id="confirmPassword" type="password" placeholder="Repita sua senha" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="mt-1 text-[12px] text-(--hl-accent-red)">{errors.confirmPassword.message}</p>}
            </div>

            {needsInvite && (
              <div>
                <Label htmlFor="inviteToken">CODIGO DE CONVITE</Label>
                <Input id="inviteToken" placeholder="Token alfanumerico" {...register('inviteToken')} />
              </div>
            )}

            <label className="flex items-start gap-2.5 pt-1 text-[13px] text-(--hl-text-secondary)">
              <input type="checkbox" className="mt-1" {...register('terms')} />
              <span>
                Aceito os{' '}
                <a href="#" className="font-medium text-(--color-primary)">
                  termos de uso
                </a>{' '}
                e{' '}
                <a href="#" className="font-medium text-(--color-primary)">
                  politica de privacidade
                </a>
              </span>
            </label>
            {errors.terms && <p className="-mt-1 text-[12px] text-(--hl-accent-red)">{errors.terms.message}</p>}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
                Voltar
              </Button>
              <Button type="submit" size="lg" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Criando...' : 'Continuar'}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && role && (
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-(--hl-accent-green)">
              <Check className="h-7 w-7 text-(--hl-accent-green)" strokeWidth={2.4} />
            </div>

            <h2 className="text-[20px] font-medium text-(--hl-text-primary)">Perfil Criado!</h2>
            <p className="mt-2 text-[14px] text-(--hl-text-secondary)">
              Seu perfil esta ativo. Voce ja pode acessar a plataforma.
            </p>

            <div className="mt-6 w-full space-y-3">
              <Button size="lg" className="w-full" onClick={() => router.push(dashboardRouteByRole(role))}>
                Acessar Dashboard
              </Button>

              {role === 'provider' && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={() => router.push('/provider/settings')}
                >
                  <Settings2 className="h-4 w-4" />
                  Adicionar Fotos ao Portfolio
                </Button>
              )}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-[13px] text-(--hl-text-secondary)">
          Ja tem conta?{' '}
          <Link href="/login" className="font-medium text-(--color-primary)">
            Entrar
          </Link>
        </p>
      </section>
    </main>
  );
}
