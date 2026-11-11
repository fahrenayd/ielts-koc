// Metinde vurgulama ve not alma (bilgisayarlı IELTS'teki gibi)
// Vurgular paragraf içindeki karakter aralıkları olarak saklanır: { s, e, note }
import { h, toast } from './util.js';

export function createHighlighter() {
  const store = new Map();          // "pasaj:paragraf" → [{ s, e, note }]
  let pending = null;               // seçili metin: { key, s, e }
  let active = null;                // dokunulan vurgu: { key, i }
  let root = null;

  const bar = h('div', { class: 'hl-bar hidden', role: 'toolbar', 'aria-label': 'Vurgulama araçları' });
  // Butona basınca seçim kaybolmasın
  bar.addEventListener('pointerdown', (e) => e.preventDefault());
  bar.addEventListener('mousedown', (e) => e.preventDefault());

  const list = (key) => { if (!store.has(key)) store.set(key, []); return store.get(key); };
  const total = () => [...store.values()].reduce((a, l) => a + l.length, 0);

  function offsetIn(container, node, offset) {
    const r = document.createRange();
    r.selectNodeContents(container);
    r.setEnd(node, offset);
    return r.toString().length;
  }

  // Paragraf metnini vurgularla birlikte çiz
  function paint(span) {
    const key = span.dataset.key;
    const text = span.dataset.text;
    const hls = list(key).slice().sort((a, b) => a.s - b.s);
    const kids = [];
    let pos = 0;
    hls.forEach((x) => {
      if (x.s > pos) kids.push(document.createTextNode(text.slice(pos, x.s)));
      const i = list(key).indexOf(x);
      kids.push(h('mark', { class: 'hl' + (x.note ? ' has-note' : ''), 'data-i': i, title: x.note || '' }, text.slice(x.s, x.e)));
      pos = x.e;
    });
    if (pos < text.length) kids.push(document.createTextNode(text.slice(pos)));
    span.replaceChildren(...kids);
  }

  function paragraph(passageIdx, paraIdx, text) {
    const span = h('span', { class: 'ptext', 'data-key': `${passageIdx}:${paraIdx}`, 'data-text': text });
    paint(span);
    return span;
  }

  function spanFor(key) { return root && root.querySelector(`.ptext[data-key="${key}"]`); }

  function add(note) {
    if (!pending) return;
    const { key, s, e } = pending;
    const l = list(key);
    // Çakışan vurguları birleştir
    let ns = s, ne = e, notes = note ? [note] : [];
    for (let i = l.length - 1; i >= 0; i--) {
      const x = l[i];
      if (x.e >= ns && x.s <= ne) { ns = Math.min(ns, x.s); ne = Math.max(ne, x.e); if (x.note) notes.unshift(x.note); l.splice(i, 1); }
    }
    l.push({ s: ns, e: ne, note: notes.join(' · ') });
    window.getSelection().removeAllRanges();
    pending = null;
    paint(spanFor(key));
    hide();
  }

  function remove() {
    if (!active) return;
    list(active.key).splice(active.i, 1);
    paint(spanFor(active.key));
    active = null;
    hide();
  }

  async function editNote() {
    if (!active) return;
    const x = list(active.key)[active.i];
    const v = await noteDialog(x.note || '');
    if (v === null) return;
    x.note = v.trim();
    paint(spanFor(active.key));
    showActive(active.key, active.i);
  }

  function hide() { bar.classList.add('hidden'); }

  function showPending() {
    active = null;
    bar.replaceChildren(
      h('button', { type: 'button', class: 'hl-btn', onclick: () => add('') }, '🖍 Vurgula'),
      h('button', { type: 'button', class: 'hl-btn', onclick: async () => {
        const keep = pending;
        const v = await noteDialog('');
        if (v === null) return;
        pending = keep;
        add(v.trim());
      } }, '📝 Not ekle'),
      h('button', { type: 'button', class: 'hl-btn ghost', 'aria-label': 'Kapat', onclick: () => { window.getSelection().removeAllRanges(); pending = null; hide(); } }, '✕'));
    bar.classList.remove('hidden');
  }

  function showActive(key, i) {
    active = { key, i };
    pending = null;
    const x = list(key)[i];
    bar.replaceChildren(
      x.note ? h('div', { class: 'hl-note' }, '📝 ', x.note) : null,
      h('button', { type: 'button', class: 'hl-btn', onclick: editNote }, x.note ? '✏️ Notu düzenle' : '📝 Not ekle'),
      h('button', { type: 'button', class: 'hl-btn', onclick: remove }, '🧽 Vurguyu kaldır'),
      h('button', { type: 'button', class: 'hl-btn ghost', 'aria-label': 'Kapat', onclick: () => { active = null; hide(); } }, '✕'));
    bar.classList.remove('hidden');
  }

  // Seçim değişince: seçim bir paragrafın içindeyse araç çubuğunu göster
  let t;
  function onSelection() {
    clearTimeout(t);
    t = setTimeout(() => {
      if (!root || !root.isConnected) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { if (pending) { pending = null; hide(); } return; }
      const range = sel.getRangeAt(0);
      const startSpan = (range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement)?.closest('.ptext');
      if (!startSpan || !root.contains(startSpan)) return;
      const endSpan = (range.endContainer.nodeType === 1 ? range.endContainer : range.endContainer.parentElement)?.closest('.ptext');
      const s = offsetIn(startSpan, range.startContainer, range.startOffset);
      // Seçim birden fazla paragrafa yayılıyorsa ilk paragrafın sonunda kes
      const e = endSpan === startSpan ? offsetIn(startSpan, range.endContainer, range.endOffset) : startSpan.dataset.text.length;
      if (e - s < 1) return;
      pending = { key: startSpan.dataset.key, s, e };
      showPending();
    }, 200);
  }

  function onClick(e) {
    const m = e.target.closest('mark.hl');
    if (!m || !window.getSelection().isCollapsed) return;
    showActive(m.parentElement.dataset.key, Number(m.dataset.i));
  }

  return {
    paragraph,
    bar,
    attach(el) {
      root = el;
      document.addEventListener('selectionchange', onSelection);
      el.addEventListener('click', onClick);
    },
    detach() { document.removeEventListener('selectionchange', onSelection); clearTimeout(t); hide(); },
    clearPassage(passageIdx) {
      for (const k of [...store.keys()]) if (k.startsWith(passageIdx + ':')) store.delete(k);
      root && root.querySelectorAll('.ptext').forEach(paint);
      hide();
      toast('Vurgular temizlendi.');
    },
    count: total
  };
}

function noteDialog(initial) {
  return new Promise((resolve) => {
    const ta = h('textarea', { rows: 3, placeholder: 'Notun (ör. "Q5 cevabı burada?", "eş anlamlı: decline = fall")' }, initial);
    const dlg = h('dialog', null,
      h('h3', { style: { marginTop: 0 } }, '📝 Not'),
      ta,
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '12px' } },
        h('button', { class: 'btn ghost', onclick: () => close(null) }, 'Vazgeç'),
        h('button', { class: 'btn primary', onclick: () => close(ta.value) }, 'Kaydet')));
    function close(v) { dlg.close(); dlg.remove(); resolve(v); }
    dlg.addEventListener('cancel', () => close(null));
    document.body.append(dlg);
    dlg.showModal();
    ta.focus();
  });
}
