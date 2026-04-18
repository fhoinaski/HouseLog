'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { invitesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
  role: z.enum(['admin', 'owner', 'provider']),
  phone: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { register: registerUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const inviteRole = searchParams.get('role');
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'owner' },
  });

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
      await registerUser(data);

      if (inviteToken) {
        const accepted = await invitesApi.acceptInvite(inviteToken);
        if ((inviteRole ?? accepted.role) === 'provider') {
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
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Criar sua conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {inviteToken ? 'Complete seu cadastro para aceitar o convite' : 'Comece a gerenciar seus imóveis'}
          </p>
        </div>

        {inviteToken && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Você está criando conta a partir de um convite. Após concluir, o acesso será liberado automaticamente.
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome completo</Label>
              <Input id="name" placeholder="João Silva" {...register('name')} />
              {errors.name && <p className="text-xs text-rose-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
              {errors.email && <p className="text-xs text-rose-500">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input id="phone" type="tel" placeholder="(11) 99999-0000" {...register('phone')} />
            </div>

            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select defaultValue="owner" onValueChange={(v) => setValue('role', v as FormData['role'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Proprietário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="provider">Prestador de Serviço</SelectItem>
                </SelectContent>
              </Select>
              {inviteRole === 'provider' && (
                <p className="text-xs text-muted-foreground">Perfil recomendado para este convite: Prestador de Serviço.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="Mínimo 8 caracteres" {...register('password')} />
              {errors.password && <p className="text-xs text-rose-500">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" loading={isSubmitting}>
              Criar conta
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
              Fazer login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
