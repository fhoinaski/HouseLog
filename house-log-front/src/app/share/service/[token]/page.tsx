'use client';

import { use, useEffect, useState } from 'react';
import {
  Building2, MapPin, Wrench, Calendar, DollarSign, CheckSquare,
  Square, Loader2, XCircle, CheckCircle2, PlayCircle, ClipboardCheck,
  Wifi, Shield, KeyRound, Lock, AppWindow, HelpCircle,
} from 'lucide-react';
import { shareApi, type PublicServiceView } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatDate, formatCurrency, SERVICE_STATUS_LABELS, SERVICE_PRIORITY_LABELS, SYSTEM_TYPE_LABELS } from '@/lib/utils';

const CRED_ICONS: Record<string, React.ElementType> = {
  wifi: Wifi, alarm: Shield, smart_lock: Lock, gate: KeyRound, app: AppWindow, other: HelpCircle,
};

const CRED_LABELS: Record<string, string> = {
  wifi: 'Wi-Fi', alarm: 'Alarme', smart_lock: 'Fechadura', gate: 'Portão', app: 'App/Sistema', other: 'Acesso',
};

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-(--color-neutral-50) text-(--hl-text-secondary)',
  approved: 'bg-(--color-primary-light) text-(--color-primary)',
  in_progress: 'bg-(--color-warning-light) text-(--color-warning)',
  completed: 'bg-(--color-success-light) text-(--color-success)',
  verified: 'bg-(--color-primary-light) text-(--color-primary)',
};

function RevealSecret({ secret }: { secret: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 mt-1">
      <code className={cn(
        'flex-1 rounded bg-(--color-neutral-50) px-2 py-1 text-xs font-mono tracking-wider',
        visible ? 'text-neutral-900' : 'select-none text-neutral-400'
      )}>
        {visible ? secret : '••••••••'}
      </code>
      <button onClick={() => setVisible(!visible)}
        className="text-xs text-(--hl-text-secondary) underline hover:text-(--hl-text-primary)">
        {visible ? 'Ocultar' : 'Ver'}
      </button>
      <button onClick={copy} className="text-xs text-(--color-primary) underline hover:brightness-90">
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  );
}

export default function PublicServicePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PublicServiceView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [actionDone, setActionDone] = useState<'accept' | 'start' | 'done' | null>(null);
  const [providerName, setProviderName] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    shareApi.getPublic(token)
      .then(setData)
      .catch((e) => setError((e as Error).message ?? 'Link inválido ou expirado'));
  }, [token]);

  async function act(action: 'accept' | 'start' | 'done') {
    setActing(true);
    try {
      await shareApi.updateStatus(token, { action, provider_name: providerName || undefined, notes: notes || undefined });
      setActionDone(action);
      // Refresh
      const refreshed = await shareApi.getPublic(token);
      setData(refreshed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setActing(false);
    }
  }

  if (!data && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-(--color-primary)" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center bg-background">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--color-danger-light)">
          <XCircle className="h-8 w-8 text-(--color-danger)" />
        </div>
        <div>
          <h1 className="text-xl font-medium">Link inválido</h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xs">{error}</p>
        </div>
      </div>
    );
  }

  const { service, property, link, credentials } = data!;
  const checklist = Array.isArray(service.checklist) ? service.checklist as { item: string; done: boolean }[] : [];

  const alreadyAccepted = !!link.provider_accepted_at;
  const alreadyStarted  = !!link.provider_started_at;
  const alreadyDone     = !!link.provider_done_at;

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-20">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--color-primary)">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">HouseLog</p>
            <h1 className="text-sm font-medium leading-tight">Ordem de serviço compartilhada</h1>
          </div>
        </div>

        {/* Property */}
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-(--color-primary)" />
            <div>
              <p className="text-sm font-medium">{property.name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {property.address}, {property.city}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* OS Details */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{service.title}</CardTitle>
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_COLORS[service.status])}>
                {SERVICE_STATUS_LABELS[service.status]}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{SYSTEM_TYPE_LABELS[service.system_type] ?? service.system_type}</Badge>
              <Badge variant={service.priority === 'urgent' ? 'urgent' : service.priority === 'preventive' ? 'preventive' : 'normal'}>
                {SERVICE_PRIORITY_LABELS[service.priority]}
              </Badge>
              {service.room_name && <Badge variant="secondary">{service.room_name}</Badge>}
            </div>

            {service.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{service.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {service.scheduled_at && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-(--color-primary)" />
                  <span>{formatDate(service.scheduled_at)}</span>
                </div>
              )}
              {service.cost && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 shrink-0 text-(--color-success)" />
                  <span>{formatCurrency(service.cost)}</span>
                </div>
              )}
              {service.warranty_until && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span>Garantia até {formatDate(service.warranty_until)}</span>
                </div>
              )}
            </div>

            {checklist.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">Checklist</p>
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {item.done
                      ? <CheckSquare className="h-4 w-4 shrink-0 text-(--color-success)" />
                      : <Square className="h-4 w-4 shrink-0 text-neutral-400" />}
                    <span className={item.done ? 'line-through text-muted-foreground' : ''}>{item.item}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credentials */}
        {credentials.length > 0 && (
          <Card className="border-(--color-warning-border)">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-(--color-warning)">
                <KeyRound className="h-4 w-4" />
                Informações de Acesso
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Compartilhado pelo proprietário para execução do serviço.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {credentials.map((cred, i) => {
                const Icon = CRED_ICONS[cred.category] ?? HelpCircle;
                return (
                  <div key={i} className="rounded-lg border border-(--color-warning-border) bg-(--color-warning-light) p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-(--color-warning)" />
                      <span className="text-xs font-medium text-(--color-warning)">
                        {CRED_LABELS[cred.category]} — {cred.label}
                      </span>
                    </div>
                    {cred.username && (
                      <p className="text-xs text-neutral-600">Usuário: <span className="font-mono">{cred.username}</span></p>
                    )}
                    <RevealSecret secret={cred.secret} />
                    {cred.notes && <p className="mt-1 text-xs text-neutral-400">{cred.notes}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Provider timeline */}
        {(alreadyAccepted || alreadyStarted || alreadyDone) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-(--color-primary)" />
                Histórico do Prestador
                {link.provider_name && <span className="text-xs font-normal text-muted-foreground">— {link.provider_name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alreadyAccepted && (
                <div className="flex items-center gap-2 text-xs text-(--color-success)">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Aceito em {formatDate(link.provider_accepted_at!)}
                </div>
              )}
              {alreadyStarted && (
                <div className="flex items-center gap-2 text-xs text-(--color-warning)">
                  <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                  Iniciado em {formatDate(link.provider_started_at!)}
                </div>
              )}
              {alreadyDone && (
                <div className="flex items-center gap-2 text-xs text-primary-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Concluído em {formatDate(link.provider_done_at!)}
                </div>
              )}
              {link.notes_from_provider && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  &ldquo;{link.notes_from_provider}&rdquo;
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {!alreadyDone && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="h-4 w-4 text-(--color-primary)" />
                {alreadyStarted ? 'Marcar como Concluído' : alreadyAccepted ? 'Iniciar Execução' : 'Confirmar Recebimento'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!alreadyAccepted && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Seu nome (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva — Elétrica Rápida"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--field-focus-ring)"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Observação (opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Observações sobre o serviço..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-(--field-focus-ring)"
                />
              </div>

              {actionDone && (
                <div className="flex items-center gap-2 rounded-lg border border-(--color-success) bg-(--color-success-light) px-3 py-2 text-sm text-(--color-success)">
                  <CheckCircle2 className="h-4 w-4" />
                  {actionDone === 'accept' ? 'OS aceita com sucesso!' : actionDone === 'start' ? 'Execução iniciada!' : 'OS marcada como concluída!'}
                </div>
              )}

              <div className="flex gap-2">
                {!alreadyAccepted && (
                  <Button className="flex-1" onClick={() => act('accept')} loading={acting}>
                    <CheckCircle2 className="h-4 w-4" />
                    Aceitar OS
                  </Button>
                )}
                {alreadyAccepted && !alreadyStarted && (
                  <Button className="flex-1" onClick={() => act('start')} loading={acting}>
                    <PlayCircle className="h-4 w-4" />
                    Iniciar Serviço
                  </Button>
                )}
                {alreadyStarted && !alreadyDone && (
                  <Button className="flex-1" onClick={() => act('done')} loading={acting}>
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar Concluído
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {alreadyDone && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-(--color-success-light)">
              <CheckCircle2 className="h-7 w-7 text-(--color-success)" />
            </div>
            <p className="text-sm font-medium">Serviço concluído!</p>
            <p className="text-xs text-muted-foreground">O proprietário será notificado para verificação.</p>
          </div>
        )}

        <p className="pb-4 text-center text-[11px] text-muted-foreground">
          Link expira em {formatDate(link.expires_at)} · HouseLog
        </p>
      </div>
    </div>
  );
}
