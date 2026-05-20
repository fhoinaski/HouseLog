import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PropertyTimelineEvent } from '@/lib/api';

const { useSWRMock } = vi.hoisted(() => ({
  useSWRMock: vi.fn(),
}));

vi.mock('swr', () => ({
  default: useSWRMock,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    propertiesApi: {
      ...actual.propertiesApi,
      timeline: vi.fn(),
    },
  };
});

import { PropertyTimelinePanel } from '@/components/properties/property-timeline-panel';

function event(overrides: Partial<PropertyTimelineEvent>): PropertyTimelineEvent {
  return {
    id: 'event-1',
    type: 'service_order_created',
    at: '2026-05-01T10:00:00.000Z',
    title: 'OS criada',
    description: 'Revisao eletrica',
    entity_type: 'service_order',
    entity_id: 'os-1',
    severity: 'neutral',
    ...overrides,
  };
}

beforeEach(() => {
  useSWRMock.mockReturnValue({
    data: { data: [], next_cursor: null, has_more: false },
    error: null,
    isLoading: false,
    mutate: vi.fn(),
  });
});

describe('PropertyTimelinePanel', () => {
  it('renderiza eventos da timeline tecnica com links internos', () => {
    useSWRMock.mockReturnValue({
      data: {
        data: [
          event({ id: 'event-os', type: 'service_order_completed', title: 'OS concluida', entity_id: 'os-1', severity: 'success' }),
          event({ id: 'event-doc', type: 'document_uploaded', title: 'Documento enviado', description: 'Manual tecnico', entity_type: 'document', entity_id: 'doc-1' }),
          event({ id: 'event-hand', type: 'handover_accepted', title: 'Aceite de handover', description: 'Entrega tecnica', entity_type: 'handover_package', entity_id: 'hand-1', severity: 'success' }),
        ],
        next_cursor: null,
        has_more: false,
      },
      error: null,
      isLoading: false,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertyTimelinePanel propertyId="prop-1" />);

    expect(html).toContain('Timeline tecnica');
    expect(html).toContain('OS concluida');
    expect(html).toContain('Documento enviado');
    expect(html).toContain('Aceite de handover');
    expect(html).toContain('href="/properties/prop-1/services/os-1"');
    expect(html).toContain('href="/properties/prop-1?tab=documents"');
    expect(html).toContain('href="/properties/prop-1?tab=handover"');
  });

  it('mostra empty state quando o imovel nao tem eventos', () => {
    const html = renderToStaticMarkup(<PropertyTimelinePanel propertyId="prop-empty" />);

    expect(html).toContain('Nenhum evento tecnico registrado');
    expect(html).toContain('documentos, OS, evidencias, inventario, garantias e handover');
  });

  it('mostra loading state', () => {
    useSWRMock.mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertyTimelinePanel propertyId="prop-loading" />);

    expect(html).toContain('Carregando timeline tecnica');
  });

  it('mostra erro controlado sem expor payload', () => {
    useSWRMock.mockReturnValue({
      data: undefined,
      error: new Error('boom'),
      isLoading: false,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertyTimelinePanel propertyId="prop-error" />);

    expect(html).toContain('Nao foi possivel carregar a timeline');
    expect(html).toContain('Tentar novamente');
    expect(html).not.toContain('boom');
  });
});
