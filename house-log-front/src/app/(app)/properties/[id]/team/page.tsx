'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserPlus, Trash2, Mail, Clock, ShieldCheck, Wrench, Eye,
  ToggleLeft, ToggleRight, Users, ScanLine,
} from 'lucide-react';
import { invitesApi, type PropertyCollaborator, type PropertyInvite, type InviteCardSuggestion } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn, formatDate, SYSTEM_TYPE_LABELS } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';

const ROLE_LABELS: Record<string, string> = {
  manager: 'Gestor',
  provider: 'Prestador',
  viewer: 'Visualizador',
};

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-bg-accent-subtle text-text-accent',
  provider: 'bg-bg-warning text-text-warning',
  viewer: 'bg-bg-subtle text-text-secondary',
};

const ROLE_AVATAR: Record<string, string> = {
  owner: 'bg-avatar-owner-bg text-avatar-owner-text',
  manager: 'bg-avatar-manager-bg text-avatar-manager-text',
  provider: 'bg-avatar-provider-bg text-avatar-provider-text',
  viewer: 'bg-bg-subtle text-text-secondary',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  manager: ShieldCheck,
  provider: Wrench,
  viewer: Eye,
};

const inviteSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.enum(['viewer', 'provider', 'manager']),
  specialties: z.string().optional(),
  whatsapp: z.string().optional(),
}).superRefine((data, ctx) => {
  const hasEmail = !!data.email?.trim();
  const hasWhatsapp = !!data.whatsapp?.trim();

  if (!hasEmail && !hasWhatsapp) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Informe e-mail ou WhatsApp para convidar',
      path: ['email'],
    });
  }

  if (hasEmail) {
    const emailResult = z.string().email('Email inválido').safeParse(data.email?.trim());
    if (!emailResult.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email inválido',
        path: ['email'],
      });
    }
  }

  if (!hasEmail && !data.name?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'No pré-cadastro sem e-mail, informe o nome',
      path: ['name'],
    });
  }
});

type InviteForm = z.infer<typeof inviteSchema>;

const SPECIALTY_OPTIONS = Object.entries(SYSTEM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function CollaboratorRow({
  collab,
  canManageTeam,
  onToggleOS,
  onRemove,
}: {
  collab: PropertyCollaborator;
  canManageTeam: boolean;
  onToggleOS: (c: PropertyCollaborator) => void;
  onRemove: (c: PropertyCollaborator) => void;
}) {
  const Icon = ROLE_ICONS[collab.role] ?? Eye;
  const canToggle = canManageTeam && collab.role !== 'viewer';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-subtle last:border-0">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium uppercase', ROLE_AVATAR[collab.role] ?? ROLE_AVATAR.viewer)}>
        {collab.name.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{collab.name}</p>
        <p className="text-xs text-text-secondary truncate">{collab.email}</p>
      </div>

      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', ROLE_COLORS[collab.role])}>
        <Icon className="h-3 w-3" />
        {ROLE_LABELS[collab.role]}
      </span>

      {collab.role !== 'viewer' && (
        <button
          onClick={() => canToggle && onToggleOS(collab)}
          title={canToggle ? 'Alternar permissão de abrir OS' : 'Sem permissão para alterar'}
          className={cn('flex items-center gap-1 text-xs rounded px-2 py-1 transition-colors', canToggle && 'hover:bg-bg-subtle')}
          disabled={!canToggle}
        >
          {collab.can_open_os ? (
            <><ToggleRight className="h-4 w-4 text-text-success" /><span className="hidden text-text-success sm:inline">Abre OS</span></>
          ) : (
            <><ToggleLeft className="h-4 w-4 text-text-disabled" /><span className="hidden text-text-disabled sm:inline">Sem OS</span></>
          )}
        </button>
      )}

      {canManageTeam && (
        <Button
          variant="ghost" size="icon"
          className="h-8 w-8 shrink-0 text-text-danger hover:bg-bg-danger"
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
  const mainLabel = invite.invite_name?.trim() || invite.email;
  const contactLabel = invite.whatsapp?.trim() || invite.email;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border-subtle last:border-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-warning text-text-warning">
        <Mail className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{mainLabel}</p>
        <p className="text-xs text-text-secondary truncate">{contactLabel}</p>
        <p className="text-xs text-text-secondary flex items-center gap-1 mt-0.5">
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
          className="h-8 w-8 shrink-0 text-text-danger hover:bg-bg-danger"
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
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [lastInviteWhatsapp, setLastInviteWhatsapp] = useState<string | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [extractingCard, setExtractingCard] = useState(false);
  const [cardSuggestion, setCardSuggestion] = useState<InviteCardSuggestion | null>(null);
  const [removingCollab, setRemovingCollab] = useState<PropertyCollaborator | null>(null);

  const { data, mutate } = useSWR(['team', id], () => invitesApi.list(id));

  const collaborators = data?.collaborators ?? [];
  const invites = data?.invites ?? [];

  const isManagerCollaborator = collaborators.some((c) => c.user_id === user?.id && c.role === 'manager');
  const canManageTeam = user?.role === 'owner' || user?.role === 'admin' || isManagerCollaborator;

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { role: 'manager' },
  });

  const selectedRole = watch('role');
  const selectedSpecialties = (watch('specialties') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  function toggleSpecialty(value: string) {
    const current = new Set(selectedSpecialties);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    setValue('specialties', Array.from(current).join(', '));
  }

  async function onInvite(form: InviteForm) {
    try {
      const specialties = (form.specialties ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      const created = await invitesApi.create(id, {
        name: form.name?.trim() || undefined,
        email: form.email?.trim() || undefined,
        role: form.role,
        whatsapp: form.whatsapp?.trim() || undefined,
        specialties: form.role === 'provider' ? specialties : undefined,
      });

      setLastInviteLink(created.invite_url);
      setLastInviteWhatsapp(form.whatsapp?.trim() || null);
      if (created.delivery === 'whatsapp_link') {
        await navigator.clipboard.writeText(created.invite_url);
      }

      await mutate();
      reset();
      if (created.delivery === 'email') {
        setInviteOpen(false);
        toast.success(`Convite enviado por e-mail para ${form.email}`);
      } else {
        toast.success('Pré-cadastro criado. Link copiado para envio no WhatsApp.');
      }
    } catch (e) {
      toast.error('Erro ao enviar convite', { description: (e as Error).message });
    }
  }

  async function handleCopyInviteLink() {
    if (!lastInviteLink) return;
    try {
      await navigator.clipboard.writeText(lastInviteLink);
      toast.success('Link copiado');
    } catch {
      toast.error('Não foi possível copiar o link');
    }
  }

  function buildWhatsappUrl(link: string, whatsapp: string) {
    const digits = whatsapp.replace(/\D/g, '');
    const text = encodeURIComponent(`Olá! Segue seu link para completar o cadastro no HouseLog: ${link}`);
    return `https://wa.me/${digits}?text=${text}`;
  }

  async function handleExtractCardData() {
    if (!cardFile) {
      toast.error('Selecione uma imagem do cartão antes de extrair');
      return;
    }
    setExtractingCard(true);
    try {
      const result = await invitesApi.extractFromCard(id, cardFile);
      const suggestion = result.suggestion;
      setCardSuggestion(suggestion);

      if (suggestion.name) setValue('name', suggestion.name);
      if (suggestion.email) setValue('email', suggestion.email);
      if (suggestion.whatsapp) setValue('whatsapp', suggestion.whatsapp);
      if (suggestion.specialties.length > 0) setValue('specialties', suggestion.specialties.join(', '));

      toast.success('Dados sugeridos preenchidos. Revise antes de enviar.');
    } catch (e) {
      toast.error('Não foi possível extrair os dados', { description: (e as Error).message });
    } finally {
      setExtractingCard(false);
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
    <div className="safe-bottom space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-text-primary">Equipe</h2>
          <p className="text-sm text-text-secondary">
            {collaborators.length} membro{collaborators.length !== 1 ? 's' : ''} ·{' '}
            {invites.length} convite{invites.length !== 1 ? 's' : ''} pendente{invites.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManageTeam && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Convidar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Gestores', count: managerCount, color: 'text-text-accent', bg: 'bg-bg-accent-subtle' },
          { label: 'Prestadores', count: providerCount, color: 'text-text-warning', bg: 'bg-bg-warning' },
          { label: 'Visualizadores', count: collaborators.filter((c) => c.role === 'viewer').length, color: 'text-text-secondary', bg: 'bg-bg-subtle' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('rounded-lg p-2', s.bg)}>
                <Users className={cn('h-4 w-4', s.color)} />
              </div>
              <div>
                <p className={cn('text-xl font-medium', s.color)}>{s.count}</p>
                <p className="text-xs text-text-secondary">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-1 rounded-lg border-half border-border-subtle bg-bg-surface px-4 py-3 text-xs text-text-secondary">
        <p className="font-medium text-text-primary">Permissões por papel</p>
        <p><span className="font-medium text-text-accent">Gestor</span> — visualiza tudo + abre OS (se habilitado pelo proprietário)</p>
        <p><span className="font-medium text-text-warning">Prestador</span> — recebe OS atribuídas + pode abrir OS (se habilitado)</p>
        <p><span className="font-medium text-text-secondary">Visualizador</span> — apenas leitura, não pode abrir OS</p>
      </div>

      {collaborators.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-text-primary">
              <Users className="h-4 w-4 text-text-accent" />
              Membros ativos
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-2">
            {collaborators.map((c) => (
              <CollaboratorRow
                key={c.id}
                collab={c}
                canManageTeam={canManageTeam}
                onToggleOS={handleToggleOS}
                onRemove={setRemovingCollab}
              />
            ))}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="mb-3 h-10 w-10 text-text-disabled" />
          <p className="text-text-secondary text-sm">Nenhum membro na equipe</p>
          {canManageTeam && (
            <Button variant="outline" className="mt-3" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" /> Convidar primeiro membro
            </Button>
          )}
        </div>
      )}

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-text-primary">
              <Mail className="h-4 w-4 text-text-warning" />
              Convites pendentes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-2">
            {invites.map((inv) => (
              <InviteRow key={inv.id} invite={inv} isOwner={canManageTeam} onCancel={handleCancelInvite} />
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-text-accent" />
              Convidar membro
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4 mt-2">
            <div className="space-y-2 rounded-lg border-half border-border-subtle p-3">
              <p className="text-xs font-medium flex items-center gap-1.5 text-text-primary">
                <ScanLine className="h-3.5 w-3.5 text-text-accent" />
                Cadastro automático por imagem
              </p>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setCardFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" className="w-full" loading={extractingCard} onClick={handleExtractCardData}>
                Extrair dados do cartão
              </Button>
              {cardSuggestion && (
                <p className="text-xs text-text-secondary">
                  Confiança da extração: {Math.round(cardSuggestion.confidence * 100)}%.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nome (pré-cadastro)</Label>
              <Input id="inv-name" placeholder="Nome do prestador" {...register('name')} />
              {errors.name && <p className="text-xs text-text-danger">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email">Email</Label>
              <Input id="inv-email" type="email" placeholder="prestador@email.com" {...register('email')} />
              {errors.email && <p className="text-xs text-text-danger">{errors.email.message}</p>}
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
            <div className="space-y-1.5">
              <Label htmlFor="inv-whatsapp">WhatsApp</Label>
              <Input id="inv-whatsapp" placeholder="5511999999999" {...register('whatsapp')} />
            </div>
            {selectedRole === 'provider' && (
              <div className="space-y-1.5">
                <Label>Especialidades (prestador)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALTY_OPTIONS.map((opt) => {
                    const active = selectedSpecialties.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleSpecialty(opt.value)}
                        className={cn(
                          'rounded-lg border-half px-2 py-1.5 text-xs text-left transition-colors',
                          active ? 'border-border-focus bg-bg-accent-subtle text-text-accent' : 'border-border-subtle hover:bg-bg-subtle'
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-text-secondary">
                  Se não selecionar nada, o prestador poderá receber OS de qualquer sistema.
                </p>
              </div>
            )}
            <p className="text-xs text-text-secondary">
              Com e-mail: envio automático. Sem e-mail: o sistema cria pré-cadastro e gera link para enviar no WhatsApp.
            </p>

            {lastInviteLink && (
              <div className="rounded-lg border-half border-border-subtle bg-bg-subtle px-3 py-2 space-y-2">
                <p className="text-xs font-medium text-text-primary">Link do convite para WhatsApp</p>
                <p className="text-xs break-all text-text-secondary">{lastInviteLink}</p>
                <Button type="button" variant="outline" className="w-full" onClick={handleCopyInviteLink}>
                  Copiar link
                </Button>
                {lastInviteWhatsapp && (
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => window.open(buildWhatsappUrl(lastInviteLink, lastInviteWhatsapp), '_blank', 'noopener,noreferrer')}
                  >
                    Abrir WhatsApp com convite
                  </Button>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                Enviar convite
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removingCollab} onOpenChange={() => setRemovingCollab(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remover membro</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Tem certeza que deseja remover <strong className="text-text-primary">{removingCollab?.name}</strong> da equipe?
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
