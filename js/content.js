// İçerik yükleyici: content/index.json ve paket dosyaları
const cache = new Map();

async function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then((r) => {
      if (!r.ok) throw new Error('İçerik yüklenemedi: ' + path);
      return r.json();
    }).catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}

export const loadIndex = () => getJSON('./content/index.json');

export async function loadVocabTopic(id) {
  const idx = await loadIndex();
  const meta = idx.vocab.find((t) => t.id === id);
  if (!meta) throw new Error('Konu bulunamadı: ' + id);
  const data = await getJSON('./content/' + meta.file);
  return { ...meta, ...data };
}

export async function loadAllVocab() {
  const idx = await loadIndex();
  return Promise.all(idx.vocab.map((t) => loadVocabTopic(t.id)));
}

export async function loadGrammar(id) {
  const idx = await loadIndex();
  const meta = idx.grammar.find((g) => g.id === id);
  if (!meta) throw new Error('Ders bulunamadı: ' + id);
  return { ...meta, ...(await getJSON('./content/' + meta.file)) };
}

// ---------- Aşama 2+ içerikleri ----------
// kind: reading | listening | writing | speaking | placement
export async function listItems(kind) {
  const idx = await loadIndex();
  return idx[kind] || [];
}
export async function loadItem(kind, id) {
  const idx = await loadIndex();
  const meta = (idx[kind] || []).find((x) => x.id === id);
  if (!meta) throw new Error('İçerik bulunamadı: ' + id);
  return { ...meta, ...(await getJSON('./content/' + meta.file)) };
}
export async function loadAll(kind) {
  const list = await listItems(kind);
  return Promise.all(list.map((m) => loadItem(kind, m.id)));
}
