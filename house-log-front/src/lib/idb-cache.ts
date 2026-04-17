const DB_NAME = 'houselog-cache';
const STORE_NAME = 'swr';
const DB_VERSION = 1;

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet(key: string): Promise<unknown> {
  const store = await getStore('readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbDelete(key: string): Promise<void> {
  const store = await getStore('readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  const database = await openDB();
  return database.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

// SWR cache provider factory — returns a SWR-compatible cache provider
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createIDBCacheProvider(): (cache: Map<string, any>) => Map<string, any> {
  // Keys to persist offline (inventory + maintenance)
  const PERSIST_PREFIXES = ['inventory', 'maintenance'];

  function shouldPersist(key: string): boolean {
    if (typeof key !== 'string') return false;
    return PERSIST_PREFIXES.some((p) => key.startsWith(p));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (baseCache: Map<string, any>) => {
    // Hydrate persisted keys from IndexedDB into the SWR map at startup
    if (typeof indexedDB !== 'undefined') {
      openDB()
        .then(() => {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onsuccess = () => {
            const database = req.result;
            const tx = database.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const cursor = store.openCursor();
            cursor.onsuccess = () => {
              const c = cursor.result;
              if (c) {
                if (!baseCache.has(c.key as string)) {
                  baseCache.set(c.key as string, c.value);
                }
                c.continue();
              }
            };
          };
        })
        .catch(() => { /* IndexedDB not available */ });
    }

    return new Proxy(baseCache, {
      get(target, prop: string | symbol) {
        if (prop === 'set') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (key: string, value: any) => {
            target.set(key, value);
            if (shouldPersist(key)) {
              idbSet(key, value).catch(() => {});
            }
          };
        }
        if (prop === 'delete') {
          return (key: string) => {
            target.delete(key);
            if (shouldPersist(key)) {
              idbDelete(key).catch(() => {});
            }
          };
        }
        const val = target[prop as keyof typeof target];
        return typeof val === 'function' ? val.bind(target) : val;
      },
    });
  };
}
