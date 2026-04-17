'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Wifi, Shield, Lock, KeyRound, AppWindow, HelpCircle,
  Plus, Trash2, Eye, EyeOff, Copy, Pencil, Zap, X,
  RefreshCw,
} from 'lucide-react';
import { credentialsApi, type AccessCredential } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'wifi',       label: 'Wi-Fi',         icon: Wifi,       color: 'text-blue-500',    bg: 'bg-blue-50 border-blue-100' },
  { value: 'alarm',      label: 'Alarme',         icon: Shield,     color: 'text-rose-500',    bg: 'bg-rose-50 border-rose-100' },
  { value: 'smart_lock', label: 'Fechadura Smart', icon: Lock,       color: 'text-violet-500',  bg: 'bg-violet-50 border-violet-100' },
  { value: 'gate',       label: 'Portão/Acesso',  icon: KeyRound,   color: 'text-amber-500',   bg: 'bg-amber-50 border-amber-100' },
  { value: 'app',        label: 'App/Sistema',    icon: AppWindow,  color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-100' },
  { value: 'other',      label: 'Outro',          icon: HelpCircle, color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-100' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

const credSchema = z.object({
  category:          z.enum(['wifi', 'alarm', 'smart_lock', 'gate', 'app', 'other']).default('other'),
  label:             z.string().min(1, 'Obrigatório'),
  username:          z.string().optional(),
  secret:            z.string().min(1, 'Senha/código obrigatório'),
  notes:             z.string().optional(),
  integration_type:  z.enum(['intelbras']).optional().nullable(),
  share_with_os:     z.boolean().default(false),
  // Intelbras config fields
  intelbras_host:    z.string().optional(),
  intelbras_user:    z.string().optional(),
  intelbras_pass:    z.string().optional(),
});

type CredForm = z.infer<typeof credSchema>;

function SecretCell({ secret }: { secret: string }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-1.5">
      <code className={cn(
        'flex-1 rounded px-1.5 py-0.5 text-xs font-mono bg-[var(--muted)]',
        show ? '' : 'select-none [filter:blur(4px)]'
      )}>
        {secret}
      </code>
      <button onClick={() => setShow(!show)} className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button onClick={copy} className="p-1 text-[var(--muted-foreground)] hover:text-primary-500 transition-colors">
        {copied ? <span className="text-[10px] text-emerald-500 font-medium">✓</span> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

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
          <Zap className="h-4 w-4 text-amber-500" />
          Gerar Senha Temporária
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">Integração Intelbras — <strong>{label}</strong></p>

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
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
              <p className="text-xs text-amber-600 mb-1">PIN Temporário</p>
              <p className="text-3xl font-bold font-mono tracking-widest text-amber-900 select-all">{result.temp_pin}</p>
              <p className="text-xs text-amber-600 mt-2">Expira: {new Date(result.expires_at).toLocaleString('pt-BR')}</p>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">{result.note}</p>
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

        <Button variant="ghost" className="w-full text-xs text-[var(--muted-foreground)]" onClick={onClose}>
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
      secret: cred.secret,
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
    const intelbrasConfig = form.integration_type === 'intelbras' ? {
      host: form.intelbras_host, username: form.intelbras_user, password: form.intelbras_pass,
    } : null;

    const payload = {
      category: form.category,
      label: form.label,
      username: form.username || null,
      secret: form.secret,
      notes: form.notes || null,
      integration_type: form.integration_type ?? null,
      integration_config: intelbrasConfig,
      share_with_os: form.share_with_os,
    };

    try {
      if (editing) {
        await credentialsApi.update(propertyId, editing.id, payload);
        toast.success('Credencial atualizada');
      } else {
        await credentialsApi.create(propertyId, payload);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Senhas & Acessos</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Wi-Fi, alarmes, fechaduras, portões e integrações.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nova Credencial
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-700 dark:border-primary-900/40 dark:bg-primary-900/10 dark:text-primary-300">
        <p className="font-semibold mb-0.5">Compartilhamento seguro</p>
        <p className="text-xs opacity-80">
          Credenciais marcadas como <strong>"incluir em OS"</strong> são automaticamente enviadas
          ao prestador quando você compartilha uma Ordem de Serviço via link.
        </p>
      </div>

      {/* Grouped by category */}
      {grouped.length > 0 ? (
        grouped.map(({ value, label, icon: Icon, color, bg, items: catItems }) => (
          <Card key={value}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg border', bg)}>
                  <Icon className={cn('h-3.5 w-3.5', color)} />
                </div>
                {label}
                <span className="ml-auto text-xs font-normal text-[var(--muted-foreground)]">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {catItems.map((cred) => (
                <div key={cred.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3 group">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{cred.label}</p>
                      {cred.share_with_os && (
                        <Badge variant="secondary" className="text-[10px] py-0">Incluir em OS</Badge>
                      )}
                      {cred.integration_type && (
                        <Badge variant="secondary" className="text-[10px] py-0 bg-amber-100 text-amber-700">
                          {cred.integration_type}
                        </Badge>
                      )}
                    </div>
                    {cred.username && (
                      <p className="text-xs text-[var(--muted-foreground)]">Usuário: <span className="font-mono">{cred.username}</span></p>
                    )}
                    <SecretCell secret={cred.secret} />
                    {cred.notes && <p className="text-xs text-[var(--muted-foreground)]">{cred.notes}</p>}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {cred.integration_type === 'intelbras' && (
                      <button
                        onClick={() => setTempCodeCred(cred)}
                        className="flex items-center justify-center h-7 w-7 rounded-lg text-amber-500 hover:bg-amber-50 transition-colors"
                        title="Gerar senha temporária"
                      >
                        <Zap className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openEdit(cred)}
                      className="flex items-center justify-center h-7 w-7 rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cred.id)}
                      disabled={deletingId === cred.id}
                      className="flex items-center justify-center h-7 w-7 rounded-lg text-rose-400 hover:bg-rose-50 transition-colors disabled:opacity-40"
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
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)] mb-4">
            <KeyRound className="h-8 w-8 text-[var(--muted-foreground)]" />
          </div>
          <p className="font-semibold">Nenhuma credencial cadastrada</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-1 max-w-xs">
            Salve senhas de Wi-Fi, alarmes, fechaduras inteligentes e outros acessos do imóvel.
          </p>
          <Button className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Adicionar primeiro acesso
          </Button>
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary-500" />
              {editing ? 'Editar Credencial' : 'Nova Credencial'}
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
              {errors.label && <p className="text-xs text-rose-500">{errors.label.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username">Usuário / SSID (opcional)</Label>
              <Input id="username" placeholder="Ex: HouseNet_2G, admin..." {...register('username')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="secret">Senha / Código / PIN *</Label>
              <Input id="secret" type="password" placeholder="••••••••" {...register('secret')} />
              {errors.secret && <p className="text-xs text-rose-500">{errors.secret.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Input id="notes" placeholder="Ex: Rede 5GHz, pressione * antes do código..." {...register('notes')} />
            </div>

            {/* Intelbras integration */}
            {watchCategory === 'smart_lock' && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> Integração Intelbras
                  </p>
                  <label className="flex items-center gap-1.5 text-xs text-amber-700 cursor-pointer">
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
                    <p className="text-[10px] text-amber-600">
                      Compatível com Intelbras Control iD, SS 5530 MF e similares via API local.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Share with OS */}
            <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3 cursor-pointer hover:bg-[var(--muted)] transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 rounded"
                {...register('share_with_os')}
              />
              <div>
                <p className="text-sm font-medium">Incluir em OS compartilhadas</p>
                <p className="text-xs text-[var(--muted-foreground)]">
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

      {/* Temp code dialog */}
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
