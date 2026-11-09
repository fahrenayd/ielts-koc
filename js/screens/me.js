// Ben: ilerleme paneli
import { h, shortDay } from '../util.js';
import { state } from '../store.js';
import { streakInfo, lastNDays, vocabStats, goalMinutes } from '../planner.js';
import { getKV } from '../db.js';
import { loadIndex } from '../content.js';

const NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
  for (const c of kids) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

function minutesChart(data, goal) {
  const W = 340, H = 150, padB = 22, padT = 12;
  const max = Math.max(goal, ...data.map((d) => d.minutes), 10);
  const bw = W / data.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Son 14 günün çalışma dakikaları' });
  data.forEach((d, i) => {
    const x = i * bw + bw * 0.18, w = bw * 0.64;
    const top = y(d.minutes);
    if (d.minutes > 0) {
      const r = svg('rect', { x, y: top, width: w, height: H - padB - top, rx: 3, class: 'barfill' });
      r.append(svg('title', null, `${d.date.toLocaleDateString('tr-TR')}: ${d.minutes} dk`));
      root.append(r);
    }
    if (i % 2 === (data.length - 1) % 2) root.append(svg('text', { x: i * bw + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, shortDay(d.date)));
  });
  root.append(svg('line', { x1: 0, x2: W, y1: y(goal), y2: y(goal), class: 'goal' }));
  root.append(svg('text', { x: W - 2, y: y(goal) - 4, 'text-anchor': 'end', class: 'axis' }, `hedef ${goal} dk`));
  return h('div', { class: 'chart' }, root);
}

export async function render() {
  const [st, vs, lessons, idx] = await Promise.all([streakInfo(), vocabStats(), getKV('lessons', {}), loadIndex()]);
  const days = lastNDays(st.days, 14);
  const hours = (st.totalSeconds / 3600).toFixed(1);
  const lessonsDone = idx.grammar.filter((g) => lessons[g.id]?.best != null).length;

  return h('div', null,
    h('div', { class: 'row spread' }, h('h1', null, 'İlerlemem'), h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Ayarlar', style: { display: 'grid', placeItems: 'center', textDecoration: 'none' } }, '⚙️')),

    h('div', { class: 'kpis', style: { marginTop: '12px' } },
      h('div', { class: 'kpi' }, h('b', null, `🔥 ${st.streak}`), h('span', null, 'gün seri')),
      h('div', { class: 'kpi' }, h('b', null, hours), h('span', null, 'saat toplam')),
      h('div', { class: 'kpi' }, h('b', null, st.activeDays), h('span', null, 'aktif gün'))),

    h('h2', null, 'Son 14 gün'),
    h('div', { class: 'card' }, minutesChart(days, goalMinutes(state.profile))),

    h('h2', null, 'Band gelişimi'),
    h('div', { class: 'card empty' },
      h('div', { style: { fontSize: '2rem' } }, '📊'),
      h('p', { style: { margin: '8px 0 0' } }, 'Listening, Reading, Writing ve Speaking bandların seviye tespiti ve pratiklerden sonra burada grafik olarak görünecek (Aşama 2).')),

    h('h2', null, 'Kelime & gramer'),
    h('div', { class: 'card' },
      h('div', { class: 'row spread' }, h('span', null, 'Öğrenilen kelime'), h('b', null, `${vs.learned} / ${vs.total}`)),
      h('div', { class: 'bar', style: { margin: '6px 0 12px' } }, h('i', { style: { width: Math.round((vs.learned / vs.total) * 100) + '%' } })),
      h('div', { class: 'row spread' }, h('span', null, 'Kalıcı (21+ gün aralık)'), h('b', null, vs.mature)),
      h('div', { class: 'row spread', style: { marginTop: '8px' } }, h('span', null, 'Bitirilen gramer dersi'), h('b', null, `${lessonsDone} / ${idx.grammar.length}`))),

    h('h2', null, 'Hata Defteri'),
    h('div', { class: 'card locked' }, h('p', { class: 'small', style: { margin: 0 } }, 'Reading ve Listening yanlışların burada türlerine göre birikecek; 3 kez üst üste doğru yapınca defterden çıkacak (Aşama 2).')),

    h('a', { class: 'btn ghost block', href: '#/settings', style: { marginTop: '16px' } }, '⚙️ Ayarlar, yedekleme ve profil'));
}
