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
});