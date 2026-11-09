// Kelime: konu listesi, konu detayı, flashcard tekrar oturumu
import { h, mdEl, topbar } from '../util.js';
import { db, getKV, setKV } from '../db.js';
import { state, logDay, makeTimer } from '../store.js';
import { loadIndex, loadVocabTopic } from '../content.js';
import { buildQueue, vocabStats, cardStates } from '../planner.js';
import { GRADES, review, intervalLabel, isLearned, isMature } from '../srs.js';
import { speak, ttsSupported } from '../tts.js';

const say = (text) => speak(text, { accent: state.settings.accent, rate: state.settings.rate });

// ---------- Kelime ana ekranı ----------
export async function renderHome() {
  const [idx, stats, q, off, lessons] = await Promise.all([loadIndex(), vocabStats(), buildQueue(), getKV('topicsOff', []), getKV('lessons', {})]);
  const total = q.cards.length;
  return h('div', null,
    h('h1', null, 'Kelime & Gramer'),
    h('div', { class: 'card hero', style: { marginTop: '12px' } },
      h('div', { class: 'row spread' },
        h('div', null, h('div', { class: 'big-num' }, total), h('div', { class: 'small muted' }, `kart bugün · ${q.dueCount} tekrar + ${q.newCount} yeni`)),
        h('div', { style: { fontSize: '2.4rem' } }, '🗂️')),
      h('a', { class: 'btn block', href: '#/vocab/review', style: { marginTop: '14px', background: '#fff', color: '#1f3a5f' }, disabled: !total },
        total ? 'Çalışmaya başla' : 'Bugünlük bitti ✓')),
    h('div', { class: 'kpis', style: { marginTop: '12px' } },
      h('div', { class: 'kpi' }, h('b', null, stats.learned), h('span', null, 'öğrenilen')),
      h('div', { class: 'kpi' }, h('b', null, stats.mature), h('span', null, 'kalıcı (21+ g)')),
      h('div', { class: 'kpi' }, h('b', null, stats.total), h('span', null, 'toplam'))),

    h('h2', null, 'Konu setleri'),
    h('div', { class: 'card' }, idx.vocab.map((t) => {
      const pt = stats.perTopic[t.id];
      return h('a', { class: 'list-item', href: '#/vocab/topic/' + t.id },
        h('span', { class: 'emoji' }, t.icon),
        h('span', { class: 'grow' },
          h('div', { class: 'row spread' }, h('b', null, t.tr), off.includes(t.id) ? h('span', { class: 'pill' }, 'kapalı') : null),
          h('div', { class: 'small muted' }, `${t.title} · ${pt.learned}/${pt.total}`),
          h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { style: { width: Math.round((pt.learned / pt.total) * 100) + '%' } }))),
        h('span', { class: 'chev' }, '›'));
    })),

    h('h2', null, 'Gramer — Türk öğrencilere özel'),
    h('div', { class: 'card' }, idx.grammar.map((g) => {
      const best = lessons[g.id]?.best;
      return h('a', { class: 'list-item', href: '#/grammar/' + g.id },
        h('span', { class: 'emoji' }, g.icon),
        h('span', { class: 'grow' }, h('b', null, g.tr), h('div', { class: 'small muted' }, g.title)),
        best != null ? h('span', { class: 'pill ' + (best >= 80 ? 'good' : 'warn') }, `%${best}`) : h('span', { class: 'pill' }, 'yeni'),
        h('span', { class: 'chev' }, '›'));
    })));
}

// ---------- Konu detayı ----------
export async function renderTopic(id) {
  const [t, states, off] = await Promise.all([loadVocabTopic(id), cardStates(), getKV('topicsOff', [])]);
  const isOff = off.includes(id);
  const toggle = h('input', { type: 'checkbox', checked: !isOff, onchange: async (e) => {
    const cur = await getKV('topicsOff', []);
    await setKV('topicsOff', e.target.checked ? cur.filter((x) => x !== id) : [...new Set([...cur, id])]);
  } });
  return h('div', null,
    topbar(`${t.icon} ${t.tr}`),
    h('div', { class: 'card' },
      h('label', { class: 'row spread', style: { cursor: 'pointer' } },
        h('span', null, h('b', null, 'Günlük tekrara dahil et'), h('div', { class: 'small muted' }, 'Kapatırsan bu konudan yeni kart gelmez.')), toggle)),
    h('a', { class: 'btn primary block', href: '#/vocab/study/' + id, style: { marginTop: '12px' } }, 'Sadece bu konuyu çalış'),
    h('h2', null, `Kelimeler (${t.words.length})`),
    h('div', { class: 'card' }, t.words.map((w) => {
      const s = states.get(w.id);
      const status = isMature(s) ? h('span', { class: 'pill good' }, 'kalıcı') : isLearned(s) ? h('span', { class: 'pill primary' }, 'öğreniliyor') : h('span', { class: 'pill' }, 'yeni');
      return h('details', { class: 'list-item', style: { display: 'block' } },
        h('summary', { class: 'row spread', style: { cursor: 'pointer', listStyle: 'none' } },
          h('span', null, h('b', null, w.word), ' ', h('span', { class: 'muted small' }, w.pos)), status),
        cardBack(w));
    })));
}

function cardBack(w) {
  const dl = h('dl', { class: 'back', style: { margin: '8px 0 0' } },
    h('div', { class: 'tr' }, w.tr),
    h('dt', null, 'Örnek'), h('dd', null, mdEl('span', w.example), ' ',
      ttsSupported() ? h('button', { class: 'btn sm ghost', 'aria-label': 'Örneği dinle', onclick: (e) => { e.stopPropagation(); say(w.example.replace(/\*\*/g, '')); } }, '🔊') : null));
  if (w.collocations?.length) dl.append(h('dt', null, 'Collocations'), h('dd', null, w.collocations.join(' · ')));
  if (w.synonyms?.length) dl.append(h('dt', null, 'Eş anlamlılar'), h('dd', null, w.synonyms.join(', ')));
  if (w.family && Object.keys(w.family).length) dl.append(h('dt', null, 'Kelime ailesi'), h('dd', null, Object.entries(w.family).map(([k, v]) => `${v} (${k})`).join(' · ')));
  if (w.note) dl.append(h('dt', null, 'Dikkat'), h('dd', null, mdEl('span', w.note)));
  return dl;
}

// ---------- Tekrar oturumu ----------
export async function renderReview(topicId = null) {
  const q = await buildQueue({ topicId });
  const queue = q.cards.slice();
  const timer = makeTimer();
  let done = 0, again = 0, firstCount = queue.length;
  const seenThisSession = new Set();
  const root = h('div');

  if (!queue.length) {
    root.append(topbar('Kelime tekrarı'), h('div', { class: 'card empty' },
      h('div', { style: { fontSize: '3rem' } }, '✅'),
      h('h3', null, 'Bugünlük kart kalmadı'),
      h('p', null, 'Yarın yeni tekrarlar gelecek. Daha fazla çalışmak istersen Ayarlar\'dan günlük yeni kart sayısını artırabilirsin.'),
      h('a', { class: 'btn primary', href: '#/vocab' }, 'Kelime ekranına dön')));
    return root;
  }

  function showCard() {
    const c = queue[0];
    if (!c) return finish();
    const s = q.getState(c.id);
    let revealed = false;
    const progress = Math.round((done / (firstCount + again)) * 100);
    const back = h('div', { class: 'hidden' }, cardBack(c));
    const grades = h('div', { class: 'grades hidden' }, GRADES.map((g) =>
      h('button', { class: 'btn ' + g.cls, onclick: () => grade(c, s, g.q) }, g.label, h('small', null, intervalLabel(s, g.q, q.today)))));
    const reveal = h('button', { class: 'btn primary block', onclick: () => show() }, 'Cevabı göster');
    function show() {
      if (revealed) return;
      revealed = true;
      back.classList.remove('hidden'); grades.classList.remove('hidden'); reveal.classList.add('hidden');
    }
    root.replaceChildren(
      topbar(topicId ? 'Konu çalışması' : 'Kelime tekrarı'),
      h('div', { class: 'row spread small muted' }, h('span', null, `${done} / ${firstCount + again}`), h('span', null, c.isNew && !seenThisSession.has(c.id) ? '✨ yeni kart' : '🔁 tekrar')),
      h('div', { class: 'bar', style: { margin: '6px 0 12px' } }, h('i', { style: { width: progress + '%' } })),
      h('div', { class: 'card flash', onclick: show },
        h('div', { class: 'small muted' }, `${c.topicTr}`),
        h('p', { class: 'word' }, c.word),
        h('div', { class: 'pos' }, c.pos),
        ttsSupported() ? h('div', null, h('button', { class: 'icon-btn', style: { marginTop: '12px' }, 'aria-label': 'Telaffuzu dinle', onclick: (e) => { e.stopPropagation(); say(c.word); } }, '🔊')) : null,
        back),
      h('div', { class: 'bottom-bar', style: { flexDirection: 'column' } }, reveal, grades));
  }

  async function grade(c, s, qv) {
    const wasNew = !s.seen;
    const ns = review(s, qv, q.today);
    q.states.set(c.id, ns);
    await db.put('cards', ns);
    await logDay({ seconds: timer.tick(), reviews: wasNew ? 0 : 1, newCards: wasNew ? 1 : 0 });
    seenThisSession.add(c.id);
    queue.shift();
    if (qv < 3) { queue.splice(Math.min(3, queue.length), 0, c); again++; } // 3 kart sonra tekrar gelsin
    else done++;
    showCard();
  }

  function finish() {
    root.replaceChildren(topbar('Oturum bitti'), h('div', { class: 'card empty' },
      h('div', { style: { fontSize: '3rem' } }, '🎉'),
      h('h3', null, `${done} kart tamamlandı`),
      h('p', null, again ? `${again} kez "Tekrar" dedin; bu kartlar yarın ve sonraki günlerde daha sık gelecek.` : 'Hepsini hatırladın, harika!'),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('a', { class: 'btn ghost', href: '#/vocab' }, 'Kelime'),
        h('a', { class: 'btn primary', href: '#/today' }, 'Bugün'))));
  }

  showCard();
  return root;
}
