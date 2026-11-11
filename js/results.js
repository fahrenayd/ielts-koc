// Sonuç kaydetme ve sonuç ekranı (Reading / Listening / seviye tespiti / deneme)
import { h, mdEl, highlight, topbar } from './util.js';
import { db } from './db.js';
import { state, logDay } from './store.js';
import { rawToBand, fmtBand } from './scoring.js';
import { typeName, KIND_TR, snapshot, feedbackBody } from './qengine.js';
import { mascot, resultMood } from './mascot.js';

// res: grade() çıktısı. Bandı 40 soruya ölçekleyerek tahmin eder.
export function estimateBand(module, res) {
  if (!res.total) return null;
  return rawToBand(module, res.correct, res.total, state.profile.examType);
}

export async function saveOutcome({ module, itemIds, title, res, mode, seconds = 0, band, noBand = false }) {
  // Kısa antrenmanlar (az soru) bandı yanıltmasın diye bandsız kaydedilir
  const b = noBand ? null : band ?? estimateBand(module, res);
  const row = {
    module, itemIds, title, mode, date: new Date().toISOString(), correct: res.correct, total: res.total,
    band: b, byType: res.byType
  };
  await db.put('results', row);
  // Hata Defteri: yanlışları ekle, doğru yapılanların serisini artır
  for (const it of res.items) {
    const snap = snapshot(it, { module, title, itemId: itemIds[0] });
    const old = await db.get('mistakes', snap.id);
    if (!it.ok) await db.put('mistakes', { ...snap, streak: 0, wrongCount: (old?.wrongCount || 0) + 1, lastKind: it.kind, added: old?.added || row.date, last: row.date });
    else if (old) {
      const streak = (old.streak || 0) + 1;
      if (streak >= 3) await db.del('mistakes', snap.id); else await db.put('mistakes', { ...old, streak, last: row.date });
    }
  }
  await logDay({ seconds, done: module });
  return row;
}

export function scoreCard(res, band, label) {
  const pct = Math.round((res.correct / Math.max(1, res.total)) * 100);
  const [mood, line] = resultMood(pct / 100);
  return h('div', null, h('div', { class: 'card hero center' },
    h('div', { class: 'small muted' }, label || 'Sonuç'),
    h('div', { class: 'big-num' }, `${res.correct} / ${res.total}`),
    h('div', { class: 'muted' }, `%${pct} doğru`),
    band != null ? h('div', { style: { marginTop: '10px' } }, h('span', { class: 'band-pill' }, `Tahmini band ${fmtBand(band)}`)) : null,
    h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, res.total < 40 ? 'Band, doğru oranının 40 soruya ölçeklenmesiyle tahmin edildi; az soruyla yapılan tahmin kabadır.' : 'Tahmini band (resmi tablolar sınava göre biraz değişir).')),
    h('div', { class: 'card' }, mascot(mood, line)));
}

export function byTypeCard(byType) {
  const rows = Object.entries(byType).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]);
  return h('div', { class: 'card' }, h('h3', null, 'Soru tipine göre'),
    rows.map(([t, [c, n]]) => h('div', { class: 'type-row' },
      h('div', { class: 'row spread small' }, h('span', null, typeName(t)), h('b', null, `${c}/${n}`)),
      h('div', { class: 'bar' }, h('i', { style: { width: Math.round((c / n) * 100) + '%', background: c / n < 0.6 ? 'var(--bad)' : c / n < 0.8 ? 'var(--warn)' : 'var(--good)' } })))));
}

// items: içerik öğeleri (pasaj veya listening bölümleri)
export function renderResults({ title, module, res, band, items, onRetry, extra }) {
  const wrong = res.items.filter((i) => !i.ok);
  const sourceFor = (it) => items.find((x) => x.groups.some((g) => g === it.g));
  const detail = (it) => {
    const src = sourceFor(it);
    const box = h('div', { class: 'card res-item ' + (it.ok ? 'is-ok' : 'is-no') },
      h('div', { class: 'row spread' }, h('b', null, `${it.ok ? '✓' : '✗'} Soru ${it.q.n}`), h('span', { class: 'pill' }, typeName(it.type))),
      it.q.prompt ? mdEl('p', it.q.prompt.replace(/___/g, '______'), 'small') : it.g.prompt ? mdEl('p', it.g.prompt, 'small') : null,
      !it.ok && it.kind ? h('div', { class: 'small', style: { margin: '2px 0 6px' } }, h('span', { class: 'pill warn' }, KIND_TR[it.kind] || it.kind)) : null,
      ...feedbackBody(it, { showQuote: false }).slice(1));
    if (it.q.quote && src) {
      const para = module === 'reading'
        ? src.paragraphs.find((p) => p.text.includes(it.q.quote))
        : null;
      const ctx = module === 'reading' ? (para ? `${para.key ? para.key + '. ' : ''}${para.text}` : it.q.quote)
        : (src.script.find((l) => l.t.includes(it.q.quote))?.t || it.q.quote);
      box.append(h('details', { class: 'evidence' }, h('summary', null, module === 'reading' ? '📌 Metinde göster' : '📌 Transkriptte göster'),
        h('p', { class: 'small', html: highlight(ctx, [it.q.quote]) })));
    }
    return box;
  };
  const list = h('div');
  const showList = (onlyWrong) => list.replaceChildren(...(onlyWrong ? wrong : res.items).map(detail));
  showList(wrong.length > 0);

  return h('div', null,
    topbar(title, { back: false }),
    scoreCard(res, band),
    extra || null,
    byTypeCard(res.byType),
    module === 'listening' ? h('details', { class: 'card' }, h('summary', null, h('b', null, '📜 Tam transkript')),
      items.map((src) => h('div', { style: { marginTop: '10px' } },
        h('p', { class: 'small muted' }, `Section ${src.section}: ${src.title}`),
        src.script.map((l) => h('p', { class: 'small', html: `<b>${src.speakers[l.s]?.name || l.s}:</b> ` + highlight(l.t, res.items.filter((i) => sourceFor(i) === src).map((i) => i.q.quote)) }))))) : null,
    h('div', { class: 'row spread', style: { margin: '20px 0 8px' } },
      h('h2', { style: { margin: 0 } }, wrong.length ? `Yanlışlar (${wrong.length})` : 'Tüm cevaplar'),
      wrong.length ? h('div', { class: 'seg', style: { width: '170px' } },
        h('button', { type: 'button', class: 'on', onclick: (e) => { setOn(e); showList(true); } }, 'Yanlış'),
        h('button', { type: 'button', onclick: (e) => { setOn(e); showList(false); } }, 'Hepsi')) : null),
    wrong.length ? h('p', { class: 'small muted' }, 'Yanlışların Hata Defteri\'ne eklendi. Orada 3 kez üst üste doğru yaparsan defterden çıkar.') : null,
    list,
    h('div', { class: 'row', style: { marginTop: '16px' } },
      onRetry ? h('button', { class: 'btn ghost grow', onclick: onRetry }, 'Tekrar çöz') : null,
      h('a', { class: 'btn primary grow', href: '#/practice' }, 'Pratik ekranı')));
}

function setOn(e) {
  e.currentTarget.parentElement.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
  e.currentTarget.classList.add('on');
}
