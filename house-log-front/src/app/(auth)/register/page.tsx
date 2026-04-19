'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ClipboardList, Home, Settings2, Wrench, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { invitesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EntryShell } from '@/components/auth/entry-shell';
import { cn } from '@/lib/utils';

type RoleChoice = 'owner' | 'manager' | 'provider';

type RegisterStep = 1 | 2 | 3;

type RoleCard = {
  key: RoleChoice;
  title: string;
  desc: string;
  icon: LucideIcon;
};

const registerSchema = z
  .object({
    fullName: z.string().min(3, 'Informe nome completo com pelo menos 3 caracteres'),
    email: z.string().email('Informe um e-mail válido'),
    phoneNumber: z.string().min(14, 'Informe um telefone válido'),
    password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirme a senha'),
    inviteToken: z.string().optional(),
    terms: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'As senhas não conferem',
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

function StepIndicator({ step }: { step: RegisterStep }) {
  return (
    <div className="mb-7 grid grid-cols-3 gap-2" aria-label={`Etapa ${step} de 3`}>
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={cn(
            'h-1.5 rounded-full transition-colors',
            dot <= step ? 'bg-[var(--provider-accent)]' : 'bg-[var(--surface-muted)]'
          )}
        />
      ))}
    </div>
  );
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

  const roleCards = useMemo<RoleCard[]>(
    () => [
      {
        key: 'owner',
        title: 'Proprietário',
        desc: 'Gerencio meus imóveis',
        icon: Home,
      },
      {
        key: 'manager',
        title: 'Gestor',
        desc: 'Administro imóveis de terceiros',
        icon: ClipboardList,
      },
      {
        key: 'provider',
        title: 'Prestador',
        desc: 'Executo serviços',
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
          toast.error('Código de convite obrigatório');
          return;
        }

        try {
          await invitesApi.getInvite(token);
        } catch {
          toast.error('Código de convite inválido ou expirado');
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
        toast.error('Este e-mail já está cadastrado');
        return;
      }

      if (lower.includes('invite') || lower.includes('convite')) {
        toast.error('Código de convite inválido ou expirado');
        return;
      }

      toast.error('Erro ao criar conta', { description: message });
    }
  }

  return (
    <EntryShell
      eyebrow="Nova operação"
      title={step === 3 ? 'Perfil criado' : 'Configure seu acesso'}
      description="Escolha seu papel e crie uma conta conectada aos fluxos reais do HouseLog."
      footer={
        <>
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-text-accent hover:text-text-accent-subtle">
            Entrar
          </Link>
        </>
      }
    >
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-medium text-text-primary">Como você usa o HouseLog?</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">Isso define a entrada inicial e os atalhos da operação.</p>
          </div>

          <div className="grid gap-3">
            {roleCards.map((item) => {
              const selected = role === item.key;
              const Icon = item.icon;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setRole(item.key)}
                  className={cn(
                    'min-h-20 rounded-[var(--radius-xl)] p-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:shadow-[var(--field-focus-ring)]',
                    selected
                      ? 'bg-[var(--button-tonal-bg)] shadow-[var(--shadow-sm)]'
                      : 'bg-[var(--surface-base)] hover:bg-[var(--surface-raised)]'
                  )}
                >
                  <span className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]',
                        selected ? 'bg-[var(--provider-accent)] text-text-inverse' : 'bg-[var(--surface-strong)] text-text-accent'
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-text-primary">{item.title}</span>
                      <span className="mt-1 block text-sm leading-5 text-text-secondary">{item.desc}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {needsInvite && (
            <div className="rounded-[var(--radius-md)] bg-bg-warning px-3 py-3 text-sm leading-5 text-text-warning">
              Você precisa de um código de convite enviado pelo proprietário.
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
            <h2 className="text-xl font-medium text-text-primary">Dados de acesso</h2>
            <p className="mt-1 text-sm leading-6 text-text-secondary">Use informações reais para convites, auditoria e comunicação.</p>
          </div>

          <div>
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" placeholder="Digite seu nome" {...register('fullName')} />
            {errors.fullName && <p className="hl-error">{errors.fullName.message}</p>}
          </div>

          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
            {errors.email && <p className="hl-error">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="phoneNumber">Telefone</Label>
            <Input
              id="phoneNumber"
              inputMode="numeric"
              placeholder="(11) 99999-9999"
              value={phoneNumber}
              onChange={(event) => setValue('phoneNumber', formatPhone(event.target.value), { shouldValidate: true })}
            />
            {errors.phoneNumber && <p className="hl-error">{errors.phoneNumber.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="hl-error">{errors.password.message}</p>}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input id="confirmPassword" type="password" placeholder="Repita sua senha" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="hl-error">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          {needsInvite && (
            <div>
              <Label htmlFor="inviteToken">Código de convite</Label>
              <Input id="inviteToken" placeholder="Token alfanumérico" {...register('inviteToken')} />
            </div>
          )}

          <label className="flex items-start gap-2.5 pt-1 text-sm leading-6 text-text-secondary">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--provider-accent)]" {...register('terms')} />
            <span>
              Aceito os{' '}
              <a href="#" className="font-medium text-text-accent hover:text-text-accent-subtle">
                termos de uso
              </a>{' '}
              e{' '}
              <a href="#" className="font-medium text-text-accent hover:text-text-accent-subtle">
                política de privacidade
              </a>
            </span>
          </label>
          {errors.terms && <p className="hl-error">{errors.terms.message}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
              Voltar
            </Button>
            <Button type="submit" size="lg" className="flex-1" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar conta'}
            </Button>
          </div>
        </form>
      )}

      {step === 3 && role && (
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-success text-text-success">
            <Check className="h-7 w-7" strokeWidth={2.4} />
          </div>

          <h2 className="text-xl font-medium text-text-primary">Perfil criado</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Seu acesso está ativo. Entre na plataforma e complete a configuração operacional.
          </p>

          <div className="mt-6 w-full space-y-3">
            <Button size="lg" className="w-full" onClick={() => router.push(dashboardRouteByRole(role))}>
              Acessar dashboard
            </Button>

            {role === 'provider' && (
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => router.push('/provider/settings')}
              >
                <Settings2 className="h-4 w-4" />
                Adicionar fotos ao portfólio
              </Button>
            )}
          </div>
        </div>
      )}
    </EntryShell>
  );
}
