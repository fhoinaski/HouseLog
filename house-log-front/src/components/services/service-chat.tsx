'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { MessageCircle, Send } from 'lucide-react';
import { messagesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
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

  const { data, mutate, isLoading, error } = useSWR(
    ['service-messages', serviceOrderId],
    () => messagesApi.list(serviceOrderId),
    { refreshInterval: 6000 }
  );

  const messages = data?.data ?? [];

  const hasContent = useMemo(() => text.trim().length > 0, [text]);

  async function sendMessage() {
    const body = text.trim();
    if (!body) return;

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

  return (
    <Card className="overflow-hidden rounded-md bg-[var(--provider-surface)]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[22rem] min-h-48 space-y-3 overflow-y-auto rounded-md bg-[var(--provider-surface-strong)] p-3">
          {isLoading ? (
            <div className="rounded-md bg-[var(--provider-surface)] p-3 text-sm text-text-secondary">
              Carregando mensagens...
            </div>
          ) : error ? (
            <div className="rounded-md bg-[var(--provider-surface)] p-3 text-sm text-text-secondary">
              Não foi possível carregar as mensagens agora.
            </div>
          ) : messages.length === 0 ? (
            <div className="rounded-md bg-[var(--provider-surface)] p-3 text-sm leading-6 text-text-secondary">
              Nenhuma mensagem ainda. Use este espaço para alinhar escopo, evidências e próximos passos da OS.
            </div>
          ) : (
            messages.map((msg) => {
              const mine = msg.author_id === user?.id;
              return (
                <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[88%] rounded-md px-3 py-2 text-sm leading-6 shadow-none',
                      mine
                        ? 'bg-[var(--interactive-primary-bg)] text-[var(--interactive-primary-text)]'
                        : 'bg-[var(--provider-surface)] text-text-primary'
                    )}
                  >
                    <p className={cn('mb-1 text-[11px]', mine ? 'opacity-75' : 'text-text-tertiary')}>
                      {msg.author_name} · {formatDate(msg.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite sua mensagem"
            rows={2}
            className="min-h-14"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <Button type="button" disabled={!hasContent} loading={sending} onClick={() => void sendMessage()} className="w-full sm:w-auto">
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
