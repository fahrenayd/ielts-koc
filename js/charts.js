// SVG grafikler: Writing Task 1 görselleri ve ilerleme grafiği
import { h } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
  for (const c of kids.flat()) if (c != null) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
const DASH = [null, '6 4', '2 3', '10 3 2 3', null];

function legend(series) {
  return h('div', { class: 'legend' }, series.map((s, i) => h('span', null, h('i', { style: { background: COLORS[i] } }), s.name)));
}
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v || 1)));
  return Math.ceil(v / p) * p;
}

export function lineChart(c, { W = 340, H = 220 } = {}) {
  const padL = 36, padR = 10, padT = 12, padB = 26;
  const vals = c.series.flatMap((s) => s.values.filter((v) => v != null));
  const max = c.yMax || niceMax(Math.max(...vals));
  const min = c.yMin || 0;
  const x = (i) => padL + (i * (W - padL - padR)) / Math.max(1, c.x.length - 1);
  const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': c.title });
  for (let k = 0; k <= 4; k++) {
    const v = min + ((max - min) * k) / 4;
    root.append(svg('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'grid' }),
      svg('text', { x: padL - 4, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, Number.isInteger(v) ? v : v.toFixed(1)));
  }
  const step = Math.ceil(c.x.length / 7);
  c.x.forEach((lab, i) => { if (i % step === 0 || i === c.x.length - 1) root.append(svg('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'axis' }, lab)); });
  c.series.forEach((s, si) => {
    const pts = s.values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
    root.append(svg('polyline', { points: pts, fill: 'none', stroke: COLORS[si], 'stroke-width': 2.5, 'stroke-dasharray': DASH[si], 'stroke-linejoin': 'round' }));
    s.values.forEach((v, i) => { if (v != null) root.append(svg('circle', { cx: x(i), cy: y(v), r: 3, fill: COLORS[si] }, svg('title', null, `${s.name} ${c.x[i]}: ${v}${c.unit ? ' ' + c.unit : ''}`))); });
  });
  return h('div', { class: 'chart' }, c.unit ? h('div', { class: 'small muted' }, c.unit) : null, root, legend(c.series));
}

export function barChart(c, { W = 340, H = 230 } = {}) {
  const padL = 36, padR = 6, padT = 12, padB = 40;
  const max = c.yMax || niceMax(Math.max(...c.series.flatMap((s) => s.values)));
  const gw = (W - padL - padR) / c.x.length;
  const bw = (gw * 0.75) / c.series.length;
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': c.title });
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    root.append(svg('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'grid' }), svg('text', { x: padL - 4, y: y(v) + 4, 'text-anchor': 'end', class: 'axis' }, v));
  }
  c.x.forEach((lab, i) => {
    const gx = padL + i * gw + gw * 0.125;
    c.series.forEach((s, si) => {
      const v = s.values[i];
      root.append(svg('rect', { x: gx + si * bw, y: y(v), width: Math.max(1, bw - 2), height: H - padB - y(v), fill: COLORS[si], rx: 2 }, svg('title', null, `${s.name} – ${lab}: ${v}`)));
    });
    const words = String(lab).split(' ');
    words.slice(0, 2).forEach((w, k) => root.append(svg('text', { x: padL + i * gw + gw / 2, y: H - padB + 14 + k * 12, 'text-anchor': 'middle', class: 'axis' }, w)));
  });
  return h('div', { class: 'chart' }, c.unit ? h('div', { class: 'small muted' }, c.unit) : null, root, c.series.length > 1 ? legend(c.series) : null);
}

export function pieChart(c) {
  const wrap = h('div', { class: 'chart pies' });
  for (const p of c.pies) {
    const total = p.slices.reduce((a, s) => a + s.value, 0);
    const root = svg('svg', { viewBox: '0 0 160 160', role: 'img', 'aria-label': p.label });
    let a0 = -Math.PI / 2;
    p.slices.forEach((s, i) => {
      const a1 = a0 + (2 * Math.PI * s.value) / total;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const pt = (a) => `${80 + 70 * Math.cos(a)},${80 + 70 * Math.sin(a)}`;
      root.append(svg('path', { d: `M80,80 L${pt(a0)} A70,70 0 ${large} 1 ${pt(a1)} Z`, fill: COLORS[i], stroke: 'var(--surface)', 'stroke-width': 1.5 }, svg('title', null, `${s.name}: ${s.value}%`)));
      const am = (a0 + a1) / 2;
      if (s.value >= 6) root.append(svg('text', { x: 80 + 45 * Math.cos(am), y: 84 + 45 * Math.sin(am), 'text-anchor': 'middle', class: 'pie-label' }, `${s.value}%`));
      a0 = a1;
    });
    wrap.append(h('div', { class: 'pie' }, h('div', { class: 'small center' }, h('b', null, p.label)), root));
  }
  wrap.append(legend(c.pies[0].slices));
  return wrap;
}

export function tableView(c) {
  return h('div', { class: 'tablewrap' }, h('table', { class: 'dtable' },
    h('thead', null, h('tr', null, c.head.map((x) => h('th', null, x)))),
    h('tbody', null, c.rows.map((r) => h('tr', null, r.map((x, i) => (i === 0 ? h('th', null, x) : h('td', null, x))))))));
}

export function processView(c) {
  return h('ol', { class: 'process' }, c.steps.map((s) => h('li', null, s)));
}

export function mapView(c) {
  const wrap = h('div', { class: 'chart maps' });
  for (const m of c.maps) {
    const root = svg('svg', { viewBox: '0 0 200 160', role: 'img', 'aria-label': m.label });
    root.append(svg('rect', { x: 1, y: 1, width: 198, height: 158, class: 'map-bg', rx: 4 }));
    for (const it of m.items) {
      root.append(svg(it.kind === 'tree' ? 'circle' : 'rect', it.kind === 'tree'
        ? { cx: it.x, cy: it.y, r: it.w / 2, class: 'map-green' }
        : { x: it.x, y: it.y, width: it.w, height: it.h, class: 'map-' + (it.kind || 'building'), rx: it.kind === 'road' ? 0 : 3 }));
      if (it.label) root.append(svg('text', { x: it.x + (it.kind === 'tree' ? 0 : it.w / 2), y: it.y + (it.kind === 'tree' ? it.w / 2 + 9 : it.h / 2 + 3), 'text-anchor': 'middle', class: 'map-label' }, it.label));
    }
    root.append(svg('text', { x: 190, y: 14, 'text-anchor': 'end', class: 'map-label' }, 'N ↑'));
    wrap.append(h('div', { class: 'pie' }, h('div', { class: 'small center' }, h('b', null, m.label)), root));
  }
  return wrap;
}

export function renderChart(c) {
  const fn = { line: lineChart, bar: barChart, pie: pieChart, table: tableView, process: processView, map: mapView }[c.type];
  return h('figure', { class: 'card task-figure' }, h('figcaption', { class: 'small' }, h('b', null, c.title)), fn ? fn(c) : null);
}

// Grafiği Claude'a anlatmak için düz metin
export function chartText(c) {
  if (c.type === 'line' || c.type === 'bar') return `${c.title}${c.unit ? ` (${c.unit})` : ''}\nKategoriler: ${c.x.join(', ')}\n` + c.series.map((s) => `${s.name}: ${s.values.join(', ')}`).join('\n');
  if (c.type === 'pie') return c.title + '\n' + c.pies.map((p) => `${p.label}: ` + p.slices.map((s) => `${s.name} ${s.value}%`).join(', ')).join('\n');
  if (c.type === 'table') return c.title + '\n' + [c.head, ...c.rows].map((r) => r.join(' | ')).join('\n');
  if (c.type === 'process') return c.title + '\n' + c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  if (c.type === 'map') return c.title + '\n' + c.maps.map((m) => `${m.label}: ` + m.items.filter((i) => i.label).map((i) => `${i.label} (konum x${i.x}, y${i.y})`).join('; ')).join('\n') + (c.notes ? '\nNot: ' + c.notes : '');
  return c.title;
}
