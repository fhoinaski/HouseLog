'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, CheckCircle2, ShieldCheck, Wrench, Eye, Loader2, XCircle } from 'lucide-react';
import { invitesApi, type InviteDetails } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Gestor',
  provider: 'Prestador',
  viewer: 'Visualizador',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  manager: ShieldCheck,
  provider: Wrench,
  viewer: Eye,
};

const ROLE_DESC: Record<string, string> = {
  manager: 'Você poderá gerenciar este imóvel, ver todas as informações e abrir ordens de serviço (se autorizado).',
  provider: 'Você receberá ordens de serviço atribuídas a você e poderá acompanhar o andamento.',
  viewer: 'Você poderá visualizar as informações do imóvel sem fazer alterações.',
};

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptedPropertyId, setAcceptedPropertyId] = useState('');

  // Load invite details (public — no auth needed)
  useEffect(() => {
    invitesApi.getInvite(token)
      .then(setInvite)
      .catch((e) => setLoadError((e as Error).message ?? 'Convite inválido ou expirado'));
  }, [token]);

  async function handleAccept() {
    if (!user) {
      // Redirect to login, come back after
      router.push(`/login?redirect=/invite/${token}`);
      return;
    }
    setAccepting(true);
    try {
      const res = await invitesApi.acceptInvite(token);
      setAcceptedPropertyId(res.property_id);
      setAccepted(true);
    } catch (e) {
      setLoadError((e as Error).message ?? 'Erro ao aceitar convite');
    } finally {
      setAccepting(false);
    }
  }

  if (authLoading || (!invite && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
          <XCircle className="h-8 w-8 text-rose-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Convite inválido</h1>
          <p className="mt-1 text-slate-500 text-sm max-w-xs">{loadError}</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/dashboard')}>
          Ir para o Dashboard
        </Button>
      </div>
    );
  }

  if (accepted && invite) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Convite aceito!</h1>
          <p className="mt-1 text-slate-500 text-sm max-w-xs">
            Você agora é <strong>{ROLE_LABELS[invite.role]}</strong> de{' '}
            <strong>{invite.property_name}</strong>.
          </p>
        </div>
        <Button onClick={() => router.push(`/properties/${acceptedPropertyId}`)}>
          Acessar imóvel
        </Button>
      </div>
    );
  }

  if (!invite) return null;

  const RoleIcon = ROLE_ICONS[invite.role] ?? Eye;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">HouseLog</span>
        </div>

        {/* Invite card */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
          {/* Property banner */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-6 py-5 text-white">
            <p className="text-sm opacity-80 mb-1">{invite.invited_by_name} convidou você para</p>
            <h1 className="text-xl font-bold">{invite.property_name}</h1>
            <p className="text-sm opacity-70 mt-0.5">{invite.property_address}, {invite.property_city}</p>
          </div>

          <div className="p-6 space-y-4">
            {/* Role */}
            <div className={cn(
              'flex items-start gap-3 rounded-xl p-4',
              invite.role === 'manager' ? 'bg-primary-50' : invite.role === 'provider' ? 'bg-amber-50' : 'bg-slate-50'
            )}>
              <RoleIcon className={cn(
                'h-5 w-5 mt-0.5 shrink-0',
                invite.role === 'manager' ? 'text-primary-600' : invite.role === 'provider' ? 'text-amber-600' : 'text-slate-500'
              )} />
              <div>
                <p className="font-semibold text-sm">{ROLE_LABELS[invite.role] ?? invite.role}</p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{ROLE_DESC[invite.role]}</p>
              </div>
            </div>

            {/* Auth notice */}
            {!user && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Você precisará fazer login ou criar uma conta para aceitar este convite.
              </div>
            )}

            <Button className="w-full" onClick={handleAccept} loading={accepting}>
              {user ? 'Aceitar convite' : 'Entrar e aceitar'}
            </Button>

            <p className="text-center text-xs text-[var(--muted-foreground)]">
              Convite expira em {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
