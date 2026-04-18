'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { MessageCircle, Send } from 'lucide-react';
import { messagesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate, cn } from '@/lib/utils';

type ServiceChatProps = {
  serviceOrderId: string;
  title?: string;
};

export function ServiceChat({ serviceOrderId, title = 'Chat da OS' }: ServiceChatProps) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const { data, mutate, isLoading } = useSWR(
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
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-3 space-y-2 bg-muted/30">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
          ) : (
            messages.map((msg) => {
              const mine = msg.author_id === user?.id;
              return (
                <div key={msg.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                      mine ? 'bg-primary-600 text-white' : 'bg-card border border-border'
                    )}
                  >
                    <p className={cn('text-[11px] mb-1', mine ? 'text-primary-100' : 'text-muted-foreground')}>
                      {msg.author_name} · {formatDate(msg.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite sua mensagem"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
          />
          <Button type="button" disabled={!hasContent} loading={sending} onClick={() => void sendMessage()}>
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
