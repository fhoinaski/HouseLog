'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AppWindow,
  Copy,
  HelpCircle,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Wifi,
  X,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SensitiveField } from '@/components/ui/sensitive-field';
import { credentialsApi, type AccessCredential, type AccessCredentialPayload } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'wifi', label: 'Wi-Fi', icon: Wifi, tone: 'accent' },
  { value: 'alarm', label: 'Alarme', icon: Shield, tone: 'danger' },
  { value: 'smart_lock', label: 'Fechadura smart', icon: Lock, tone: 'warning' },
  { value: 'gate', label: 'Portao/acesso', icon: KeyRound, tone: 'warning' },
  { value: 'app', label: 'App/sistema', icon: AppWindow, tone: 'success' },
  { value: 'other', label: 'Outro', icon: HelpCircle, tone: 'muted' },
] as const;

type CategoryValue = (typeof CATEGORIES)[number]['value'];

const credSchema = z.object({
  category: z.enum(['wifi', 'alarm', 'smart_lock', 'gate', 'app', 'other']).default('other'),
  label: z.string().min(1, 'Obrigatorio'),
  username: z.string().optional(),
  secret: z.string().optional(),
  notes: z.string().optional(),
  integration_type: z.enum(['intelbras']).optional().nullable(),
  share_with_os: z.boolean().default(false),
  intelbras_host: z.string().optional(),
  intelbras_user: z.string().optional(),
  intelbras_pass: z.string().optional(),
});

type CredForm = z.infer<typeof credSchema>;

const labelClass = 'text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary';

function categoryByValue(value: AccessCredential['category'] | CategoryValue) {
  return CATEGORIES.find((category) => category.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

function iconToneClass(tone: string) {
  if (tone === 'danger') return 'bg-bg-danger text-text-danger';
  if (tone === 'warning') return 'bg-bg-warning text-text-warning';
  if (tone === 'success') return 'bg-bg-success text-text-success';
  if (tone === 'accent') return 'bg-bg-accent-subtle text-text-accent';
  return 'bg-bg-subtle text-text-secondary';
}

function TempCodeDialog({
  credId,
  propertyId,
  label,
  onClose,
}: {
  credId: string;
  propertyId: string;
  label: string;
  onClose: () => void;
}) {
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ temp_pin: string; expires_at: string; note: string } | null>(null);

  async function generate() {
    setLoading(true);
    try {
      const res = await credentialsApi.generateTempCode(propertyId, credId, { expires_hours: hours });
      setResult(res);
    } catch (e) {
      toast.error('Erro ao gerar codigo', { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-text-warning" />
          Gerar senha temporaria
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <p className="text-sm leading-6 text-text-secondary">
          Integracao Intelbras - <span className="font-medium text-text-primary">{label}</span>
        </p>

        {!result ? (
          <>
            <div className="space-y-1.5">
              <Label className={labelClass}>Validade</Label>
              <Select defaultValue="24" onValueChange={(value) => setHours(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <div className="rounded-[var(--radius-xl)] bg-bg-warning p-4 text-center">
              <p className="mb-1 text-xs text-text-warning">PIN temporario</p>
              <p className="select-all font-mono text-3xl font-medium tracking-widest text-text-primary">
                {result.temp_pin}
              </p>
              <p className="mt-2 text-xs text-text-warning">
                Expira: {new Date(result.expires_at).toLocaleString('pt-BR')}
              </p>
            </div>
            <p className="text-xs leading-5 text-text-secondary">{result.note}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  void navigator.clipboard.writeText(result.temp_pin);
                  toast.success('PIN copiado');
                }}
              >
                <Copy className="h-4 w-4" />
                Copiar
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setResult(null)}>
                <RefreshCw className="h-4 w-4" />
                Novo
              </Button>
            </div>
          </div>
        )}

        <Button variant="ghost" className="w-full text-xs text-text-secondary" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Fechar
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

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CredForm>({
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
      toast.error('Informe a senha ou codigo da credencial');
      return;
    }

    const intelbrasConfig =
      form.integration_type === 'intelbras'
        ? { host: form.intelbras_host, username: form.intelbras_user, password: form.intelbras_pass }
        : null;

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

  const grouped = CATEGORIES.map((category) => ({
    ...category,
    items: items.filter((credential) => credential.category === category.value),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6 px-4 py-4 sm:px-5 sm:py-5">
      <PageHeader
        density="editorial"
        eyebrow="Governanca de acesso"
        title="Credenciais do imovel"
        description="Senhas, codigos e integracoes ficam mascarados por padrao e exigem revelacao explicita."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nova credencial
          </Button>
        }
      />

      <PageSection
        title="Compartilhamento controlado"
        description="Credenciais marcadas como incluir em OS podem ser expostas ao prestador quando voce compartilha uma ordem via link."
        tone="strong"
        density="editorial"
        actions={<Badge variant="outline">Revelacao auditavel</Badge>}
      />

      {grouped.length > 0 ? (
        grouped.map(({ value, label, items: catItems }) => (
          <PageSection
            key={value}
            title={label}
            tone="surface"
            density="editorial"
            actions={<span className="text-xs text-text-secondary">{catItems.length} item{catItems.length !== 1 ? 's' : ''}</span>}
          >
            <div className="space-y-2">
              {catItems.map((cred) => {
                const category = categoryByValue(cred.category);
                const CategoryIcon = category.icon;

                return (
                  <article key={cred.id} className="group rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)]', iconToneClass(category.tone))}>
                        <CategoryIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-text-primary">{cred.label}</p>
                          {cred.share_with_os && <Badge variant="secondary" className="text-[11px]">Incluir em OS</Badge>}
                          {cred.integration_type && <Badge variant="warning" className="text-[11px]">{cred.integration_type}</Badge>}
                        </div>

                        {cred.username && (
                          <p className="text-xs text-text-secondary">
                            Usuario: <span className="font-mono">{cred.username}</span>
                          </p>
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

                        {cred.notes && <p className="text-xs leading-5 text-text-secondary">{cred.notes}</p>}
                      </div>

                      <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                        {cred.integration_type === 'intelbras' && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="min-h-9 w-9 text-text-warning"
                            onClick={() => setTempCodeCred(cred)}
                            aria-label={`Gerar PIN temporario para ${cred.label}`}
                          >
                            <Zap className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="min-h-9 w-9 text-text-secondary"
                          onClick={() => openEdit(cred)}
                          aria-label={`Editar ${cred.label}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="min-h-9 w-9 text-text-danger"
                          disabled={deletingId === cred.id}
                          onClick={() => handleDelete(cred.id)}
                          aria-label={`Remover ${cred.label}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </PageSection>
        ))
      ) : (
        <EmptyState
          icon={<KeyRound className="h-6 w-6" />}
          title="Nenhuma credencial cadastrada"
          description="Salve Wi-Fi, alarmes, fechaduras inteligentes e outros acessos sensiveis do imovel."
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Adicionar primeiro acesso
            </Button>
          }
          tone="strong"
          density="spacious"
        />
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-text-accent" />
              {editing ? 'Editar credencial' : 'Nova credencial'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className={labelClass}>Categoria *</Label>
              <Select value={watchCategory} onValueChange={(value) => setValue('category', value as CategoryValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(({ value, label, icon: Icon }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="label" className={labelClass}>Nome / identificacao *</Label>
              <Input id="label" placeholder="Ex: Wi-Fi principal, alarme sala..." {...register('label')} />
              {errors.label && <p className="text-xs text-text-danger">{errors.label.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username" className={labelClass}>Usuario / SSID</Label>
              <Input id="username" placeholder="Ex: HouseNet_2G, admin..." {...register('username')} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="secret" className={labelClass}>Senha / codigo / PIN {editing ? '' : '*'}</Label>
              <Input id="secret" type="password" placeholder="********" {...register('secret')} />
              <p className="text-xs leading-5 text-text-secondary">
                {editing ? 'Deixe em branco para manter o segredo atual.' : 'O segredo nao aparece na lista apos salvar.'}
              </p>
              {errors.secret && <p className="text-xs text-text-danger">{errors.secret.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className={labelClass}>Observacoes</Label>
              <Input id="notes" placeholder="Ex: Rede 5GHz, pressione * antes do codigo..." {...register('notes')} />
            </div>

            {watchCategory === 'smart_lock' && (
              <div className="space-y-3 rounded-[var(--radius-xl)] bg-bg-warning p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-text-warning">
                    <Zap className="h-3.5 w-3.5" />
                    Integracao Intelbras
                  </p>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-warning">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={watchIntegration === 'intelbras'}
                      onChange={(event) => setValue('integration_type', event.target.checked ? 'intelbras' : null)}
                    />
                    Habilitar
                  </label>
                </div>

                {watchIntegration === 'intelbras' && (
                  <div className="space-y-2">
                    <Input placeholder="IP/Host do controlador (ex: 192.168.1.100)" {...register('intelbras_host')} />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Usuario" {...register('intelbras_user')} />
                      <Input placeholder="Senha" type="password" {...register('intelbras_pass')} />
                    </div>
                    <p className="text-xs leading-5 text-text-warning">
                      Compatibilidade mantida com a integracao atual do backend.
                    </p>
                  </div>
                )}
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-xl)] bg-[var(--surface-base)] p-3 transition-colors hover:bg-[var(--field-bg-hover)]">
              <input type="checkbox" className="mt-0.5 rounded" {...register('share_with_os')} />
              <span>
                <span className="text-sm font-medium text-text-primary">Incluir em OS compartilhadas</span>
                <span className="mt-1 block text-xs leading-5 text-text-secondary">
                  Esta credencial podera ficar visivel para o prestador quando uma OS for compartilhada via link.
                </span>
              </span>
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
