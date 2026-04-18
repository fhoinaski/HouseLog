import { Building2, Clock3, MapPin, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProviderBidDialog } from './ProviderBidDialog';

export type ProviderOpenRequest = {
  id: string;
  title: string;
  problem: string;
  neighborhood: string;
  createdAt?: string;
  urgency?: 'high' | 'medium' | 'low';
};

type ProviderBidFeedProps = {
  requests: ProviderOpenRequest[];
};

function urgencyBadge(urgency: ProviderOpenRequest['urgency']) {
  if (urgency === 'high') return <Badge variant="destructive">Urgente</Badge>;
  if (urgency === 'medium') return <Badge variant="warning">Moderada</Badge>;
  if (urgency === 'low') return <Badge variant="secondary">Baixa</Badge>;
  return <Badge variant="outline">Aberta</Badge>;
}

function formatRelativeDate(value?: string): string {
  if (!value) return 'Recente';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recente';

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Agora';
  if (diffHours < 24) return `Ha ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  return `Ha ${diffDays}d`;
}

export default async function ProviderBidFeed({ requests }: ProviderBidFeedProps) {
  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-500">Painel de Oportunidades</p>
            <h2 className="mt-1 text-xl font-semibold">Solicitacoes Abertas para Prestadores Validados</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Veja os problemas por bairro e envie propostas tecnicas sem exposicao dos dados do cliente.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200/60 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700">
            <Building2 className="h-3.5 w-3.5" />
            {requests.length} oportunidade{requests.length === 1 ? '' : 's'} aberta{requests.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex min-h-44 flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full border border-amber-300/60 bg-amber-50 p-3">
              <TriangleAlert className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-base font-medium">Nenhuma solicitacao aberta no momento</p>
              <p className="text-sm text-muted-foreground">Novas oportunidades aparecerao automaticamente neste painel.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((request) => (
            <Card key={request.id} className="group border-border transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base leading-snug">{request.title}</CardTitle>
                  {urgencyBadge(request.urgency)}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">{request.problem}</p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-primary-500" />
                    Bairro: <strong className="text-foreground">{request.neighborhood}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-primary-500" />
                    {formatRelativeDate(request.createdAt)}
                  </span>
                </div>

                <div className="pt-1">
                  <ProviderBidDialog requestId={request.id} requestTitle={request.title} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
