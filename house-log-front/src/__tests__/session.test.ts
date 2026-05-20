import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setTokenMock } = vi.hoisted(() => ({
  setTokenMock: vi.fn(),
}));

vi.mock('@/lib/api/core/storage', () => ({
  setToken: setTokenMock,
  clearToken: vi.fn(),
}));

describe('session refresh cooldown', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    setTokenMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bloqueia tentativas repetidas de refresh logo após falha', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const session = await import('@/lib/api/core/session');

    const first = await session.refreshAccessToken();
    const second = await session.refreshAccessToken();

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('trata 429 no refresh com cooldown sem criar rajada de novas chamadas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn(),
    });
    vi.stubGlobal('fetch', fetchMock);

    const session = await import('@/lib/api/core/session');

    expect(await session.refreshAccessToken()).toBeNull();
    expect(await session.refreshAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('limpa o cooldown quando uma sessão nova e estabelecida', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: vi.fn() })
      .mockResolvedValueOnce({ ok: true, json: vi.fn(async () => ({ access_token: 'token-novo' })) });
    vi.stubGlobal('fetch', fetchMock);

    const session = await import('@/lib/api/core/session');

    expect(await session.refreshAccessToken()).toBeNull();
    session.clearRefreshCooldown();
    expect(await session.refreshAccessToken()).toBe('token-novo');
    expect(setTokenMock).toHaveBeenCalledWith('token-novo');
  });

  it('redireciona 401 privado para login preservando deep link e query params', async () => {
    const replaceMock = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/properties/property-1',
        search: '?tab=documents',
        replace: replaceMock,
      },
    });

    const session = await import('@/lib/api/core/session');

    session.handleUnauthorized('/properties/property-1');

    expect(replaceMock).toHaveBeenCalledWith('/login?next=%2Fproperties%2Fproperty-1%3Ftab%3Ddocuments');
  });

  it('nao redireciona 401 de rota publica de auth durante bootstrap', async () => {
    const replaceMock = vi.fn();
    vi.stubGlobal('window', {
      location: {
        pathname: '/properties/property-1',
        search: '?tab=documents',
        replace: replaceMock,
      },
    });

    const session = await import('@/lib/api/core/session');

    session.handleUnauthorized('/auth/refresh');

    expect(replaceMock).not.toHaveBeenCalled();
  });
});
