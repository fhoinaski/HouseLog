'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserPlus, Trash2, Mail, Clock, ShieldCheck, Wrench, Eye,
  ToggleLeft, ToggleRight, Users,
} from 'lucide-react';
import { invitesApi, type PropertyCollaborator, type PropertyInvite } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Gestor',
  provider: 'Prestador',
  viewer: 'Visualizador',
};

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-primary-100 text-primary-700',
  provider: 'bg-amber-100 text-amber-700',
  viewer: 'bg-slate-100 text-slate-600',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  manager: ShieldCheck,
  provider: Wrench,
  viewer: Eye,
};

const inviteSchema = z.object({
  email: z.string().email('Email inválido'),
  role: z.enum(['viewer', 'provider', 'manager']),
});

type InviteForm = z.infer<typeof inviteSchema>;

function CollaboratorRow({
  collab,
  isOwner,
  onToggleOS,
  onRemove,
}: {
  collab: PropertyCollaborator;
  isOwner: boolean;
  onToggleOS: (c: PropertyCollaborator) => void;
  onRemove: (c: PropertyCollaborator) => void;
}) {
  const Icon = ROLE_ICONS[collab.role] ?? Eye;
  const canToggle = isOwner && collab.role !== 'viewer';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-0">
      {/* Avatar */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 font-semibold text-sm uppercase">
        {collab.name.charAt(0)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{collab.name}</p>
        <p className="text-xs text-[var(--muted-foreground)] truncate">{collab.email}</p>
      </div>

      {/* Role badge */}
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', ROLE_COLORS[collab.role])}>
        <Icon className="h-3 w-3" />
        {ROLE_LABELS[collab.role]}
      </span>

      {/* can_open_os toggle — only for manager/provider, only owner can change */}
      {collab.role !== 'viewer' && (
        <button
          onClick={() => canToggle && onToggleOS(collab)}
          title={canToggle ? 'Alternar permissão de abrir OS' : 'Sem permissão para alterar'}
          className={cn('flex items-center gap-1 text-xs rounded px-2 py-1 transition-colors', canToggle && 'hover:bg-[var(--muted)]')}
          disabled={!canToggle}
        >
          {collab.can_open_os ? (
            <><ToggleRight className="h-4 w-4 text-emerald-600" /><span className="text-emerald-600 hidden sm:inline">Abre OS</span></>
          ) : (
            <><ToggleLeft className="h-4 w-4 text-slate-400" /><span className="text-slate-400 hidden sm:inline">Sem OS</span></>
          )}
        </button>
      )}

      {/* Remove */}
      {isOwner && (
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 shrink-0"
          onClick={() => onRemove(collab)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  isOwner,
  onCancel,
}: {
  invite: PropertyInvite;
  isOwner: boolean;
  onCancel: (i: PropertyInvite) => void;
}) {
  const Icon = ROLE_ICONS[invite.role] ?? Eye;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <Mail className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{invite.email}</p>
        <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1">
          <Clock className="h-3 w-3" /> Expira {formatDate(invite.expires_at)}
        </p>
      </div>
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', ROLE_COLORS[invite.role])}>
        <Icon className="h-3 w-3" />
        {ROLE_LABELS[invite.role]}
      </span>
      <Badge variant="secondary" className="text-xs shrink-0">Pendente</Badge>
      {isOwner && (
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 shrink-0"
          onClick={() => onCancel(invite)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removingCollab, setRemovingCollab] = useState<PropertyCollaborator | null>(null);

  const { data, mutate } = useSWR(['team', id], () => invitesApi.list(id));

  const collaborators = data?.collaborators ?? [];
  const invites = data?.invites ?? [];

  // Determine if current user is the owner (can see manager options)
  // We approximate: owner can change permissions and remove others
  // The backend enforces this check too
  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  const { register, handleSubmit, setValue, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'manager' },
  });

  async function onInvite(form: InviteForm) {
    try {
      await invitesApi.create(id, form);
      await mutate();
      reset();
      setInviteOpen(false);
      toast.success(`Convite enviado para ${form.email}`);
    } catch (e) {
      toast.error('Erro ao enviar convite', { description: (e as Error).message });
    }
  }

  async function handleToggleOS(collab: PropertyCollaborator) {
    try {
      await invitesApi.updatePermissions(id, collab.id, collab.can_open_os === 0);
      await mutate();
      toast.success(collab.can_open_os ? 'Permissão de OS removida' : 'Permissão de OS concedida');
    } catch (e) {
      toast.error('Erro ao alterar permissão', { description: (e as Error).message });
    }
  }

  async function handleRemoveCollab() {
    if (!removingCollab) return;
    try {
      await invitesApi.removeCollaborator(id, removingCollab.id);
      await mutate();
      setRemovingCollab(null);
      toast.success(`${removingCollab.name} removido da equipe`);
    } catch (e) {
      toast.error('Erro ao remover', { description: (e as Error).message });
    }
  }

  async function handleCancelInvite(invite: PropertyInvite) {
    try {
      await invitesApi.cancel(id, invite.id);
      await mutate();
      toast.success('Convite cancelado');
    } catch (e) {
      toast.error('Erro ao cancelar convite', { description: (e as Error).message });
    }
  }

  const managerCount = collaborators.filter((c) => c.role === 'manager').length;
  const providerCount = collaborators.filter((c) => c.role === 'provider').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Equipe</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {collaborators.length} membro{collaborators.length !== 1 ? 's' : ''} ·{' '}
            {invites.length} convite{invites.length !== 1 ? 's' : ''} pendente{invites.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Gestores', count: managerCount, color: 'text-primary-600', bg: 'bg-primary-50' },
          { label: 'Prestadores', count: providerCount, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Visualizadores', count: collaborators.filter((c) => c.role === 'viewer').length, color: 'text-slate-600', bg: 'bg-slate-50' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('rounded-lg p-2', s.bg)}>
                <Users className={cn('h-4 w-4', s.color)} />
              </div>
              <div>
                <p className={cn('text-xl font-bold', s.color)}>{s.count}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permission legend */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-xs text-[var(--muted-foreground)] space-y-1">
        <p className="font-semibold text-[var(--foreground)]">Permissões por papel</p>
        <p><span className="font-medium text-primary-700">Gestor</span> — visualiza tudo + abre OS (se habilitado pelo proprietário)</p>
        <p><span className="font-medium text-amber-700">Prestador</span> — recebe OS atribuídas + pode abrir OS (se habilitado)</p>
        <p><span className="font-medium text-slate-600">Visualizador</span> — apenas leitura, não pode abrir OS</p>
      </div>

      {/* Active collaborators */}
      {collaborators.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary-600" />
              Membros ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-2">
            {collaborators.map((c) => (
              <CollaboratorRow
                key={c.id}
                collab={c}
                isOwner={isOwner}
                onToggleOS={handleToggleOS}
                onRemove={setRemovingCollab}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-slate-300 mb-3" />
          <p className="text-[var(--muted-foreground)] text-sm">Nenhum membro na equipe</p>
          {isOwner && (
            <Button variant="outline" className="mt-3" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Convidar primeiro membro
            </Button>
          )}
        </div>
      )}

      {/* Pending invites */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-amber-500" />
              Convites pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-2">
            {invites.map((inv) => (
              <InviteRow key={inv.id} invite={inv} isOwner={isOwner} onCancel={handleCancelInvite} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary-600" />
              Convidar membro
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email *</Label>
              <Input id="inv-email" type="email" placeholder="prestador@email.com" {...register('email')} />
              {errors.email && <p className="text-xs text-rose-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Papel *</Label>
              <Select defaultValue="manager" onValueChange={(v) => setValue('role', v as InviteForm['role'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Gestor — gerencia o imóvel</SelectItem>
                  <SelectItem value="provider">Prestador — executa serviços</SelectItem>
                  <SelectItem value="viewer">Visualizador — só leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              Um email com link de convite será enviado. Gestores recebem permissão de abrir OS por padrão.
            </p>
            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                Enviar Convite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove collaborator confirm */}
      <Dialog open={!!removingCollab} onOpenChange={() => setRemovingCollab(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover membro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">
            Tem certeza que deseja remover <strong>{removingCollab?.name}</strong> da equipe?
            O acesso ao imóvel será revogado imediatamente.
          </p>
          <div className="flex gap-3 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setRemovingCollab(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="flex-1" onClick={handleRemoveCollab}>
              Remover
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
