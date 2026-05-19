import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Property } from '@/lib/api';

const { usePaginationMock } = vi.hoisted(() => ({
  usePaginationMock: vi.fn(),
}));

const { useSearchParamsMock, useRouterMock } = vi.hoisted(() => ({
  useSearchParamsMock: vi.fn(),
  useRouterMock: vi.fn(),
}));

vi.mock('@/hooks/usePagination', () => ({
  usePagination: usePaginationMock,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: useSearchParamsMock,
  useRouter: useRouterMock,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import PropertiesPage from '@/app/(app)/properties/page';

function buildProperty(overrides: Partial<Property>): Property {
  return {
    id: 'property-1',
    tenant_id: 'tenant-1',
    owner_id: 'owner-1',
    manager_id: null,
    name: 'Casa Jardim',
    type: 'house',
    address: 'Rua das Flores, 123',
    city: 'Curitiba',
    area_m2: 120,
    year_built: 2001,
    structure: 'Alvenaria',
    floors: 2,
    cover_url: null,
    health_score: 92,
    created_at: '2026-05-01T10:00:00.000Z',
    owner_name: 'Marina Lopes',
    ...overrides,
  };
}

beforeEach(() => {
  useSearchParamsMock.mockReturnValue(new URLSearchParams('tab=overview'));
  useRouterMock.mockReturnValue({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() });
  usePaginationMock.mockReturnValue({
    data: [],
    isLoading: false,
    isLoadingMore: false,
    hasMore: false,
    loadMore: vi.fn(),
    error: null,
    mutate: vi.fn(),
  });
});

describe('PropertiesPage', () => {
  it('renderiza a carteira com imoveis e CTA de detalhe', () => {
    usePaginationMock.mockReturnValue({
      data: [
        buildProperty({ id: 'property-1' }),
        buildProperty({ id: 'property-2', name: 'Apartamento Lago', city: 'Sao Paulo', health_score: 68, owner_name: 'Grupo Atlas' }),
      ],
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      loadMore: vi.fn(),
      error: null,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertiesPage />);

    expect(html).toContain('Carteira tecnica');
    expect(html).toContain('Imoveis');
    expect(html).toContain('Casa Jardim');
    expect(html).toContain('Apartamento Lago');
    expect(html).toContain('Nome, endereco ou cliente');
    expect(html).toContain('Abrir prontuario');
    expect(html).toContain('aria-label="Abrir imovel Casa Jardim"');
    expect(html).toContain('href="/properties/property-1"');
    expect(html).toContain('lg:grid-cols-2');
  });

  it('renderiza card com dados minimos e placeholder de iniciais', () => {
    usePaginationMock.mockReturnValue({
      data: [
        buildProperty({
          id: 'property-min',
          name: 'Loft',
          address: 'Rua A',
          city: 'Sao Paulo',
          area_m2: null,
          year_built: null,
          structure: null,
          owner_name: undefined,
          cover_url: null,
        }),
      ],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      loadMore: vi.fn(),
      error: null,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertiesPage />);

    expect(html).toContain('Loft');
    expect(html).toContain('Nao informado');
    expect(html).toContain('Nao informada');
    expect(html).toContain('Perfil tecnico');
    expect(html).toContain('>L</span>');
  });

  it('renderiza empty state quando nao ha imoveis', () => {
    usePaginationMock.mockReturnValue({
      data: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      loadMore: vi.fn(),
      error: null,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertiesPage />);

    expect(html).toContain('Nenhum imovel cadastrado');
    expect(html).toContain('Cadastrar imovel');
    expect(html).toContain('prontuarios tecnicos');
  });

  it('renderiza estado de erro com retry', () => {
    usePaginationMock.mockReturnValue({
      data: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: false,
      loadMore: vi.fn(),
      error: new Error('boom'),
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertiesPage />);

    expect(html).toContain('Nao foi possivel carregar os imoveis');
    expect(html).toContain('Tentar novamente');
  });
});
