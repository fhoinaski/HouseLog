'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { MessageCircle, Send, WifiOff } from 'lucide-react';
import { messagesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { chatBubbleVariants, chatPanelVariants } from '@/components/ui/visual-system';
import { formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';

type ServiceChatProps = {
  serviceOrderId: string;
  title?: string;
};

export function ServiceChat({ serviceOrderId, title = 'Chat da OS' }: ServiceChatProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Ao receber 403 ou 404 o canal de mensagens desativa completamente —
  // o usuário não é participante desta OS e revalidar não vai mudar isso.
  // Precisa de useState (não useRef) para forçar re-render e mudar a key do SWR para null,
  // desligando o refreshInterval na próxima tick.
  const [forbidden, setForbidden] = useState(false);

  const { data, mutate, isLoading, error } = useSWR(
    forbidden ? null : ['service-messages', serviceOrderId],
    () => messagesApi.list(serviceOrderId),
    {
      refreshInterval: 6000,
      onErrorRetry(err, _key, _config, revalidate, { retryCount }) {
        const status = (err as { status?: number })?.status;
        // Erros definitivos — desativa o SWR inteiro via key = null
        if (status === 403 || status === 404) {
          setForbidden(true);
          return;
        }
        // Demais erros: até 3 tentativas com backoff
        if (retryCount >= 3) return;
        setTimeout(() => revalidate({ retryCount }), Math.min(1_000 * 2 ** retryCount, 30_000));
      },
    }
  );

  const messages = data?.data ?? [];

  const hasContent = useMemo(() => text.trim().length > 0, [text]);
  const composerDisabled = forbidden || sending;

  async function sendMessage() {
    const body = text.trim();
    if (!body || composerDisabled) return;

    setSending(true);
    try {
      await messagesApi.create(serviceOrderId, { body });
      setText('');
      await mutate();
    } catch (e) {
      toast.error('Erro ao enviar mensagem', { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  }

  const composerLabelId = `chat-label-${serviceOrderId}`;

  return (
    <Card variant="section" density="editorial" className="overflow-hidden">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-bg-accent-subtle text-text-accent">
            <MessageCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base leading-tight">{title}</CardTitle>
            <CardDescription className="mt-1 leading-6">
              Canal privado para alinhar escopo, evidencias e proximos passos da OS.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={chatPanelVariants()}>
          {isLoading ? (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4 text-sm leading-6 text-text-secondary">
              Carregando mensagens...
            </div>
          ) : forbidden ? (
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4 text-sm leading-6 text-text-secondary">
              <WifiOff className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
              Canal de mensagens indisponível para este perfil.
            </div>
          ) : error ? (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4 text-sm leading-6 text-text-secondary">
              Nao foi possivel carregar as mensagens agora.
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] bg-[var(--surface-base)] p-4 text-sm leading-6 text-text-secondary">
              Nenhuma mensagem ainda. Use este espaco para alinhar escopo, evidencias e proximos passos da OS.
            </div>
          ) : (
            messages.map((msg) => {
              const mine = msg.author_id === user?.id;
              return (
                <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={chatBubbleVariants({ mine })}>
                    <p className={cn('mb-1 text-[11px] font-medium', mine ? 'opacity-75' : 'text-text-tertiary')}>
                      {msg.author_name} - {formatDate(msg.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer — padding inferior garante visibilidade acima do teclado virtual em mobile */}
        <div className="space-y-2 pb-[env(safe-area-inset-bottom,0px)]">
          <label id={composerLabelId} className="sr-only">
            Mensagem privada
          </label>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite sua mensagem privada"
              rows={2}
              className="min-h-16"
              aria-labelledby={composerLabelId}
              aria-disabled={composerDisabled}
              disabled={composerDisabled}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <Button
              type="button"
              disabled={!hasContent || composerDisabled}
              loading={sending}
              onClick={() => void sendMessage()}
              className="w-full self-end sm:w-auto"
              aria-label={sending ? 'Enviando mensagem...' : 'Enviar mensagem'}
            >
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
