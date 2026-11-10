// Ben: ilerleme paneli
import { h, shortDay } from '../util.js';
import { state } from '../store.js';
import { streakInfo, lastNDays, vocabStats, goalMinutes, latestBands, typeAccuracy, SKILLS, SKILL_TR } from '../planner.js';
import { lineChart } from '../charts.js';
import { typeName } from '../qengine.js';
import { fmtBand } from '../scoring.js';
import { db, getKV } from '../db.js';
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
  const [bands, acc, results, mistakeCount] = await Promise.all([latestBands(), typeAccuracy(), db.all('results'), db.all('mistakes').then((m) => m.length)]);
  // Band grafiği: her gün için o günkü son band (beceri başına)
  const banded = results.filter((r) => r.band != null && SKILLS.includes(r.module)).sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...new Set(banded.map((r) => r.date.slice(0, 10)))].slice(-12);
  const bandX = dates.map((d) => d.slice(8, 10) + '.' + d.slice(5, 7));
  const bandSeries = SKILLS.map((s) => {
    let last = null;
    return { name: SKILL_TR[s], values: dates.map((d) => { const r = banded.filter((x) => x.module === s && x.date.slice(0, 10) === d).pop(); if (r) last = r.band; return r ? r.band : last; }) };
  });

  return h('div', null,
    h('div', { class: 'row spread' }, h('h1', null, 'İlerlemem'), h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Ayarlar', style: { display: 'grid', placeItems: 'center', textDecoration: 'none' } }, '⚙️')),

    h('div', { class: 'kpis', style: { marginTop: '12px' } },
      h('div', { class: 'kpi' }, h('b', null, `🔥 ${st.streak}`), h('span', null, 'gün seri')),
      h('div', { class: 'kpi' }, h('b', null, hours), h('span', null, 'saat toplam')),
      h('div', { class: 'kpi' }, h('b', null, st.activeDays), h('span', null, 'aktif gün'))),

    h('h2', null, 'Son 14 gün'),
    h('div', { class: 'card' }, minutesChart(days, goalMinutes(state.profile))),

    h('h2', null, 'Band gelişimi'),
    bandSeries.some((s) => s.values.some((v) => v != null))
      ? h('div', { class: 'card' }, lineChart({ title: 'Band', x: bandX, series: bandSeries, yMin: 3, yMax: 9 }),
        h('div', { class: 'kpis kpis4', style: { marginTop: '10px' } }, SKILLS.map((s) => h('div', { class: 'kpi' }, h('b', { class: bands[s] != null && bands[s] < state.profile.targetMin ? 'txt-bad' : '' }, fmtBand(bands[s])), h('span', null, SKILL_TR[s])))),
        h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, `Hedef: her bölüm ≥ ${fmtBand(state.profile.targetMin)}. Değerler son 3 sonucun ortalamasıdır.`))
      : h('div', { class: 'card empty' }, h('div', { style: { fontSize: '2rem' } }, '📊'),
        h('p', { style: { margin: '8px 0 12px' } }, 'Seviye tespiti veya pratik yaptıkça bandların burada grafik olarak görünecek.'), h('a', { class: 'btn primary', href: '#/placement' }, 'Seviye tespitine başla')),

    acc.length ? h('div', null, h('h2', null, 'Soru tipine göre doğruluk'), h('div', { class: 'card' },
      acc.map((a, i) => h('div', { class: 'type-row' },
        h('div', { class: 'row spread small' }, h('span', null, (i < 3 && a.pct < 0.8 ? '⚠️ ' : '') + typeName(a.type)), h('b', null, `%${Math.round(a.pct * 100)} · ${a.c}/${a.n}`)),
        h('div', { class: 'bar' }, h('i', { style: { width: Math.round(a.pct * 100) + '%', background: a.pct < 0.6 ? 'var(--bad)' : a.pct < 0.8 ? 'var(--warn)' : 'var(--good)' } })))))) : null,

    h('h2', null, 'Kelime & gramer'),
    h('div', { class: 'card' },
      h('div', { class: 'row spread' }, h('span', null, 'Öğrenilen kelime'), h('b', null, `${vs.learned} / ${vs.total}`)),
      h('div', { class: 'bar', style: { margin: '6px 0 12px' } }, h('i', { style: { width: Math.round((vs.learned / vs.total) * 100) + '%' } })),
      h('div', { class: 'row spread' }, h('span', null, 'Kalıcı (21+ gün aralık)'), h('b', null, vs.mature)),
      h('div', { class: 'row spread', style: { marginTop: '8px' } }, h('span', null, 'Bitirilen gramer dersi'), h('b', null, `${lessonsDone} / ${idx.grammar.length}`))),

    h('h2', null, 'Arşivler'),
    h('div', { class: 'card' },
      h('a', { class: 'list-item', href: '#/mistakes' }, h('span', { class: 'emoji' }, '📕'), h('span', { class: 'grow' }, h('b', null, 'Hata Defteri'), h('div', { class: 'small muted' }, `${mistakeCount} soru`)), h('span', { class: 'chev' }, '›')),
      h('a', { class: 'list-item', href: '#/writing-archive' }, h('span', { class: 'emoji' }, '✍️'), h('span', { class: 'grow' }, h('b', null, 'Writing arşivi')), h('span', { class: 'chev' }, '›')),
      h('a', { class: 'list-item', href: '#/speaking-archive' }, h('span', { class: 'emoji' }, '🗣️'), h('span', { class: 'grow' }, h('b', null, 'Speaking oturumları')), h('span', { class: 'chev' }, '›')),
      h('a', { class: 'list-item', href: '#/placement' }, h('span', { class: 'emoji' }, '🧭'), h('span', { class: 'grow' }, h('b', null, 'Seviye tespiti')), h('span', { class: 'chev' }, '›'))),

    h('a', { class: 'btn ghost block', href: '#/settings', style: { marginTop: '16px' } }, '⚙️ Ayarlar, yedekleme ve profil'));
}
