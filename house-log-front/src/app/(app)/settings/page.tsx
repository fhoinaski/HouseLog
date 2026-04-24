'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Bell, Shield } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador', owner: 'Proprietário',
  provider: 'Prestador', temp_provider: 'Acesso Temporário',
};

const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsPage() {
  const { user } = useAuth();

  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>({
    os_status: true, maintenance_due: true, new_bid: true,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  async function saveNotifPrefs() {
    setSavingNotifs(true);
    try {
      await authApi.updateNotificationPrefs(notifPrefs);
      toast.success('Preferências salvas');
    } catch (e) {
      toast.error('Erro ao salvar', { description: (e as Error).message });
    } finally {
      setSavingNotifs(false);
    }
  }

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    setError: setProfileError,
    formState: { isSubmitting: savingProfile, errors: profileErrors },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', phone: user?.phone ?? '' },
  });

  const {
    register: regPw,
    handleSubmit: handlePw,
    reset: resetPw,
    setError: setPwError,
    formState: { errors: pwErrors, isSubmitting: savingPw },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });

  async function onProfileSubmit(data: ProfileForm) {
    try {
      await authApi.updateProfile(data);
      toast.success('Perfil atualizado');
    } catch (e) {
      setProfileError('root', { message: (e as Error).message ?? 'Erro ao atualizar perfil' });
    }
  }

  async function onPasswordSubmit(data: PasswordForm) {
    try {
      await authApi.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Senha alterada com sucesso');
      resetPw();
    } catch (e) {
      setPwError('currentPassword', { message: (e as Error).message ?? 'Erro ao alterar senha' });
    }
  }

  return (
    <div className="max-w-2xl space-y-6 px-4 py-4 safe-bottom sm:px-5 sm:py-5">
      <div>
        <h1 className="text-2xl font-medium">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie sua conta e preferências</p>
      </div>

      {/* User card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-(--color-avatar-owner-bg) text-lg font-medium text-(--color-avatar-owner-fg)">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 text-xs">
                {ROLE_LABELS[user?.role ?? ''] ?? user?.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile"><User className="h-3.5 w-3.5" />Perfil</TabsTrigger>
          <TabsTrigger value="security"><Lock className="h-3.5 w-3.5" />Segurança</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5" />Notificações</TabsTrigger>
        </TabsList>

        {/* Profile tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informações pessoais</CardTitle>
              <CardDescription>Atualize seu nome e telefone de contato</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfile(onProfileSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" {...regProfile('name')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" type="tel" placeholder="(11) 99999-0000" {...regProfile('phone')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={user?.email ?? ''} disabled className="opacity-60" />
                  <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
                </div>
                {profileErrors.root && (
                  <p className="text-xs text-text-danger">{profileErrors.root.message}</p>
                )}
                <Button type="submit" loading={savingProfile}>Salvar alterações</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Alterar senha</CardTitle>
              <CardDescription>Use uma senha forte com ao menos 8 caracteres</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePw(onPasswordSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="currentPw">Senha atual</Label>
                  <Input id="currentPw" type="password" {...regPw('currentPassword')} />
                  {pwErrors.currentPassword && (
                    <p className="text-xs text-text-danger">{pwErrors.currentPassword.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="newPw">Nova senha</Label>
                  <Input id="newPw" type="password" {...regPw('newPassword')} />
                  {pwErrors.newPassword && <p className="text-xs text-text-danger">{pwErrors.newPassword.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPw">Confirmar nova senha</Label>
                  <Input id="confirmPw" type="password" {...regPw('confirmPassword')} />
                  {pwErrors.confirmPassword && <p className="text-xs text-text-danger">{pwErrors.confirmPassword.message}</p>}
                </div>
                <Button type="submit" loading={savingPw}>Alterar senha</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-text-success" />
                Sessões ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">Este dispositivo</p>
                  <p className="text-xs text-muted-foreground">Sessão atual</p>
                </div>
                <Badge variant="success">Ativo</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferências de notificação</CardTitle>
              <CardDescription>Escolha quando você quer ser notificado por email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { label: 'Mudança de status da OS', description: 'Quando uma OS mudar de status', key: 'os_status' },
                { label: 'Manutenções pendentes', description: 'Lembrete diário de manutenções próximas do vencimento', key: 'maintenance_due' },
                { label: 'Novo orçamento', description: 'Quando um prestador enviar um orçamento', key: 'new_bid' },
              ] as const).map((n) => (
                <div key={n.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.description}</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={notifPrefs[n.key] !== false}
                      onChange={(e) => setNotifPrefs((p) => ({ ...p, [n.key]: e.target.checked }))}
                      className="peer sr-only"
                    />
                    <div className="peer h-5 w-9 rounded-full bg-bg-muted after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-interactive-primary-bg peer-checked:after:translate-x-4" />
                  </label>
                </div>
              ))}
              <Button onClick={saveNotifPrefs} loading={savingNotifs} className="mt-2">
                Salvar preferências
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
