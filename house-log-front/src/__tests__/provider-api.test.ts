import { beforeEach, describe, expect, it, vi } from 'vitest';
import { providerApi } from '../lib/api/provider';
import { clearToken, setToken } from '../lib/api/core/storage';

describe('providerApi.uploadEvidence', () => {
  beforeEach(() => {
    clearToken();
    vi.unstubAllGlobals();
  });

  it('chama a rota provider de evidencias com Authorization', async () => {
    setToken('token-provider');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/api/v1/provider/services/os-1/media/prop-a%2Fphotos%2Fevidence.jpg', type: 'after' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await providerApi.uploadEvidence(
      'os-1',
      new File(['fake'], 'evidence.jpg', { type: 'image/jpeg' })
    );

    expect(result.url).toBe('/api/v1/provider/services/os-1/media/prop-a%2Fphotos%2Fevidence.jpg');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/provider/services/os-1/photos');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-provider');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('propaga erro claro quando backend rejeita o upload', async () => {
    setToken('token-provider');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Esta OS ainda nao permite envio de evidencias' } }),
    }));

    await expect(providerApi.uploadEvidence(
      'os-1',
      new File(['fake'], 'evidence.jpg', { type: 'image/jpeg' })
    )).rejects.toThrow('Esta OS ainda nao permite envio de evidencias');
  });
});
