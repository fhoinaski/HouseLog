// Fila de evidências offline para ordens de serviço.
// Permite enfileirar fotos antes/depois quando não há conexão e sincronizar depois.
//
// Regras de segurança:
// - Nunca armazena token, tenantId ou dados sensíveis — somente propertyId e serviceOrderId.
// - Blobs são armazenados no IndexedDB do dispositivo (não sincronizados com o servidor até a sync).
// - clearAll() é chamado no logout para não deixar evidências de outros contextos.

const DB_NAME = 'houselog-eq';
const STORE_NAME = 'items';
const DB_VERSION = 1;

export type EvidenceStatus = 'pending' | 'uploading' | 'failed' | 'synced';

export type EvidenceQueueItem = {
  id: string;
  serviceOrderId: string;
  propertyId: string;
  type: 'before' | 'after';
  file: Blob;
  filename: string;
  mimeType: string;
  status: EvidenceStatus;
  attempts: number;
  createdAt: string;
  errorMessage?: string;
};

// Cached connection — reset via _resetDb() em testes para isolamento.
let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
}

/** Enfileira uma nova evidência. Lança erro se propertyId ou serviceOrderId estiverem ausentes. */
export async function enqueue(
  item: Omit<EvidenceQueueItem, 'id' | 'status' | 'attempts' | 'createdAt'>
): Promise<EvidenceQueueItem> {
  if (!item.propertyId) throw new Error('propertyId é obrigatório');
  if (!item.serviceOrderId) throw new Error('serviceOrderId é obrigatório');

  const entry: EvidenceQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add(entry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

/** Retorna todos os itens da fila. */
export async function getAll(): Promise<EvidenceQueueItem[]> {
  const store = await getStore('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as EvidenceQueueItem[]);
    req.onerror = () => reject(req.error);
  });
}

/** Retorna itens que precisam ser (re)enviados: status pending ou failed. */
export async function getPending(): Promise<EvidenceQueueItem[]> {
  const all = await getAll();
  return all.filter((item) => item.status === 'pending' || item.status === 'failed');
}

/** Atualiza campos de um item existente. Opera num único put transacional. */
export async function updateItem(
  id: string,
  patch: Partial<Pick<EvidenceQueueItem, 'status' | 'attempts' | 'errorMessage'>>
): Promise<void> {
  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as EvidenceQueueItem | undefined;
      if (!item) {
        resolve();
        return;
      }
      const updated: EvidenceQueueItem = { ...item, ...patch };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Remove um item específico da fila. */
export async function removeItem(id: string): Promise<void> {
  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Remove todos os itens com status 'synced'. */
export async function clearSynced(): Promise<void> {
  const all = await getAll();
  const synced = all.filter((item) => item.status === 'synced');
  if (synced.length === 0) return;
  const store = await getStore('readwrite');
  await Promise.all(
    synced.map(
      (item) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(item.id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    )
  );
}

/** Remove todos os itens da fila. Chamado no logout. */
export async function clearAll(): Promise<void> {
  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Reseta a conexão IDB cacheada.
 * Uso exclusivo em testes — garante isolamento entre casos de teste.
 */
export function _resetDb(): void {
  _db = null;
}
