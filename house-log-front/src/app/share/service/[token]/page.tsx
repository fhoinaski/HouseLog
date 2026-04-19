'use client';

import { use, useEffect, useId, useState } from 'react';
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
  wifi: 'Wi-Fi', alarm: 'Alarme', smart_lock: 'Fechadura', gate: 'Portao', app: 'App/Sistema', other: 'Acesso',
};

const STATUS_COLORS: Record<string, string> = {
  requested: 'hl-badge hl-badge-pending',
  approved: 'hl-badge hl-badge-approval',
  in_progress: 'hl-badge hl-badge-progress',
  completed: 'hl-badge hl-badge-done',
  verified: 'hl-badge hl-badge-done',
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
    <div className="mt-1 flex items-center gap-2">
      <code className={cn('flex-1 rounded bg-bg-subtle px-2 py-1 text-xs font-mono tracking-wider', visible ? 'text-text-primary' : 'select-none text-text-tertiary')}>
        {visible ? secret : '••••••••'}
      </code>
      <button onClick={() => setVisible(!visible)} className="hl-btn-ghost h-auto min-h-0 px-0 py-0 text-xs text-text-secondary" aria-label={visible ? 'Ocultar segredo' : 'Mostrar segredo'}>
        {visible ? 'Ocultar' : 'Ver'}
      </button>
      <button onClick={copy} className="hl-btn-ghost h-auto min-h-0 px-0 py-0 text-xs text-text-accent" aria-label="Copiar segredo">
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
  const providerNameId = useId();
  const notesId = useId();
  const notesHelpId = `${notesId}-help`;

  useEffect(() => {
    shareApi.getPublic(token)
      .then(setData)
      .catch((e) => setError((e as Error).message ?? 'Link invalido ou expirado'));
  }, [token]);

  async function act(action: 'accept' | 'start' | 'done') {
    setActing(true);
    try {
      await shareApi.updateStatus(token, { action, provider_name: providerName || undefined, notes: notes || undefined });
      setActionDone(action);
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
      <div className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page">
        <Loader2 className="h-8 w-8 animate-spin text-text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="safe-top safe-bottom flex min-h-screen flex-col items-center justify-center gap-4 bg-bg-page p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-danger">
          <XCircle className="h-8 w-8 text-text-danger" />
        </div>
        <div>
          <h1 className="text-xl font-medium text-text-primary">Link invalido</h1>
          <p className="mt-1 max-w-xs text-sm text-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  const { service, property, link, credentials } = data!;
  const checklist = Array.isArray(service.checklist) ? service.checklist as { item: string; done: boolean }[] : [];

  const alreadyAccepted = !!link.provider_accepted_at;
  const alreadyStarted = !!link.provider_started_at;
  const alreadyDone = !!link.provider_done_at;

  return (
    <div className="safe-top safe-bottom min-h-screen bg-bg-page px-4 py-8">
      <div className="tap-highlight-none mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-accent">
            <Building2 className="h-5 w-5 text-text-on-accent" />
          </div>
          <div>
            <p className="text-xs font-medium text-text-tertiary">HouseLog</p>
            <h1 className="text-sm font-medium leading-tight text-text-primary">Ordem de servico compartilhada</h1>
          </div>
        </div>

        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-text-accent" />
            <div>
              <p className="text-sm font-medium text-text-primary">{property.name}</p>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-text-secondary">
                <MapPin className="h-3 w-3" />
                {property.address}, {property.city}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{service.title}</CardTitle>
              <span className={cn('shrink-0', STATUS_COLORS[service.status])}>
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
              <p className="text-sm leading-relaxed text-text-secondary">{service.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {service.scheduled_at && (
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-text-accent" />
                  <span>{formatDate(service.scheduled_at)}</span>
                </div>
              )}
              {service.cost && (
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <DollarSign className="h-3.5 w-3.5 shrink-0 text-text-success" />
                  <span>{formatCurrency(service.cost)}</span>
                </div>
              )}
              {service.warranty_until && (
                <div className="flex items-center gap-1.5 text-text-secondary">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span>Garantia ate {formatDate(service.warranty_until)}</span>
                </div>
              )}
            </div>

            {checklist.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-tertiary">Checklist</p>
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {item.done ? <CheckSquare className="h-4 w-4 shrink-0 text-text-success" /> : <Square className="h-4 w-4 shrink-0 text-text-tertiary" />}
                    <span className={item.done ? 'line-through text-text-secondary' : 'text-text-primary'}>{item.item}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {credentials.length > 0 && (
          <Card className="border-border-warning">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm text-text-warning">
                <KeyRound className="h-4 w-4" />
                Informacoes de acesso
              </CardTitle>
              <p className="text-xs text-text-secondary">
                Compartilhado pelo proprietario para execucao do servico.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {credentials.map((cred, i) => {
                const Icon = CRED_ICONS[cred.category] ?? HelpCircle;
                return (
                  <div key={i} className="rounded-lg border-half border-border-warning bg-bg-warning p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-text-warning" />
                      <span className="text-xs font-medium text-text-warning">
                        {CRED_LABELS[cred.category]} - {cred.label}
                      </span>
                    </div>
                    {cred.username && (
                      <p className="text-xs text-text-secondary">Usuario: <span className="font-mono">{cred.username}</span></p>
                    )}
                    <RevealSecret secret={cred.secret} />
                    {cred.notes && <p className="mt-1 text-xs text-text-tertiary">{cred.notes}</p>}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {(alreadyAccepted || alreadyStarted || alreadyDone) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="h-4 w-4 text-text-accent" />
                Historico do prestador
                {link.provider_name && <span className="text-xs font-normal text-text-secondary">- {link.provider_name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {alreadyAccepted && (
                <div className="flex items-center gap-2 text-xs text-text-success">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Aceito em {formatDate(link.provider_accepted_at!)}
                </div>
              )}
              {alreadyStarted && (
                <div className="flex items-center gap-2 text-xs text-text-warning">
                  <PlayCircle className="h-3.5 w-3.5 shrink-0" />
                  Iniciado em {formatDate(link.provider_started_at!)}
                </div>
              )}
              {alreadyDone && (
                <div className="flex items-center gap-2 text-xs text-text-success">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Concluido em {formatDate(link.provider_done_at!)}
                </div>
              )}
              {link.notes_from_provider && (
                <p className="mt-2 text-xs italic text-text-secondary">
                  &ldquo;{link.notes_from_provider}&rdquo;
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!alreadyDone && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wrench className="h-4 w-4 text-text-accent" />
                {alreadyStarted ? 'Marcar como concluido' : alreadyAccepted ? 'Iniciar execucao' : 'Confirmar recebimento'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!alreadyAccepted && (
                <div className="space-y-1.5">
                  <label htmlFor={providerNameId} className="hl-label">Seu nome (opcional)</label>
                  <input
                    id={providerNameId}
                    type="text"
                    placeholder="Ex.: Joao Silva - Eletrica Rapida"
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="hl-input"
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor={notesId} className="hl-label">Observacao (opcional)</label>
                <textarea
                  id={notesId}
                  rows={2}
                  placeholder="Observacoes sobre o servico..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  aria-describedby={notesHelpId}
                  className="hl-textarea resize-none"
                />
                <p id={notesHelpId} className="hl-hint">Compartilhe um resumo rapido do atendimento.</p>
              </div>

              {actionDone && (
                <div className="flex items-center gap-2 rounded-lg border-half border-border-success bg-bg-success px-3 py-2 text-sm text-text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  {actionDone === 'accept' ? 'Ordem aceita com sucesso!' : actionDone === 'start' ? 'Execucao iniciada!' : 'Ordem marcada como concluida!'}
                </div>
              )}

              <div className="flex gap-2">
                {!alreadyAccepted && (
                  <Button className="flex-1" onClick={() => act('accept')} loading={acting}>
                    <CheckCircle2 className="h-4 w-4" />
                    Aceitar ordem
                  </Button>
                )}
                {alreadyAccepted && !alreadyStarted && (
                  <Button className="flex-1" onClick={() => act('start')} loading={acting}>
                    <PlayCircle className="h-4 w-4" />
                    Iniciar servico
                  </Button>
                )}
                {alreadyStarted && !alreadyDone && (
                  <Button className="flex-1" onClick={() => act('done')} loading={acting}>
                    <CheckCircle2 className="h-4 w-4" />
                    Marcar concluido
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {alreadyDone && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-success">
              <CheckCircle2 className="h-7 w-7 text-text-success" />
            </div>
            <p className="text-sm font-medium text-text-primary">Servico concluido!</p>
            <p className="text-xs text-text-secondary">O proprietario sera notificado para verificacao.</p>
          </div>
        )}

        <p className="pb-4 text-center text-xs text-text-tertiary">
          Link expira em {formatDate(link.expires_at)} - HouseLog
        </p>
      </div>
    </div>
  );
}
