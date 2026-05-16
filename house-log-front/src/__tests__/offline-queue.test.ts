/**
 * Testes unitários da fila offline unificada — offline-queue.ts
 *
 * Cobre os 7 casos obrigatórios do spec:
 *  1. adiciona item à fila
 *  2. lista itens por tenantId/userId
 *  3. não lista item de outro tenant
 *  4. marca item como sincronizado
 *  5. mantém item quando sync falha
 *  6. evita duplicidade básica
 *  7. type-check (verificado pelo compilador TypeScript)
 *
 * Casos extras:
 *  - valida campos obrigatórios (tenantId, userId, propertyId, serviceOrderId)
 *  - salva rascunho de atualização de OS
 *  - clearByUser não apaga itens de outro tenant
 *  - getNextRetryDelay retorna backoff crescente
 *  - processPendingItems: upload bem-sucedido marca synced e limpa fila
 *  - processPendingItems: falha preserva item com status failed
 *  - processPendingItems: retry não duplica (mantém mesmo id)
 *
 * Estratégia:
 *  - IndexedDB polyfillado com fake-indexeddb (implementação completa em memória).
 *  - Conexão cacheada resetada em beforeEach para isolamento total.
 *  - fetch mockado via vi.stubGlobal para simular rede.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  _resetDb,
  clearByUser,
  clearSyncedByUser,
  enqueue,
  getByUser,
  getNextRetryDelay,
  getPendingByUser,
  updateItem,
  type OqItem,
  type OqPhotoItem,
  type OqOsUpdateItem,
} from '../lib/offline-queue';
import { processPendingItems } from '../lib/use-offline-queue-sync';

// ── Helpers ───────────────────────────────────────────────────────────────────

type PhotoInput = Omit<OqPhotoItem, 'id' | 'status' | 'attempts' | 'createdAt'>;
type OsUpdateInput = Omit<OqOsUpdateItem, 'id' | 'status' | 'attempts' | 'createdAt'>;

function makePhoto(overrides?: Partial<PhotoInput>): PhotoInput {
  return {
    type: 'photo-upload',
    tenantId: 'tenant-a',
    userId: 'user-1',
    propertyId: 'prop-1',
    serviceOrderId: 'os-1',
    evidenceType: 'before',
    filename: 'foto.jpg',
    mimeType: 'image/jpeg',
    file: new Blob(['foto-mock'], { type: 'image/jpeg' }),
    ...overrides,
  };
}

function makeOsUpdate(overrides?: Partial<OsUpdateInput>): OsUpdateInput {
  return {
    type: 'os-update',
    tenantId: 'tenant-a',
    userId: 'user-1',
    propertyId: 'prop-1',
    serviceOrderId: 'os-1',
    patch: { status: 'in_progress', notes: 'Iniciando serviço' },
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).indexedDB = new IDBFactory();
  _resetDb();
  vi.unstubAllGlobals();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Adiciona item à fila
// ═══════════════════════════════════════════════════════════════════════════════

describe('1. enqueue — adiciona item à fila', () => {
  it('cria item com status pending, id único e timestamp', async () => {
    const item = await enqueue(makePhoto());

    expect(item.id).toBeTruthy();
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);
    expect(item.createdAt).toBeTruthy();
    expect(item.tenantId).toBe('tenant-a');
    expect(item.userId).toBe('user-1');
  });

  it('persiste foto na fila — getByUser retorna o item', async () => {
    await enqueue(makePhoto());
    const all = await getByUser('tenant-a', 'user-1');
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe('photo-upload');
  });

  it('persiste rascunho de OS na fila — tipo os-update', async () => {
    await enqueue(makeOsUpdate());
    const all = await getByUser('tenant-a', 'user-1');
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe('os-update');
    // Verifica que o patch foi preservado
    const item = all[0] as Extract<OqItem, { type: 'os-update' }>;
    expect(item.patch.status).toBe('in_progress');
    expect(item.patch.notes).toBe('Iniciando serviço');
  });

  it('lança erro se tenantId ausente', async () => {
    await expect(enqueue(makePhoto({ tenantId: '' }))).rejects.toThrow('tenantId é obrigatório');
  });

  it('lança erro se userId ausente', async () => {
    await expect(enqueue(makePhoto({ userId: '' }))).rejects.toThrow('userId é obrigatório');
  });

  it('lança erro se propertyId ausente', async () => {
    await expect(enqueue(makePhoto({ propertyId: '' }))).rejects.toThrow('propertyId é obrigatório');
  });

  it('lança erro se serviceOrderId ausente', async () => {
    await expect(enqueue(makePhoto({ serviceOrderId: '' }))).rejects.toThrow(
      'serviceOrderId é obrigatório'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Lista itens por tenantId/userId
// ═══════════════════════════════════════════════════════════════════════════════

describe('2. getByUser — lista itens por tenantId/userId', () => {
  it('retorna apenas itens do tenant+usuário informado', async () => {
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-1', filename: 'a.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-1', filename: 'b.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-2', filename: 'c.jpg' }));

    const result = await getByUser('tenant-a', 'user-1');
    expect(result).toHaveLength(2);
    const filenames = result.map(
      (i) => (i as Extract<OqItem, { type: 'photo-upload' }>).filename
    );
    expect(filenames).toContain('a.jpg');
    expect(filenames).toContain('b.jpg');
    expect(filenames).not.toContain('c.jpg');
  });

  it('retorna lista vazia se não há itens para o tenant+usuário', async () => {
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-2' }));
    const result = await getByUser('tenant-a', 'user-1');
    expect(result).toHaveLength(0);
  });

  it('getPendingByUser retorna pending e failed, mas não synced ou uploading', async () => {
    const a = await enqueue(makePhoto({ filename: 'a.jpg' }));
    const b = await enqueue(makePhoto({ filename: 'b.jpg' }));
    const c = await enqueue(makePhoto({ filename: 'c.jpg' }));
    const d = await enqueue(makePhoto({ filename: 'd.jpg' }));

    await updateItem(a.id, { status: 'synced' });
    await updateItem(b.id, { status: 'uploading' });
    await updateItem(c.id, { status: 'failed' });
    // d permanece pending

    const pending = await getPendingByUser('tenant-a', 'user-1');
    const ids = pending.map((i) => i.id);

    expect(ids).not.toContain(a.id); // synced — ignorado
    expect(ids).not.toContain(b.id); // uploading — ignorado
    expect(ids).toContain(c.id);     // failed — deve aparecer
    expect(ids).toContain(d.id);     // pending — deve aparecer
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Não lista item de outro tenant
// ═══════════════════════════════════════════════════════════════════════════════

describe('3. Isolamento de tenant — não lista item de outro tenant', () => {
  it('tenant-a não vê itens do tenant-b', async () => {
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-x', filename: 'secreto.jpg' }));

    const result = await getByUser('tenant-a', 'user-1');
    expect(result).toHaveLength(0);
  });

  it('mesmo userId em tenants diferentes são isolados', async () => {
    // user-1 no tenant-a e user-1 no tenant-b — não podem ver dados um do outro
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-1', filename: 'tenant-a.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-1', filename: 'tenant-b.jpg' }));

    const resultA = await getByUser('tenant-a', 'user-1');
    const resultB = await getByUser('tenant-b', 'user-1');

    expect(resultA).toHaveLength(1);
    expect(resultB).toHaveLength(1);
    expect(
      (resultA[0] as Extract<OqItem, { type: 'photo-upload' }>).filename
    ).toBe('tenant-a.jpg');
    expect(
      (resultB[0] as Extract<OqItem, { type: 'photo-upload' }>).filename
    ).toBe('tenant-b.jpg');
  });

  it('clearByUser remove apenas itens do tenant+usuário, não de outros', async () => {
    await enqueue(makePhoto({ tenantId: 'tenant-a', userId: 'user-1', filename: 'minha.jpg' }));
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-2', filename: 'outra.jpg' }));

    await clearByUser('tenant-a', 'user-1');

    const afterA = await getByUser('tenant-a', 'user-1');
    const afterB = await getByUser('tenant-b', 'user-2');

    expect(afterA).toHaveLength(0); // limpo
    expect(afterB).toHaveLength(1); // intacto
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Marca item como sincronizado
// ═══════════════════════════════════════════════════════════════════════════════

describe('4. Marca item como sincronizado', () => {
  it('updateItem muda status para synced', async () => {
    const item = await enqueue(makePhoto());
    await updateItem(item.id, { status: 'synced' });

    const all = await getByUser('tenant-a', 'user-1');
    expect(all[0].status).toBe('synced');
  });

  it('clearSyncedByUser remove apenas itens synced do tenant+usuário', async () => {
    const a = await enqueue(makePhoto({ filename: 'a.jpg' }));
    const b = await enqueue(makePhoto({ filename: 'b.jpg' }));

    await updateItem(a.id, { status: 'synced' });
    // b permanece pending

    await clearSyncedByUser('tenant-a', 'user-1');

    const remaining = await getByUser('tenant-a', 'user-1');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
    expect(remaining[0].status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Mantém item quando sync falha
// ═══════════════════════════════════════════════════════════════════════════════

describe('5. Mantém item quando sync falha', () => {
  it('preserva item com status failed e incrementa attempts após falha de rede', async () => {
    await enqueue(makePhoto());

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    const all = await getByUser('tenant-a', 'user-1');
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('failed');
    expect(all[0].attempts).toBe(1);
    expect(all[0].errorMessage).toBeTruthy();
  });

  it('preserva o Blob original mesmo após falha (dados não são perdidos)', async () => {
    const originalBlob = new Blob(['conteudo-original'], { type: 'image/jpeg' });
    await enqueue(makePhoto({ file: originalBlob }));

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    const all = await getByUser('tenant-a', 'user-1');
    expect(all).toHaveLength(1);
    const savedBlob = (all[0] as Extract<OqItem, { type: 'photo-upload' }>).file;
    const text = await savedBlob.text();
    expect(text).toBe('conteudo-original');
  });

  it('preserva rascunho de OS quando sync falha', async () => {
    await enqueue(makeOsUpdate({ patch: { status: 'in_progress', notes: 'Rascunho' } }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: 'Indisponível' }) })
    );

    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    const all = await getByUser('tenant-a', 'user-1');
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('failed');
    const saved = all[0] as Extract<OqItem, { type: 'os-update' }>;
    expect(saved.patch.notes).toBe('Rascunho');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Evita duplicidade básica (retry não duplica)
// ═══════════════════════════════════════════════════════════════════════════════

describe('6. Evita duplicidade básica', () => {
  it('retry mantém o mesmo id após falha — não cria novo item', async () => {
    const item = await enqueue(makePhoto());
    const originalId = item.id;

    // 1ª tentativa: falha
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    let all = await getByUser('tenant-a', 'user-1');
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(originalId); // mesmo id
    expect(all[0].status).toBe('failed');
    expect(all[0].attempts).toBe(1);

    // 2ª tentativa: sucesso
    vi.unstubAllGlobals();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: '/media/foto.jpg' }) })
    );
    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    all = await getByUser('tenant-a', 'user-1');
    expect(all).toHaveLength(0); // removido após sync, sem duplicata
  });

  it('dois enqueues criam ids distintos', async () => {
    const a = await enqueue(makePhoto({ filename: 'a.jpg' }));
    const b = await enqueue(makePhoto({ filename: 'b.jpg' }));
    expect(a.id).not.toBe(b.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Extras — backoff, upload bem-sucedido e isolamento de sync
// ═══════════════════════════════════════════════════════════════════════════════

describe('Extras', () => {
  it('getNextRetryDelay retorna delay crescente conforme attempts aumenta', () => {
    // O jitter pode variar, mas a tendência central deve ser crescente
    const delays = [0, 1, 2, 3, 4].map(getNextRetryDelay);
    // Cada delay base é 2× o anterior — com jitter de ±10 % nunca inverte na prática
    // Verificamos apenas que todos estão dentro do range esperado
    expect(delays[0]).toBeGreaterThanOrEqual(4_500); // ~5s ± 10%
    expect(delays[0]).toBeLessThanOrEqual(5_500);
    expect(delays[1]).toBeGreaterThanOrEqual(9_000); // ~10s ± 10%
    expect(delays[1]).toBeLessThanOrEqual(11_000);
    expect(delays[4]).toBeLessThanOrEqual(120_000); // máximo 120s
  });

  it('processPendingItems: upload bem-sucedido remove item da fila', async () => {
    await enqueue(makePhoto());

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ url: '/media/foto.jpg' }) })
    );

    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    const remaining = await getByUser('tenant-a', 'user-1');
    expect(remaining).toHaveLength(0);
  });

  it('processPendingItems: chama endpoint correto com Authorization e tipo correto', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/media/after.jpg' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await enqueue(
      makePhoto({ evidenceType: 'after', serviceOrderId: 'os-999', propertyId: 'prop-888' })
    );
    await processPendingItems('tenant-a', 'user-1', 'meu-token');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/prop-888/services/os-999/photos');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer meu-token');
  });

  it('processPendingItems não processa itens de outro tenant', async () => {
    await enqueue(makePhoto({ tenantId: 'tenant-b', userId: 'user-2', filename: 'outros.jpg' }));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ url: '/media/foto.jpg' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // Sincroniza apenas tenant-a/user-1
    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    // fetch não deve ter sido chamado — não há itens para tenant-a/user-1
    expect(fetchMock).not.toHaveBeenCalled();

    // Item do tenant-b permanece intacto
    const outros = await getByUser('tenant-b', 'user-2');
    expect(outros).toHaveLength(1);
    expect(outros[0].status).toBe('pending');
  });

  it('processPendingItems: rascunho de OS bem-sucedido é removido da fila', async () => {
    await enqueue(makeOsUpdate({ patch: { status: 'completed', notes: 'Finalizado' } }));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order: {} }) })
    );

    await processPendingItems('tenant-a', 'user-1', 'token-valido');

    const remaining = await getByUser('tenant-a', 'user-1');
    expect(remaining).toHaveLength(0);
  });
});
