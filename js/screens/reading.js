// Reading: liste, pratik modu, süreli mod. runReading deneme sınavı ve seviye tespitinde de kullanılır.
import { h, topbar, fmtTime, countdown, onLeave, ask, md } from '../util.js';
import { db } from '../db.js';
import { listItems, loadItem } from '../content.js';
import { renderGroups, grade, unanswered, markGroups, lockGroups, feedbackEl, typeName, TYPE_TIP } from '../qengine.js';
import { mascot } from '../mascot.js';
import { saveOutcome, renderResults, estimateBand } from '../results.js';
import { fmtBand } from '../scoring.js';

const qCount = (it) => it.groups.reduce((a, g) => a + g.questions.length, 0);

// Soru tipine göre kısa antrenmanlar
function drillsSection(drills, best) {
  const types = [...new Set(drills.map((d) => d.type))];
  const listEl = h('div', { class: 'card' });
  const show = (t) => listEl.replaceChildren(...drills.filter((d) => !t || d.type === t).map((d) => h('a', { class: 'list-item', href: '#/drill/' + d.id },
    h('span', { class: 'grow' }, h('b', null, d.title), h('div', { class: 'small muted' }, `${typeName(d.type)} · ${d.questions} soru · ~4 dk`)),
    best[d.id] != null ? h('span', { class: 'pill ' + (best[d.id] >= 0.75 ? 'good' : 'warn') }, `%${Math.round(best[d.id] * 100)}`) : h('span', { class: 'pill' }, 'yeni'),
    h('span', { class: 'chev' }, '›'))));
  const chips = h('div', { class: 'chips' }, h('button', { type: 'button', class: 'chip on', onclick: (e) => pickChip(e, null) }, 'Hepsi'),
    types.map((t) => h('button', { type: 'button', class: 'chip', onclick: (e) => pickChip(e, t) }, typeName(t))));
  function pickChip(e, t) { chips.querySelectorAll('.chip').forEach((c) => c.classList.remove('on')); e.currentTarget.classList.add('on'); show(t); }
  show(null);
  return h('div', null,
    h('h2', null, '🎯 Soru tipi antrenmanı'),
    h('p', { class: 'small muted' }, 'Kısa paragraflar, 4 soru, anında açıklama. Zayıf olduğun tipe yüklenmek için ideal. (Bandı etkilemez, soru tipi istatistiğine sayılır.)'),
    chips, listEl);
}

export async function renderList() {
  const [list, drills, results] = await Promise.all([listItems('reading'), listItems('drills'), db.all('results')]);
  const best = {};
  for (const r of results) if (r.module === 'reading' && r.itemIds.length === 1 && r.mode !== 'placement') best[r.itemIds[0]] = Math.max(best[r.itemIds[0]] ?? -1, r.correct / r.total);
  return h('div', null,
    topbar('📖 Reading'),
    h('div', { class: 'card small' },
      h('b', null, 'Gerçek sınav: '), '3 pasaj, 40 soru, 60 dakika (pasaj başına ~20 dk). Cevap kâğıdına aktarma süresi yok.',
      h('p', { class: 'muted', style: { margin: '6px 0 0' } }, '💡 Önce soruları oku, sonra metinde anahtar kelimelerin eş anlamlılarını ara. Sorular çoğunlukla metindeki sırayı izler (matching soruları hariç).')),
    drillsSection(drills, best),
    h('h2', null, `📄 Tam pasajlar (${list.length})`),
    h('div', { class: 'card' }, list.map((m) => h('a', { class: 'list-item', href: '#/reading/' + m.id },
      h('span', { class: 'emoji' }, m.icon || '📄'),
      h('span', { class: 'grow' }, h('b', null, m.title), h('div', { class: 'small muted' }, `${m.topic} · ${m.level} · ${m.questions} soru`)),
      best[m.id] != null ? h('span', { class: 'pill ' + (best[m.id] >= 0.75 ? 'good' : 'warn') }, `%${Math.round(best[m.id] * 100)}`) : h('span', { class: 'pill' }, 'yeni'),
      h('span', { class: 'chev' }, '›')))),
    externalCard());
}

export async function renderDrill(id) {
  const [it, drills] = await Promise.all([loadItem('drills', id), listItems('drills')]);
  const root = h('div');
  const t0 = Date.now();
  const idx = drills.findIndex((d) => d.id === id);
  const next = drills.find((d, i) => i > idx && d.type === it.type) || drills[(idx + 1) % drills.length];
  root.append(
    h('div', { class: 'card', style: { marginBottom: '10px' } }, mascot('think', `**${typeName(it.type)}** antrenmanı. ${TYPE_TIP[it.type] || ''}`)),
    runReading({
      items: [it], mode: 'practice', title: `🎯 ${it.title}`,
      onDone: async (res) => {
        await saveOutcome({ module: 'reading', itemIds: [id], title: it.title, res, mode: 'drill', noBand: true, seconds: Math.min((Date.now() - t0) / 1000, 900) });
        root.replaceChildren(renderResults({ title: it.title, module: 'reading', res, band: null, items: [it],
          extra: h('a', { class: 'btn primary block', href: '#/drill/' + next.id, style: { margin: '12px 0' } }, `Sonraki antrenman: ${next.title} →`),
          onRetry: () => location.reload() }));
        window.scrollTo(0, 0);
      }
    }));
  return root;
}

export function externalCard() {
  return h('div', { class: 'card', style: { marginTop: '12px' } },
    h('h3', null, '🌐 Dış kaynaklar (internet gerekir)'),
    h('p', { class: 'small muted' }, 'Bu siteler ayrı yayıncılara ait; içerikleri uygulamaya kopyalanmadı. Orada çözdüğün testlerin sonucunu uygulamaya not etmek istersen Ben → Ayarlar\'dan değil, Deneme sekmesindeki "Dış test sonucu ekle" ile ekleyebilirsin.'),
    h('a', { class: 'btn ghost block', href: 'https://ieltsonlinetests.com/', target: '_blank', rel: 'noopener' }, 'IELTS Online Tests ↗'),
    h('a', { class: 'btn ghost block', style: { marginTop: '8px' }, href: 'https://ielts.org/take-a-test/preparation-resources/sample-test-questions', target: '_blank', rel: 'noopener' }, 'Resmi IELTS örnek sorular ↗'));
}

export async function renderIntro(id) {
  const it = await loadItem('reading', id);
  return h('div', null,
    topbar(it.title),
    h('div', { class: 'card' },
      h('p', null, h('span', { class: 'pill primary' }, it.topic), ' ', h('span', { class: 'pill' }, it.level), ' ', h('span', { class: 'pill' }, `${qCount(it)} soru`)),
      h('p', { class: 'small muted' }, 'Soru tipleri: ' + [...new Set(it.groups.map((g) => g.label || g.type))].join(', '))),
    h('a', { class: 'btn primary block', href: `#/reading/${id}/practice`, style: { marginTop: '12px' } }, '🧠 Pratik modu (anında geri bildirim)'),
    h('a', { class: 'btn ghost block', href: `#/reading/${id}/timed`, style: { marginTop: '8px' } }, `⏱️ Süreli mod (${it.minutes || 20} dk)`),
    h('p', { class: 'small muted', style: { marginTop: '12px' } }, 'Pratik modunda her soru grubunu ayrı kontrol edebilirsin. Süreli modda gerçek sınav gibi sonuç en sonda gösterilir.'));
}

export async function renderRun(id, mode) {
  const it = await loadItem('reading', id);
  const root = h('div');
  const t0 = Date.now();
  root.append(runReading({
    items: [it], mode, minutes: mode === 'timed' ? (it.minutes || 20) : 0, title: it.title,
    onDone: async (res, answers) => {
      const band = estimateBand('reading', res);
      await saveOutcome({ module: 'reading', itemIds: [id], title: it.title, res, mode, seconds: Math.min((Date.now() - t0) / 1000, 3600) });
      root.replaceChildren(renderResults({ title: it.title, module: 'reading', res, band, items: [it], onRetry: () => { location.hash = `#/reading/${id}/${mode}`; location.reload(); } }));
      window.scrollTo(0, 0);
    }
  }));
  return root;
}

// items: pasajlar; mode: practice | timed | exam; minutes: 0 = süresiz
export function runReading({ items, mode = 'practice', minutes = 0, title = 'Reading', onDone, submitLabel = 'Teslim et' }) {
  const answers = {};
  const allGroups = items.flatMap((x) => x.groups);
  let cur = 0, view = 'text', finished = false, timer = null;
  const timerEl = h('span', { class: 'timer' });
  const passageEl = h('div', { class: 'passage' });
  const qEl = h('div', { class: 'qpanel' });
  const tabs = items.length > 1 ? h('div', { class: 'seg passage-tabs' }) : null;
  const viewSeg = h('div', { class: 'seg' },
    h('button', { type: 'button', class: 'on', onclick: (e) => setView('text', e) }, 'Metin'),
    h('button', { type: 'button', onclick: (e) => setView('q', e) }, 'Sorular'));
  const root = h('div', { class: 'runner reading-runner' });

  function setView(v, e) {
    view = v;
    viewSeg.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', (i === 0) === (v === 'text')));
    root.classList.toggle('show-q', v === 'q');
    window.scrollTo(0, 0);
  }
  function showPassage(i) {
    cur = i;
    const p = items[i];
    passageEl.replaceChildren(
      h('h2', { class: 'ptitle' }, p.title),
      p.subtitle ? h('p', { class: 'muted small' }, p.subtitle) : null,
      p.paragraphs.map((x) => h('p', { class: 'para' }, x.key ? h('b', { class: 'pkey' }, x.key) : null, h('span', { html: md(x.text) }))));
    qEl.replaceChildren(...p.groups.map((g) => {
      const box = renderGroups([g], answers, { exam: mode !== 'practice' });
      if (mode === 'practice') {
        const fb = h('div');
        const btn = h('button', { class: 'btn ghost block', onclick: () => {
          const r = grade([g], answers);
          markGroups(box, r); lockGroups(box);
          fb.replaceChildren(...r.items.map((x) => feedbackEl(x)));
          btn.remove();
        } }, 'Bu grubu kontrol et');
        box.querySelector('.qgroup').append(btn, fb);
      }
      return box;
    }));
    if (tabs) tabs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
  }
  if (tabs) items.forEach((p, i) => tabs.append(h('button', { type: 'button', onclick: () => { showPassage(i); window.scrollTo(0, 0); } }, `Pasaj ${i + 1}`)));

  async function submit(force) {
    if (finished) return;
    if (!force) {
      const left = unanswered(allGroups, answers);
      if (!(await ask(left ? `${left} soru boş. Yine de teslim edilsin mi?` : 'Teslim edilsin mi?', { ok: submitLabel }))) return;
    }
    finished = true;
    timer && timer.stop();
    onDone(grade(allGroups, answers), answers);
  }

  root.append(
    h('div', { class: 'runbar' },
      h('div', { class: 'row spread' }, h('b', { class: 'runtitle' }, title), minutes ? timerEl : h('span', { class: 'pill' }, mode === 'practice' ? 'Pratik' : '')),
      tabs, viewSeg),
    h('div', { class: 'split' }, passageEl, qEl),
    h('div', { class: 'bottom-bar' }, h('button', { class: 'btn primary block', onclick: () => submit(false) }, mode === 'practice' ? 'Bitir ve sonucu gör' : submitLabel)));
  showPassage(0);

  if (minutes) {
    timer = countdown(minutes * 60, (left) => {
      timerEl.textContent = '⏱ ' + fmtTime(left);
      timerEl.classList.toggle('urgent', left <= 300);
    }, () => submit(true));
    onLeave(() => timer.stop());
  }
  return root;
}
