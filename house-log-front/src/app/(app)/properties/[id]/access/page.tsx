'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Wifi, Shield, Lock, KeyRound, AppWindow, HelpCircle,
  Plus, Trash2, Copy, Pencil, Zap, X,
  RefreshCw,
} from 'lucide-react';
import { credentialsApi, type AccessCredential, type AccessCredentialPayload } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SensitiveField } from '@/components/ui/sensitive-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'wifi',       label: 'Wi-Fi',          icon: Wifi,       color: 'text-text-accent',   bg: 'bg-bg-accent-subtle border-border-accent' },
  { value: 'alarm',      label: 'Alarme',         icon: Shield,     color: 'text-text-danger',   bg: 'bg-bg-danger border-border-danger' },
  { value: 'smart_lock', label: 'Fechadura smart', icon: Lock,       color: 'text-text-warning',  bg: 'bg-bg-warning border-border-warning' },
  { value: 'gate',       label: 'Portão/acesso',  icon: KeyRound,   color: 'text-text-warning',  bg: 'bg-bg-warning border-border-warning' },
  { value: 'app',        label: 'App/sistema',    icon: AppWindow,  color: 'text-text-success',  bg: 'bg-bg-success border-border-success' },
  { value: 'other',      label: 'Outro',          icon: HelpCircle, color: 'text-text-secondary', bg: 'bg-bg-subtle border-border-subtle' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

const credSchema = z.object({
  category:          z.enum(['wifi', 'alarm', 'smart_lock', 'gate', 'app', 'other']).default('other'),
  label:             z.string().min(1, 'Obrigatório'),
  username:          z.string().optional(),
  secret:            z.string().optional(),
  notes:             z.string().optional(),
  integration_type:  z.enum(['intelbras']).optional().nullable(),
  share_with_os:     z.boolean().default(false),
  intelbras_host:    z.string().optional(),
  intelbras_user:    z.string().optional(),
  intelbras_pass:    z.string().optional(),
});

type CredForm = z.infer<typeof credSchema>;

function TempCodeDialog({ credId, propertyId, label, onClose }: { credId: string; propertyId: string; label: string; onClose: () => void }) {
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ temp_pin: string; expires_at: string; note: string } | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await credentialsApi.generateTempCode(propertyId, credId, { expires_hours: hours });
      setResult(res);
    } catch (e) {
      toast.error('Erro ao gerar código', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-text-warning" />
          Gerar senha temporária
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">Integração Intelbras — <span className="font-medium text-text-primary">{label}</span></p>

        {!result ? (
          <>
            <div className="space-y-1.5">
              <Label>Validade</Label>
              <Select defaultValue="24" onValueChange={(v) => setHours(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 horas</SelectItem>
                  <SelectItem value="8">8 horas</SelectItem>
                  <SelectItem value="24">24 horas</SelectItem>
                  <SelectItem value="48">48 horas</SelectItem>
                  <SelectItem value="168">1 semana</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={generate} loading={loading}>
              <Zap className="h-4 w-4" />
              Gerar PIN
            </Button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl border-half border-border-warning bg-bg-warning p-4 text-center">
              <p className="mb-1 text-xs text-text-warning">PIN temporário</p>
              <p className="select-all font-mono text-3xl font-medium tracking-widest text-text-primary">{result.temp_pin}</p>
              <p className="mt-2 text-xs text-text-warning">Expira: {new Date(result.expires_at).toLocaleString('pt-BR')}</p>
            </div>
            <p className="text-xs text-text-secondary">{result.note}</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => {
                navigator.clipboard.writeText(result.temp_pin);
                toast.success('PIN copiado!');
              }}>
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setResult(null)}>
                <RefreshCw className="h-4 w-4" /> Novo
              </Button>
            </div>
          </div>
        )}

        <Button variant="ghost" className="w-full text-xs text-text-secondary" onClick={onClose}>
          <X className="h-3.5 w-3.5" /> Fechar
        </Button>
      </div>
    </DialogContent>
  );
}

export default function AccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: propertyId } = use(params);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccessCredential | null>(null);
  const [tempCodeCred, setTempCodeCred] = useState<AccessCredential | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data, mutate } = useSWR(['credentials', propertyId], () => credentialsApi.list(propertyId));
  const items = data?.credentials ?? [];

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<CredForm>({
    resolver: zodResolver(credSchema),
    defaultValues: { category: 'wifi', share_with_os: false },
  });

  const watchCategory = watch('category');
  const watchIntegration = watch('integration_type');

  function openCreate() {
    reset({ category: 'wifi', share_with_os: false });
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(cred: AccessCredential) {
    reset({
      category: cred.category,
      label: cred.label,
      username: cred.username ?? '',
      secret: '',
      notes: cred.notes ?? '',
      integration_type: cred.integration_type ?? null,
      share_with_os: cred.share_with_os,
      intelbras_host: (cred.integration_config?.host as string) ?? '',
      intelbras_user: (cred.integration_config?.username as string) ?? '',
      intelbras_pass: (cred.integration_config?.password as string) ?? '',
    });
    setEditing(cred);
    setFormOpen(true);
  }

  async function onSubmit(form: CredForm) {
    if (!editing && !form.secret?.trim()) {
      toast.error('Informe a senha ou código da credencial');
      return;
    }

    const intelbrasConfig = form.integration_type === 'intelbras' ? {
      host: form.intelbras_host, username: form.intelbras_user, password: form.intelbras_pass,
    } : null;

    const payload: Partial<AccessCredentialPayload> = {
      category: form.category,
      label: form.label,
      username: form.username || undefined,
      ...(form.secret?.trim() ? { secret: form.secret } : {}),
      notes: form.notes || undefined,
      integration_type: form.integration_type ?? null,
      integration_config: intelbrasConfig,
      share_with_os: form.share_with_os,
    };

    try {
      if (editing) {
        await credentialsApi.update(propertyId, editing.id, payload);
        toast.success('Credencial atualizada');
      } else {
        await credentialsApi.create(propertyId, payload as AccessCredentialPayload);
        toast.success('Credencial salva');
      }
      await mutate();
      setFormOpen(false);
    } catch (e) {
      toast.error('Erro ao salvar', { description: (e as Error).message });
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await credentialsApi.delete(propertyId, id);
      await mutate();
      toast.success('Credencial removida');
    } catch (e) {
      toast.error('Erro', { description: (e as Error).message });
    } finally {
      setDeletingId(null);
    }
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((c) => c.category === cat.value),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 safe-bottom">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-medium text-text-primary">Senhas e acessos</h2>
          <p className="text-sm text-text-secondary">
            Wi-Fi, alarmes, fechaduras, portões e integrações.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova credencial
        </Button>
      </div>

      <div className="rounded-xl border-half border-border-accent bg-bg-accent-subtle px-4 py-3 text-sm text-text-accent">
        <p className="mb-0.5 font-medium">Compartilhamento seguro</p>
        <p className="text-xs opacity-80">
          Credenciais marcadas como <span className="font-medium">&quot;incluir em OS&quot;</span> são automaticamente enviadas
          ao prestador quando você compartilha uma Ordem de Serviço via link.
        </p>
      </div>

      {grouped.length > 0 ? (
        grouped.map(({ value, label, icon: Icon, color, bg, items: catItems }) => (
          <Card key={value}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-text-primary">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border-half', bg)}>
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                </div>
                {label}
                <span className="ml-auto text-xs font-normal text-text-secondary">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {catItems.map((cred) => (
                <div key={cred.id} className="flex items-start gap-3 rounded-xl border-half border-border-subtle p-3 group">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary">{cred.label}</p>
                      {cred.share_with_os && (
                        <Badge variant="secondary" className="text-[11px] py-0">Incluir em OS</Badge>
                      )}
                      {cred.integration_type && (
                        <Badge variant="warning" className="py-0 text-[11px]">
                          {cred.integration_type}
                        </Badge>
                      )}
                    </div>
                    {cred.username && (
                      <p className="text-xs text-text-secondary">Usuário: <span className="font-mono">{cred.username}</span></p>
                    )}
                    <SensitiveField
                      label="Segredo"
                      hasValue={cred.has_secret}
                      maskedText="Credencial protegida"
                      emptyText="Sem segredo cadastrado"
                      revealLabel={`Revelar credencial ${cred.label}`}
                      hideLabel={`Ocultar credencial ${cred.label}`}
                      copyLabel={`Copiar credencial ${cred.label}`}
                      onReveal={async () => {
                        const res = await credentialsApi.revealSecret(propertyId, cred.id);
                        return res.credential.secret;
                      }}
                      onCopy={() => {
                        toast.success('Credencial copiada');
                      }}
                      onError={(error) => toast.error('Erro ao acessar credencial', { description: (error as Error).message })}
                    />
                    {cred.notes && <p className="text-xs text-text-secondary">{cred.notes}</p>}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {cred.integration_type === 'intelbras' && (
                      <button
                        onClick={() => setTempCodeCred(cred)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-warning transition-colors hover:bg-bg-warning"
                        title="Gerar senha temporária"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(cred)}
                      className="flex items-center justify-center h-7 w-7 rounded-lg text-text-secondary hover:bg-bg-subtle transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cred.id)}
                      disabled={deletingId === cred.id}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-text-danger transition-colors hover:bg-bg-danger disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-subtle mb-4">
            <KeyRound className="h-8 w-8 text-text-tertiary" />
          </div>
          <p className="font-medium text-text-primary">Nenhuma credencial cadastrada</p>
          <p className="text-sm text-text-secondary mt-1 max-w-xs">
            Salve senhas de Wi-Fi, alarmes, fechaduras inteligentes e outros acessos do imóvel.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Adicionar primeiro acesso
          </Button>
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-text-accent" />
              {editing ? 'Editar credencial' : 'Nova credencial'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select defaultValue={editing?.category ?? 'wifi'} onValueChange={(v) => setValue('category', v as CategoryValue)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />{label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="label">Nome / Identificação *</Label>
              <Input id="label" placeholder="Ex: Wi-Fi Principal, Alarme Sala..." {...register('label')} />
              {errors.label && <p className="text-xs text-text-danger">{errors.label.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Usuário / SSID (opcional)</Label>
              <Input id="username" placeholder="Ex: HouseNet_2G, admin..." {...register('username')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="secret">Senha / Código / PIN *</Label>
              <Input id="secret" type="password" placeholder="••••••••" {...register('secret')} />
              {errors.secret && <p className="text-xs text-text-danger">{errors.secret.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Input id="notes" placeholder="Ex: Rede 5GHz, pressione * antes do código..." {...register('notes')} />
            </div>

            {watchCategory === 'smart_lock' && (
              <div className="space-y-3 rounded-xl border-half border-border-warning bg-bg-warning p-3">
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-text-warning">
                    <Zap className="h-3.5 w-3.5" /> Integração Intelbras
                  </p>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-warning">
                    <input
                      type="checkbox"
                      className="rounded"
                      onChange={(e) => setValue('integration_type', e.target.checked ? 'intelbras' : null)}
                      defaultChecked={editing?.integration_type === 'intelbras'}
                    />
                    Habilitar
                  </label>
                </div>
                {watchIntegration === 'intelbras' && (
                  <div className="space-y-2">
                    <Input placeholder="IP/Host do controlador (ex: 192.168.1.100)" {...register('intelbras_host')} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Usuário" {...register('intelbras_user')} />
                      <Input placeholder="Senha" type="password" {...register('intelbras_pass')} />
                    </div>
                    <p className="text-xs text-text-warning">
                      Compatível com Intelbras Control iD, SS 5530 MF e similares via API local.
                    </p>
                  </div>
                )}
              </div>
            )}

            <label className="flex items-start gap-3 rounded-xl border-half border-border-subtle p-3 cursor-pointer hover:bg-bg-subtle transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                {...register('share_with_os')}
              />
              <div>
                <p className="text-sm font-medium text-text-primary">Incluir em OS compartilhadas</p>
                <p className="text-xs text-text-secondary">
                  Esta credencial será visível para o prestador quando o proprietário compartilhar uma OS via link.
                </p>
              </div>
            </label>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tempCodeCred} onOpenChange={() => setTempCodeCred(null)}>
        {tempCodeCred && (
          <TempCodeDialog
            credId={tempCodeCred.id}
            propertyId={propertyId}
            label={tempCodeCred.label}
            onClose={() => setTempCodeCred(null)}
          />
        )}
      </Dialog>
    </div>
  );
}
