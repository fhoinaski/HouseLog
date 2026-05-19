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
  it('renderiza a carteira com imóveis e CTA de detalhe', () => {
    usePaginationMock.mockReturnValue({
      data: [buildProperty({ id: 'property-1' }), buildProperty({ id: 'property-2', name: 'Apartamento Lago', city: 'São Paulo', health_score: 68, owner_name: 'Grupo Atlas' })],
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      loadMore: vi.fn(),
      error: null,
      mutate: vi.fn(),
    });

    const html = renderToStaticMarkup(<PropertiesPage />);

    expect(html).toContain('Carteira técnica');
    expect(html).toContain('Imóveis do cliente em visão operacional');
    expect(html).toContain('Casa Jardim');
    expect(html).toContain('Apartamento Lago');
    expect(html).toContain('Nome, endereço ou cliente');
    expect(html).toContain('Abrir imóvel');
    expect(html).toContain('href="/properties/property-1"');
    expect(html).toContain('sm:grid-cols-2 xl:grid-cols-4');
  });

  it('renderiza empty state quando não há imóveis', () => {
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

    expect(html).toContain('Nenhum imóvel cadastrado');
    expect(html).toContain('Cadastrar imóvel');
    expect(html).toContain('Organização estilo CRM técnico');
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

    expect(html).toContain('Não foi possível carregar os imóveis');
    expect(html).toContain('Tentar novamente');
  });
});