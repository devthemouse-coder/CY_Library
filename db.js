const DB_NAME = 'bcy-library';
const DB_VERSION = 3;
const STORE_BOOKS = 'books';

function generateGuid() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }

  // fallback (RFC4122 v4 형태에 가깝게)
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        const store = db.createObjectStore(STORE_BOOKS, {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('authors', 'authors', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('finishedAt', 'finishedAt', { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('guid', 'guid', { unique: false });
      } else {
        const tx = request.transaction;
        const store = tx.objectStore(STORE_BOOKS);
        if (!store.indexNames.contains('category')) {
          store.createIndex('category', 'category', { unique: false });
        }
        if (!store.indexNames.contains('guid')) {
          // 기존 데이터에 guid가 없을 수 있어 unique로 걸면 업그레이드가 깨질 수 있음
          store.createIndex('guid', 'guid', { unique: false });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * @template T
 * @param {(store: IDBObjectStore) => IDBRequest<T>} fn
 * @param {'readonly'|'readwrite'} mode
 * @returns {Promise<T>}
 */
async function withStore(fn, mode) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, mode);
    const store = tx.objectStore(STORE_BOOKS);
    const request = fn(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * @param {{category?: string, title: string, authors?: string, finishedAt?: string, note?: string}} input
 * @returns {Promise<number>} id
 */
export async function addBook(input) {
  const now = new Date().toISOString();
  const record = {
    guid: generateGuid(),
    category: input.category || 'kr',
    title: input.title.trim(),
    authors: (input.authors || '').trim(),
    finishedAt: input.finishedAt || '',
    note: (input.note || '').trim(),
    source: 'manual',
    sourceId: '',
    createdAt: now,
    updatedAt: now
  };

  return withStore((store) => store.add(record), 'readwrite');
}

/**
 * @param {number} id
 * @returns {Promise<any | undefined>}
 */
export async function getBook(id) {
  return withStore((store) => store.get(id), 'readonly');
}

/**
 * @param {number} id
 * @param {{category?: string, title: string, authors?: string, finishedAt?: string, note?: string}} patch
 * @returns {Promise<void>}
 */
export async function updateBook(id, patch) {
  const existing = await getBook(id);
  if (!existing) return;

  const updated = {
    ...existing,
    guid: existing.guid || generateGuid(),
    category: patch.category || existing.category || 'kr',
    title: patch.title.trim(),
    authors: (patch.authors || '').trim(),
    finishedAt: patch.finishedAt || '',
    note: (patch.note || '').trim(),
    updatedAt: new Date().toISOString()
  };

  await withStore((store) => store.put(updated), 'readwrite');
}

/**
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteBook(id) {
  await withStore((store) => store.delete(id), 'readwrite');
}

/**
 * @returns {Promise<any[]>}
 */
export async function listBooks() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readonly');
    const store = tx.objectStore(STORE_BOOKS);
    const index = store.index('updatedAt');

    /** @type {any[]} */
    const results = [];

    // updatedAt 기준 내림차순 스캔
    const req = index.openCursor(null, 'prev');

    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * 내보내기/가져오기용 upsert.
 * - id가 있으면 해당 id로 덮어쓰기(없으면 자동 생성)
 * - 기존 스키마와 호환되는 필드만 저장
 * @param {any} raw
 * @returns {Promise<number>} id
 */
export async function upsertImportedBook(raw) {
  const now = new Date().toISOString();
  const title = String(raw?.title || '').trim();
  if (!title) throw new Error('INVALID_BOOK');

  const id = Number.isFinite(raw?.id) ? Number(raw.id) : undefined;
  const record = {
    ...(id ? { id } : {}),
    guid: typeof raw?.guid === 'string' && raw.guid.trim() ? raw.guid.trim() : generateGuid(),
    category: String(raw?.category || 'kr') || 'kr',
    title,
    authors: String(raw?.authors || '').trim(),
    finishedAt: String(raw?.finishedAt || '').trim(),
    note: String(raw?.note || '').trim(),
    source: String(raw?.source || 'manual'),
    sourceId: String(raw?.sourceId || ''),
    createdAt: String(raw?.createdAt || now),
    updatedAt: now
  };

  // keyPath+autoIncrement에서도 put(record with id)로 id 보존 가능
  return withStore((store) => store.put(record), 'readwrite');
}

/**
 * 가져오기(추가만) 전용 insert.
 * - 기존 데이터는 절대 덮어쓰지 않음
 * - 백업의 id는 무시하고 새 id로 추가
 * @param {any} raw
 * @returns {Promise<number>} id
 */
export async function insertImportedBook(raw) {
  const now = new Date().toISOString();
  const title = String(raw?.title || '').trim();
  if (!title) throw new Error('INVALID_BOOK');

  const record = {
    guid: typeof raw?.guid === 'string' && raw.guid.trim() ? raw.guid.trim() : generateGuid(),
    category: String(raw?.category || 'kr') || 'kr',
    title,
    authors: String(raw?.authors || '').trim(),
    finishedAt: String(raw?.finishedAt || '').trim(),
    note: String(raw?.note || '').trim(),
    source: String(raw?.source || 'manual'),
    sourceId: String(raw?.sourceId || ''),
    createdAt: String(raw?.createdAt || now),
    updatedAt: now
  };

  return withStore((store) => store.add(record), 'readwrite');
}

/**
 * guid로 기존 책이 있는지 확인
 * @param {string} guid
 * @returns {Promise<boolean>}
 */
export async function hasBookGuid(guid) {
  const g = String(guid || '').trim();
  if (!g) return false;

  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_BOOKS, 'readonly');
    const store = tx.objectStore(STORE_BOOKS);
    const index = store.index('guid');
    const req = index.openCursor(IDBKeyRange.only(g));

    req.onsuccess = () => {
      const cursor = req.result;
      resolve(Boolean(cursor));
    };
    req.onerror = () => resolve(false);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      resolve(false);
    };
  });
}

/**
 * 기존 데이터에 guid가 없는 경우 채움
 * @returns {Promise<number>} 변경된 레코드 수
 */
export async function ensureBookGuids() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readwrite');
    const store = tx.objectStore(STORE_BOOKS);
    const req = store.openCursor();

    let updatedCount = 0;

    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;

      const value = cursor.value;
      const guid = typeof value?.guid === 'string' ? value.guid.trim() : '';
      if (!guid) {
        value.guid = generateGuid();
        value.updatedAt = new Date().toISOString();
        updatedCount += 1;
        cursor.update(value);
      }

      cursor.continue();
    };

    req.onerror = () => reject(req.error);
    tx.oncomplete = () => {
      db.close();
      resolve(updatedCount);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
