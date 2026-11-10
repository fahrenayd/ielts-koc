// Hata Defteri: yanlışlar türlerine göre birikir; 3 kez üst üste doğru yapılan soru defterden çıkar.
import { h, topbar, shuffle, mdEl } from '../util.js';
import { db } from '../db.js';
import { logDay, makeTimer } from '../store.js';
import { renderGroups, grade, markGroups, lockGroups, feedbackEl, typeName, KIND_TR } from '../qengine.js';

export async function renderHome() {
  const all = await db.all('mistakes');
  const byType = {};
  for (const m of all) (byType[m.qtype] = byType[m.qtype] || []).push(m);
  const kinds = {};
  for (const m of all) if (m.lastKind) kinds[m.lastKind] = (kinds[m.lastKind] || 0) + 1;
  return h('div', null,
    topbar('📕 Hata Defteri'),
    !all.length ? h('div', { class: 'card empty' }, h('div', { style: { fontSize: '2.5rem' } }, '🎉'),
      h('p', null, 'Defterin boş. Reading veya Listening çözdükçe yanlışların burada birikecek.'),
      h('a', { class: 'btn primary', href: '#/practice' }, 'Pratiğe git')) : h('div', null,
      h('div', { class: 'card hero' },
        h('div', { class: 'big-num' }, all.length), h('div', { class: 'small muted' }, 'soru defterde'),
        h('a', { class: 'btn block', href: '#/mistakes/review/all', style: { marginTop: '12px', background: '#fff', color: '#1f3a5f' } }, 'Karışık tekrar (en fazla 15)')),
      Object.keys(kinds).length ? h('div', { class: 'card' }, h('h3', null, 'Hata nedenlerin'),
        Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => h('div', { class: 'row spread small', style: { padding: '4px 0' } }, h('span', null, KIND_TR[k] || k), h('b', null, n)))) : null,
      h('h2', null, 'Soru tipine göre'),
      h('div', { class: 'card' }, Object.entries(byType).sort((a, b) => b[1].length - a[1].length).map(([t, list]) =>
        h('a', { class: 'list-item', href: '#/mistakes/review/' + t },
          h('span', { class: 'grow' }, h('b', null, typeName(t)), h('div', { class: 'small muted' }, list.map((m) => m.module === 'reading' ? 'R' : 'L').join('').replace(/(.)\1+/g, (s) => `${s[0]}×${s.length} `))),
          h('span', { class: 'pill warn' }, list.length), h('span', { class: 'chev' }, '›'))))));
}

export async function renderReview(filter) {
  let list = await db.all('mistakes');
  if (filter !== 'all') list = list.filter((m) => m.qtype === filter);
  list = shuffle(list).slice(0, 15);
  const root = h('div');
  const timer = makeTimer();
  let i = 0, right = 0;

  function show() {
    if (i >= list.length) return finish();
    const m = list[i];
    const answers = {};
    const box = renderGroups([m.group], answers, {});
    const fb = h('div');
    const next = h('button', { class: 'btn primary block hidden', onclick: () => { i++; show(); } }, i + 1 < list.length ? 'Sonraki' : 'Bitir');
    const check = h('button', { class: 'btn primary block', onclick: async () => {
      const r = grade([m.group], answers);
      const ok = r.items.every((x) => x.ok);
      markGroups(box, r); lockGroups(box);
      fb.replaceChildren(...r.items.slice(0, 1).map((x) => feedbackEl({ ...x, q: { ...x.q, explain: m.explain, quote: m.quote } })));
      if (ok) {
        right++;
        const streak = (m.streak || 0) + 1;
        if (streak >= 3) { await db.del('mistakes', m.id); fb.append(h('p', { class: 'small txt-good' }, '🏁 3 kez üst üste doğru: defterden çıkarıldı.')); }
        else { await db.put('mistakes', { ...m, streak }); fb.append(h('p', { class: 'small muted' }, `Seri: ${streak}/3`)); }
      } else {
        await db.put('mistakes', { ...m, streak: 0, wrongCount: (m.wrongCount || 0) + 1, lastKind: r.items[0].kind });
        fb.append(h('p', { class: 'small muted' }, 'Seri sıfırlandı (0/3).'));
      }
      await logDay({ seconds: timer.tick(), done: 'mistakes' });
      check.classList.add('hidden'); next.classList.remove('hidden');
    } }, 'Kontrol et');
    root.replaceChildren(
      topbar('Hata tekrarı'),
      h('div', { class: 'row spread small muted' }, h('span', null, `${i + 1} / ${list.length}`), h('span', null, `${m.module === 'reading' ? '📖' : '🎧'} ${m.title}`)),
      h('div', { class: 'bar', style: { margin: '6px 0 12px' } }, h('i', { style: { width: Math.round((i / list.length) * 100) + '%' } })),
      m.quote && m.module === 'reading' ? h('details', { class: 'card small' }, h('summary', null, 'Metinden ipucu'), mdEl('p', `"${m.quote}"`)) : null,
      box, fb,
      h('div', { class: 'bottom-bar', style: { flexDirection: 'column' } }, check, next));
  }
  function finish() {
    root.replaceChildren(topbar('Tekrar bitti', { back: false }), h('div', { class: 'card empty' },
      h('div', { style: { fontSize: '2.5rem' } }, '📕'), h('h3', null, `${right} / ${list.length} doğru`),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('a', { class: 'btn ghost', href: '#/mistakes' }, 'Hata Defteri'), h('a', { class: 'btn primary', href: '#/today' }, 'Bugün'))));
  }
  if (!list.length) root.append(topbar('Hata tekrarı'), h('div', { class: 'card empty' }, 'Bu türde hata yok.'));
  else show();
  return root;
}
