import type { ComponentType } from 'react';
import { AlertCircle, Clock3, Loader2, ShieldOff } from 'lucide-react';

type PublicHandoverStateProps = {
  state: 'loading' | 'invalid' | 'expired' | 'revoked' | 'error';
  message?: string;
};

const STATE_COPY: Record<PublicHandoverStateProps['state'], {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  toneClassName: string;
}> = {
  loading: {
    title: 'Abrindo entrega digital',
    description: 'Estamos verificando a chave do pacote.',
    icon: Loader2,
    toneClassName: 'bg-bg-accent-subtle text-text-accent',
  },
  invalid: {
    title: 'Link invalido',
    description: 'Nao encontramos um pacote ativo para esta chave.',
    icon: AlertCircle,
    toneClassName: 'bg-bg-danger text-text-danger',
  },
  expired: {
    title: 'Link expirado',
    description: 'A validade desta entrega digital terminou. Solicite uma nova chave ao responsavel.',
    icon: Clock3,
    toneClassName: 'bg-bg-warning text-text-warning',
  },
  revoked: {
    title: 'Pacote revogado',
    description: 'Esta chave foi cancelada pelo responsavel pela entrega.',
    icon: ShieldOff,
    toneClassName: 'bg-bg-danger text-text-danger',
  },
  error: {
    title: 'Nao foi possivel abrir o pacote',
    description: 'Tente novamente em alguns instantes.',
    icon: AlertCircle,
    toneClassName: 'bg-bg-warning text-text-warning',
  },
};

export function PublicHandoverState({ state, message }: PublicHandoverStateProps) {
  const copy = STATE_COPY[state];
  const Icon = copy.icon;

  return (
    <main className="safe-top safe-bottom flex min-h-screen items-center justify-center bg-bg-page px-4 py-8">
      <div className="max-w-sm text-center">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] ${copy.toneClassName}`}>
          <Icon className={`h-8 w-8 ${state === 'loading' ? 'animate-spin' : ''}`} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-text-primary">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">{message || copy.description}</p>
        <p className="mt-6 text-xs leading-5 text-text-tertiary">
          HouseLog protege a entrega digital do imovel com chave temporaria e escopo limitado.
        </p>
      </div>
    </main>
  );
}
