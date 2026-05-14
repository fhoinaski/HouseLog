/**
 * Testes unitários da fila de evidências offline e da lógica de sincronização.
 *
 * Estratégia:
 * - IndexedDB é polyfillado com fake-indexeddb (implementação completa em memória).
 * - A conexão cacheada do módulo é resetada em beforeEach para isolamento de estado.
 * - fetch é mockado via vi.stubGlobal para simular sucesso e falha de rede.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  _resetDb,
  clearAll,
  enqueue,
  getAll,
  getPending,
  updateItem,
  type EvidenceQueueItem,
} from '../lib/offline-evidence-queue';
import { processPendingUploads } from '../lib/use-offline-sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlob(content = 'foto-mock'): Blob {
  return new Blob([content], { type: 'image/jpeg' });
}

function makeItem(overrides?: Partial<Omit<EvidenceQueueItem, 'id' | 'status' | 'attempts' | 'createdAt'>>) {
  return {
    serviceOrderId: 'so-abc123',
    propertyId: 'prop-xyz',
    type: 'before' as const,
    file: makeBlob(),
    filename: 'foto.jpg',
    mimeType: 'image/jpeg',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup: IDB fresco por teste
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Cria uma nova instância do IDBFactory para isolamento total entre testes.
  (globalThis as unknown as Record<string, unknown>).indexedDB = new IDBFactory();
  // Reseta a conexão cacheada no módulo para que openDB() abra o novo factory.
  _resetDb();
  // Reseta qualquer mock de fetch criado no teste anterior.
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. Enfileirar item — deve criar com status 'pending'
// ---------------------------------------------------------------------------

describe('enqueue', () => {
  it('cria item com status pending e campos corretos', async () => {
    const item = await enqueue(makeItem());

    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(item.serviceOrderId).toBe('so-abc123');
    expect(item.propertyId).toBe('prop-xyz');
    expect(item.type).toBe('before');
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });

  it('persiste o item no IDB — getAll retorna o item enfileirado', async () => {
    await enqueue(makeItem());
    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('pending');
  });

  // 6. propertyId obrigatório
  it('lança erro se propertyId estiver ausente', async () => {
    await expect(enqueue(makeItem({ propertyId: '' }))).rejects.toThrow('propertyId é obrigatório');
  });

  // 6. serviceOrderId obrigatório (cobre requisito de tenantId/propertyId do spec)
  it('lança erro se serviceOrderId estiver ausente', async () => {
    await expect(enqueue(makeItem({ serviceOrderId: '' }))).rejects.toThrow(
      'serviceOrderId é obrigatório'
    );
  });
});

// ---------------------------------------------------------------------------
// 4. getPending — deve retornar apenas pending e failed
// ---------------------------------------------------------------------------

describe('getPending', () => {
  it('retorna itens com status pending e failed, mas não synced ou uploading', async () => {
    const a = await enqueue(makeItem({ filename: 'a.jpg' }));
    const b = await enqueue(makeItem({ filename: 'b.jpg' }));
    const c = await enqueue(makeItem({ filename: 'c.jpg' }));
    const d = await enqueue(makeItem({ filename: 'd.jpg' }));

    await updateItem(a.id, { status: 'synced' });
    await updateItem(b.id, { status: 'uploading' });
    await updateItem(c.id, { status: 'failed' });
    // d permanece pending

    const pending = await getPending();
    const ids = pending.map((i) => i.id);

    expect(ids).not.toContain(a.id); // synced — ignorado
    expect(ids).not.toContain(b.id); // uploading — ignorado
    expect(ids).toContain(c.id);     // failed — deve aparecer
    expect(ids).toContain(d.id);     // pending — deve aparecer
  });
});

// ---------------------------------------------------------------------------
// 5. Logout — clearAll esvazia a fila
// ---------------------------------------------------------------------------

describe('clearAll (logout)', () => {
  it('remove todos os itens da fila ao fazer logout', async () => {
    await enqueue(makeItem({ filename: 'a.jpg' }));
    await enqueue(makeItem({ filename: 'b.jpg' }));

    const before = await getAll();
    expect(before).toHaveLength(2);

    await clearAll();

    const after = await getAll();
    expect(after).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Sync bem-sucedida — marca item como synced e limpa da fila
// ---------------------------------------------------------------------------

describe('processPendingUploads', () => {
  it('faz upload e marca item como synced, removendo-o da fila', async () => {
    await enqueue(makeItem());

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/api/media/foto.jpg', type: 'before' }),
    }));

    await processPendingUploads('token-valido');

    const remaining = await getAll();
    // clearSynced() remove itens synced — fila deve estar vazia
    expect(remaining).toHaveLength(0);
  });

  it('chama o endpoint correto com o token e os campos da evidência', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/api/media/foto.jpg', type: 'after' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await enqueue(makeItem({ type: 'after', serviceOrderId: 'so-999', propertyId: 'prop-888' }));
    await processPendingUploads('meu-token');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/prop-888/services/so-999/photos');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer meu-token');
  });

  // 7. Falha — preserva dados e marca como failed
  it('preserva item na fila com status failed quando o upload falha', async () => {
    await enqueue(makeItem());

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await processPendingUploads('token-valido');

    const all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('failed');
    expect(all[0].attempts).toBe(1);
    expect(all[0].errorMessage).toBeTruthy();
  });

  it('preserva o Blob original mesmo após falha (dados não são perdidos)', async () => {
    const originalBlob = makeBlob('conteudo-original');
    await enqueue(makeItem({ file: originalBlob }));

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await processPendingUploads('token-valido');

    const all = await getAll();
    expect(all).toHaveLength(1);
    // Verifica que o Blob ainda existe e tem o conteúdo original
    const text = await (all[0].file as Blob).text();
    expect(text).toBe('conteudo-original');
  });

  // 8. Retry não duplica
  it('retry não cria duplicata — mantém o mesmo id após falha e reenvio', async () => {
    const item = await enqueue(makeItem());
    const originalId = item.id;

    // Primeira tentativa — falha
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await processPendingUploads('token-valido');

    let all = await getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(originalId); // mesmo id, não foi duplicado
    expect(all[0].status).toBe('failed');
    expect(all[0].attempts).toBe(1);

    // Reseta para sucesso e tenta novamente
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/api/media/foto.jpg', type: 'before' }),
    }));
    await processPendingUploads('token-valido');

    all = await getAll();
    expect(all).toHaveLength(0); // item foi enviado e removido, sem duplicata
  });
});
