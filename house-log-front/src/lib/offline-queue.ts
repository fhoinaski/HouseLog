/**
 * Fila offline unificada — isolada por tenantId e userId.
 *
 * Banco IDB  : houselog-oq  (offline queue — separado da fila legada houselog-eq)
 * Object store: items
 * Índice      : byUser — [tenantId, userId] — permite listar itens por contexto de autenticação
 *
 * Tipos suportados:
 *  - 'photo-upload' : metadados + Blob de foto pendente de envio
 *  - 'os-update'    : rascunho de atualização de ordem de serviço (status / notas / prioridade)
 *
 * Regras de segurança:
 *  - tenantId e userId são obrigatórios — NUNCA vêm do body público nem do cliente.
 *  - Token de autenticação NUNCA é armazenado — lido da memória no momento do sync.
 *  - clearByUser() deve ser chamado no logout para não deixar dados do usuário no dispositivo.
 *  - Falha de upload NÃO remove o item — apenas muda status para 'failed'.
 *  - Retry reutiliza o mesmo id UUID — nunca cria duplicata.
 *
 * Backoff: 5 s → 10 s → 20 s → 40 s → 80 s → máx 120 s (± jitter de 10 %).
 */

const DB_NAME = 'houselog-oq';
const STORE_NAME = 'items';
const DB_VERSION = 1;

// ── Tipos ────────────────────────────────────────────────────────────────────

export type OqStatus = 'pending' | 'uploading' | 'failed' | 'synced';
export type OqType = 'photo-upload' | 'os-update';

/**
 * Campos comuns a todos os itens da fila.
 * tenantId + userId garantem isolamento multi-usuário no mesmo dispositivo.
 */
type OqBase = {
  id: string;
  /** Identificador do tenant — obrigatório para isolamento de dados. */
  tenantId: string;
  /** Identificador do usuário — impede que dados de outro usuário sejam sincronizados. */
  userId: string;
  propertyId: string;
  serviceOrderId: string;
  status: OqStatus;
  attempts: number;
  createdAt: string;
  lastAttemptAt?: string;
  errorMessage?: string;
};

/** Item de upload de foto — armazena o Blob completo para reenvio. */
export type OqPhotoItem = OqBase & {
  type: 'photo-upload';
  evidenceType: 'before' | 'after';
  filename: string;
  mimeType: string;
  /** Blob completo da foto — preservado mesmo após falha para evitar perda de dados. */
  file: Blob;
};

/**
 * Rascunho de atualização de OS — salvo quando o usuário edita sem conexão.
 * Somente campos seguros: nunca inclui dados de outros tenants nem credenciais.
 */
export type OqOsUpdateItem = OqBase & {
  type: 'os-update';
  patch: {
    status?: string;
    notes?: string;
    priority?: string;
  };
};

export type OqItem = OqPhotoItem | OqOsUpdateItem;

/**
 * Tipo de entrada para enfileirar — os campos gerenciados pela fila são omitidos.
 * Usa distribuição explícita do union para preservar o discriminante `type`
 * e os campos específicos de cada variante (evidenceType, file, patch, etc.).
 */
export type OqEnqueueInput =
  | Omit<OqPhotoItem, 'id' | 'status' | 'attempts' | 'createdAt'>
  | Omit<OqOsUpdateItem, 'id' | 'status' | 'attempts' | 'createdAt'>;

// ── IDB internals ─────────────────────────────────────────────────────────────

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      // Índice composto para filtrar por tenant+usuário sem varrer todos os itens.
      store.createIndex('byUser', ['tenantId', 'userId'], { unique: false });
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

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Enfileira um novo item.
 * Lança erro se tenantId, userId, propertyId ou serviceOrderId estiverem ausentes —
 * esses campos são obrigatórios para garantir isolamento e rastreabilidade.
 */
export async function enqueue(item: OqEnqueueInput): Promise<OqItem> {
  if (!item.tenantId) throw new Error('tenantId é obrigatório');
  if (!item.userId) throw new Error('userId é obrigatório');
  if (!item.propertyId) throw new Error('propertyId é obrigatório');
  if (!item.serviceOrderId) throw new Error('serviceOrderId é obrigatório');

  const entry = {
    ...item,
    id: crypto.randomUUID(),
    status: 'pending' as const,
    attempts: 0,
    createdAt: new Date().toISOString(),
  } as OqItem;

  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.add(entry);
    req.onsuccess = () => resolve(entry);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Lista todos os itens da fila para o par (tenantId, userId).
 * Não retorna dados de outros tenants ou outros usuários.
 *
 * Implementação: getAll() + filtro em memória — portável em todos os ambientes
 * (inclusive fake-indexeddb em testes). O índice byUser permanece disponível
 * para futuras otimizações com IDBKeyRange em browsers modernos.
 */
export async function getByUser(tenantId: string, userId: string): Promise<OqItem[]> {
  const store = await getStore('readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as OqItem[];
      resolve(all.filter((i) => i.tenantId === tenantId && i.userId === userId));
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retorna apenas os itens com status 'pending' ou 'failed' para o tenant+usuário.
 * Usado pelo sync para determinar o que precisa ser enviado.
 */
export async function getPendingByUser(tenantId: string, userId: string): Promise<OqItem[]> {
  const all = await getByUser(tenantId, userId);
  return all.filter((i) => i.status === 'pending' || i.status === 'failed');
}

/**
 * Atualiza campos de status de um item.
 * Opera numa única transação get→put para consistência.
 */
export async function updateItem(
  id: string,
  patch: Partial<Pick<OqItem, 'status' | 'attempts' | 'errorMessage' | 'lastAttemptAt'>>
): Promise<void> {
  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as OqItem | undefined;
      if (!item) { resolve(); return; }
      const updated = { ...item, ...patch } as OqItem;
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Remove itens com status 'synced' do tenant+usuário.
 * Chamado após cada ciclo de sync para liberar espaço.
 */
export async function clearSyncedByUser(tenantId: string, userId: string): Promise<void> {
  const synced = (await getByUser(tenantId, userId)).filter((i) => i.status === 'synced');
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

/**
 * Remove TODOS os itens do tenant+usuário.
 * Deve ser chamado no logout para não deixar dados no dispositivo.
 */
export async function clearByUser(tenantId: string, userId: string): Promise<void> {
  const all = await getByUser(tenantId, userId);
  if (all.length === 0) return;
  const store = await getStore('readwrite');
  await Promise.all(
    all.map(
      (item) =>
        new Promise<void>((resolve, reject) => {
          const req = store.delete(item.id);
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        })
    )
  );
}

/**
 * Calcula o delay em ms antes do próximo retry.
 * Backoff exponencial com base 5 s, máximo 120 s e jitter de ±10 %.
 *
 * attempts=0 → ~5 s
 * attempts=1 → ~10 s
 * attempts=2 → ~20 s
 * attempts=3 → ~40 s
 * attempts=4+ → ~80–120 s
 */
export function getNextRetryDelay(attempts: number): number {
  const base = Math.min(5_000 * Math.pow(2, attempts), 120_000);
  const jitter = base * 0.1 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

/**
 * Remove TODOS os itens da fila, independente de tenant ou usuário.
 *
 * ⚠️ Usar apenas como fallback de logout quando o tenantId não está disponível.
 * Prefira clearByUser(tenantId, userId) quando ambos os valores forem conhecidos.
 */
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
 * Uso EXCLUSIVO em testes — garante isolamento entre casos de teste.
 */
export function _resetDb(): void {
  _db = null;
}
