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
  requested: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
  verified: 'bg-primary-100 text-primary-700',
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
        'flex-1 rounded bg-slate-100 px-2 py-1 text-xs font-mono tracking-wider',
        visible ? 'text-slate-900' : 'select-none text-transparent [text-shadow:0_0_6px_rgba(0,0,0,0.5)]'
      )}>
        {secret}
      </code>
      <button onClick={() => setVisible(!visible)}
        className="text-xs text-slate-500 hover:text-slate-700 underline">
        {visible ? 'Ocultar' : 'Ver'}
      </button>
      <button onClick={copy} className="text-xs text-primary-600 hover:text-primary-700 underline">
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center bg-[var(--background)]">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
          <XCircle className="h-8 w-8 text-rose-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Link inválido</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)] max-w-xs">{error}</p>
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
    <div className="min-h-screen bg-[var(--background)] py-8 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-700/30">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)] uppercase tracking-widest font-semibold">HouseLog</p>
            <h1 className="text-sm font-bold leading-tight">Ordem de Serviço Compartilhada</h1>
          </div>
        </div>

        {/* Property */}
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-primary-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">{property.name}</p>
              <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
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
              <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_COLORS[service.status])}>
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
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{service.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {service.scheduled_at && (
                <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-primary-500" />
                  <span>{formatDate(service.scheduled_at)}</span>
                </div>
              )}
              {service.cost && (
                <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                  <DollarSign className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span>{formatCurrency(service.cost)}</span>
                </div>
              )}
              {service.warranty_until && (
                <div className="flex items-center gap-1.5 text-[var(--muted-foreground)]">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span>Garantia até {formatDate(service.warranty_until)}</span>
                </div>
              )}
            </div>

            {checklist.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Checklist</p>
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {item.done
                      ? <CheckSquare className="h-4 w-4 text-emerald-500 shrink-0" />
                      : <Square className="h-4 w-4 text-slate-400 shrink-0" />}
                    <span className={item.done ? 'line-through text-[var(--muted-foreground)]' : ''}>{item.item}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credentials */}
        {credentials.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                <KeyRound className="h-4 w-4" />
                Informações de Acesso
              </CardTitle>
              <p className="text-xs text-[var(--muted-foreground)]">
                Compartilhado pelo proprietário para execução do serviço.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {credentials.map((cred, i) => {
                const Icon = CRED_ICONS[cred.category] ?? HelpCircle;
                return (
                  <div key={i} className="rounded-lg bg-amber-50 border border-amber-100 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      <span className="text-xs font-semibold text-amber-800">
                        {CRED_LABELS[cred.category]} — {cred.label}
                      </span>
                    </div>
                    {cred.username && (
                      <p className="text-xs text-slate-600">Usuário: <span className="font-mono">{cred.username}</span></p>
                    )}
                    <RevealSecret secret={cred.secret} />
                    {cred.notes && <p className="text-xs text-slate-500 mt-1">{cred.notes}</p>}
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
                <ClipboardCheck className="h-4 w-4 text-primary-500" />
                Histórico do Prestador
                {link.provider_name && <span className="text-xs font-normal text-[var(--muted-foreground)]">— {link.provider_name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alreadyAccepted && (
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Aceito em {formatDate(link.provider_accepted_at!)}
                </div>
              )}
              {alreadyStarted && (
                <div className="flex items-center gap-2 text-xs text-amber-700">
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
                <p className="text-xs text-[var(--muted-foreground)] mt-2 italic">
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
                <Wrench className="h-4 w-4 text-primary-500" />
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
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
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
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              {actionDone && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700 flex items-center gap-2">
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
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="font-semibold text-sm">Serviço concluído!</p>
            <p className="text-xs text-[var(--muted-foreground)]">O proprietário será notificado para verificação.</p>
          </div>
        )}

        <p className="text-center text-[10px] text-[var(--muted-foreground)] pb-4">
          Link expira em {formatDate(link.expires_at)} · HouseLog
        </p>
      </div>
    </div>
  );
}
