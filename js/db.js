// IndexedDB: tüm ilerleme cihazda kalıcı olarak saklanır.
// Mağazalar sonraki aşamalar için şimdiden açıldı (results, mistakes, writings).
const DB_NAME = 'ielts-koc';
const DB_VERSION = 1;
export const STORES = {
  kv: { keyPath: 'key' },            // profil, ayarlar, ders durumu
  cards: { keyPath: 'id' },          // kelime kartlarının SRS durumu
  days: { keyPath: 'date' },         // günlük çalışma özeti
  results: { keyPath: 'id', autoIncrement: true }, // bölüm sonuçları / bandlar (Aşama 2+)
  mistakes: { keyPath: 'id' },       // Hata Defteri (Aşama 2+)
  writings: { keyPath: 'id', autoIncrement: true } // Writing arşivi (Aşama 3)
};

let dbPromise;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const [name, opts] of Object.entries(STORES)) if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, opts);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r ? r.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  get: (s, k) => run(s, 'readonly', (st) => st.get(k)),
  all: (s) => run(s, 'readonly', (st) => st.getAll()),
  put: (s, v) => run(s, 'readwrite', (st) => st.put(v)),
  del: (s, k) => run(s, 'readwrite', (st) => st.delete(k)),
  clear: (s) => run(s, 'readwrite', (st) => st.clear())
};

export async function getKV(key, fallback) {
  const row = await db.get('kv', key);
  return row ? row.value : fallback;
}
export const setKV = (key, value) => db.put('kv', { key, value });

// ---------- Yedekleme ----------
export async function exportAll() {
  const out = { app: 'ielts-koc', schema: DB_VERSION, exportedAt: new Date().toISOString(), data: {} };
  for (const name of Object.keys(STORES)) out.data[name] = await db.all(name);
  return out;
}

export async function importAll(obj) {
  if (!obj || obj.app !== 'ielts-koc' || typeof obj.data !== 'object') throw new Error('Bu dosya bir IELTS Koç yedeği değil.');
  const d = await open();
  const names = Object.keys(STORES);
  await new Promise((resolve, reject) => {
    const t = d.transaction(names, 'readwrite');
    for (const name of names) {
      const st = t.objectStore(name);
      st.clear();
      for (const row of obj.data[name] || []) st.put(row);
    }
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function wipeAll() {
  for (const name of Object.keys(STORES)) await db.clear(name);
}
