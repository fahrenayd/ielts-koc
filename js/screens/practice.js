// Pratik sekmesi: dört beceri + Hata Defteri
import { h } from '../util.js';
import { db } from '../db.js';
import { latestBands, typeAccuracy, SKILL_TR } from '../planner.js';
import { typeName } from '../qengine.js';
import { fmtBand } from '../scoring.js';

const MODULES = [
  { id: 'listening', icon: '🎧', href: '#/listening', desc: '4 bölüm türü; form, çoktan seçmeli, eşleştirme, harita.', tip: 'Ses başlamadan soruları oku ve boşluğa gelecek kelimenin türünü (sayı, isim, tarih) tahmin et.' },
  { id: 'reading', icon: '📖', href: '#/reading', desc: 'Akademik pasajlar; T/F/NG, headings, completion ve tüm tipler.', tip: 'Pasajda aynı kelimeyi değil, eş anlamlısını (paraphrase) ara.' },
  { id: 'writing', icon: '✍️', href: '#/writing', desc: 'Task 1 grafik/süreç/harita, Task 2 beş soru tipi.', tip: 'Task 1\'de mutlaka "Overall" ile başlayan bir genel eğilim cümlesi yaz.' },
  { id: 'speaking', icon: '🗣️', href: '#/speaking', desc: 'Part 1-2-3, kayıt, yazıya dökme ve akıcılık ölçümü.', tip: 'Part 1\'de cevap + neden + kısa örnek: 2–3 cümle.' }
];

export async function render() {
  const [bands, acc, mistakes] = await Promise.all([latestBands(), typeAccuracy(), db.all('mistakes')]);
  const weak = acc.filter((x) => x.n >= 3).slice(0, 3);
  return h('div', null,
    h('h1', null, 'Pratik'),
    h('div', { class: 'grid2', style: { marginTop: '12px' } }, MODULES.map((m) => h('a', { class: 'card tap module-card', href: m.href },
      h('div', { class: 'row spread' }, h('span', { style: { fontSize: '1.7rem' } }, m.icon), bands[m.id] != null ? h('span', { class: 'band-pill sm' }, fmtBand(bands[m.id])) : null),
      h('b', null, SKILL_TR[m.id]), h('div', { class: 'small muted' }, m.desc)))),
    h('a', { class: 'card tap row', href: '#/mistakes', style: { marginTop: '12px' } },
      h('span', { class: 'emoji' }, '📕'), h('span', { class: 'grow' }, h('b', null, 'Hata Defteri'), h('div', { class: 'small muted' }, mistakes.length ? `${mistakes.length} soru tekrar bekliyor` : 'Yanlışların burada birikir')),
      mistakes.length ? h('span', { class: 'pill warn' }, mistakes.length) : null, h('span', { class: 'chev' }, '›')),
    weak.length ? h('div', { class: 'card' }, h('h3', null, '🎯 En zayıf 3 soru tipin'),
      weak.map((w) => h('div', { class: 'row spread small', style: { padding: '6px 0' } }, h('span', null, typeName(w.type)), h('b', { class: w.pct < 0.6 ? 'txt-bad' : '' }, `%${Math.round(w.pct * 100)} (${w.c}/${w.n})`)))) : null,
    h('h2', null, 'Bölüm stratejileri'),
    h('div', { class: 'card' }, MODULES.map((m) => h('p', { class: 'small' }, `${m.icon} `, h('b', null, SKILL_TR[m.id] + ': '), m.tip))));
}
