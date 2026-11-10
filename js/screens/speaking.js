// Speaking: Part 1, Part 2 (cue card), Part 3, examiner modu, kayıt, yazıya dökme, ölçümler, öz-değerlendirme
import { h, topbar, mdEl, fmtTime, countdown, onLeave, shuffle, toast } from '../util.js';
import { db } from '../db.js';
import { state, logDay } from '../store.js';
import { loadItem } from '../content.js';
import { speakLine, stopSpeaking } from '../tts.js';
import { createRecorder, support, STT_ERR_TR } from '../recorder.js';
import { analyzeSpeech, speakingPrompt, S_CRIT } from '../eval.js';
import { evalPanel } from './writing.js';
import { fmtBand } from '../scoring.js';

export async function renderHome() {
  const [p1, p2, sessions] = await Promise.all([loadItem('speaking', 'part1'), loadItem('speaking', 'part2'), db.all('speaking')]);
  return h('div', null,
    topbar('🗣️ Speaking'),
    h('div', { class: 'card small' }, h('b', null, 'Gerçek sınav: '), '11–14 dk, examiner ile yüz yüze. Part 1 (4–5 dk günlük sorular), Part 2 (1 dk hazırlık + 2 dk konuşma), Part 3 (4–5 dk tartışma).',
      h('p', { class: 'muted', style: { margin: '6px 0 0' } }, '🎙️ Kayıt internetsiz çalışır. Konuşmanın yazıya dökülmesi Android Chrome\'da internet ister.')),
    !support.record && !support.stt ? h('div', { class: 'card', style: { borderColor: 'var(--bad)' } }, 'Bu tarayıcıda mikrofon özellikleri yok.') : null,
    h('a', { class: 'btn primary block', href: '#/speaking/examiner', style: { marginTop: '12px' } }, '🎯 Examiner modu: tam Speaking (~12 dk)'),
    sessions.length ? h('a', { class: 'btn ghost block', href: '#/speaking-archive', style: { marginTop: '8px' } }, `🗂️ Oturumlarım (${sessions.length})`) : null,
    h('h2', null, 'Part 2 — Cue cards'),
    h('div', { class: 'card' }, p2.cards.map((c) => h('a', { class: 'list-item', href: '#/speaking/p2/' + c.id },
      h('span', { class: 'grow' }, h('b', null, c.cue), h('div', { class: 'small muted' }, c.topic + (c.sample ? ' · örnek cevaplı' : ''))), h('span', { class: 'chev' }, '›')))),
    h('h2', null, 'Part 1 — Konular'),
    h('div', { class: 'card' }, p1.topics.map((t) => h('a', { class: 'list-item', href: '#/speaking/p1/' + t.id },
      h('span', { class: 'grow' }, h('b', null, t.title), h('div', { class: 'small muted' }, `${t.questions.length} soru`)), h('span', { class: 'chev' }, '›')))),
    h('div', { class: 'card small', style: { marginTop: '12px' } }, h('h3', null, 'Yüksek band için 4 kriter'),
      h('p', null, h('b', null, 'Fluency & Coherence: '), 'uzun duraksama olmadan, bağlaçlarla (actually, the thing is, on top of that) konuş.'),
      h('p', null, h('b', null, 'Lexical Resource: '), 'konuya özgü kelimeler ve doğal collocation\'lar; ezber idiom değil.'),
      h('p', null, h('b', null, 'Grammar: '), 'karmaşık yapılar (if, although, relative clauses) ve doğru zamanlar.'),
      h('p', { style: { margin: 0 } }, h('b', null, 'Pronunciation: '), 'vurgu ve tonlama; aksan değil, anlaşılırlık önemli.')));
}

export async function renderP1(topicId) {
  const p1 = await loadItem('speaking', 'part1');
  const t = p1.topics.find((x) => x.id === topicId);
  return runSpeaking({ title: `Part 1: ${t.title}`, steps: t.questions.map((q) => ({ part: 'Part 1', q })), samples: t.sample ? [t.sample] : [] });
}

export async function renderP2(cardId) {
  const p2 = await loadItem('speaking', 'part2');
  const c = p2.cards.find((x) => x.id === cardId);
  return runSpeaking({ title: 'Part 2 & 3', steps: [{ part: 'Part 2', card: c, q: c.cue, prep: 60, max: 120 }, ...c.part3.map((q) => ({ part: 'Part 3', q }))], samples: c.sample ? [{ q: c.cue, a: c.sample }] : [] });
}

export async function renderExaminer() {
  const [p1, p2] = await Promise.all([loadItem('speaking', 'part1'), loadItem('speaking', 'part2')]);
  return runSpeaking({ title: 'Examiner modu', examiner: true, ...examinerSteps(p1, p2) });
}

export function examinerSteps(p1, p2) {
  const topics = shuffle(p1.topics).slice(0, 2);
  const card = shuffle(p2.cards)[0];
  return {
    steps: [
      ...topics[0].questions.slice(0, 3).map((q) => ({ part: 'Part 1', q })),
      ...topics[1].questions.slice(0, 2).map((q) => ({ part: 'Part 1', q })),
      { part: 'Part 2', card, q: card.cue, prep: 60, max: 120 },
      ...card.part3.slice(0, 4).map((q) => ({ part: 'Part 3', q }))
    ],
    samples: card.sample ? [{ q: card.cue, a: card.sample }] : []
  };
}

function cueCard(c) {
  return h('div', { class: 'card cue' }, h('b', null, c.cue), h('div', { class: 'small', style: { marginTop: '6px' } }, 'You should say:'),
    h('ul', { class: 'small' }, c.points.map((p) => h('li', null, p))), h('div', { class: 'small' }, c.end));
}

const SELF = [
  ['fluency', 'Uzun duraksamadan, kendimi sık düzeltmeden konuştum'],
  ['fluency', 'Cevaplarımı nedenler ve örneklerle genişlettim'],
  ['lexical', 'Konuya özgü, basit olmayan kelimeler kullandım'],
  ['lexical', 'Bilmediğim kelimenin yerine başka ifade bulabildim (paraphrase)'],
  ['grammar', 'Karmaşık cümleler kurdum (if, although, which…)'],
  ['grammar', 'Zamanları (geçmiş, present perfect) çoğunlukla doğru kullandım'],
  ['pronunciation', 'Kaydımı dinleyince kelimelerim net anlaşılıyordu'],
  ['pronunciation', 'Vurgu ve tonlamam monoton değildi']
];

// steps: [{part, q, card?, prep?, max?}]; onDone verilirse (deneme/seviye tespiti) sonuç ona döner
export function runSpeaking({ title, steps, samples = [], examiner = false, onDone }) {
  const root = h('div', { class: 'runner' });
  const answers = [];
  const t0 = Date.now();
  let i = 0, rec = null, cd = null;
  const mode = state.settings.speechMode || 'both';
  const lang = state.settings.accent === 'en-US' ? 'en-US' : 'en-GB';
  onLeave(() => { cd && cd.stop(); stopSpeaking(); if (rec && rec.active) rec.stop(); });

  function ask(s) {
    if (examiner || s.part !== 'Part 2') speakLine(s.part === 'Part 2' ? `Now I'm going to give you a topic. ${s.q}` : s.q, { accent: state.settings.accent, rate: state.settings.rate });
  }

  function showStep() {
    if (i >= steps.length) return summary();
    const s = steps[i];
    const timerEl = h('b', { class: 'timer' });
    const live = h('p', { class: 'small muted live' });
    const notes = s.prep ? h('textarea', { rows: 4, placeholder: 'Notların (sınavda kâğıda not alabilirsin)…' }) : null;
    const actions = h('div', { class: 'bottom-bar', style: { flexDirection: 'column' } });
    root.replaceChildren(
      h('div', { class: 'runbar' }, h('div', { class: 'row spread' }, h('b', null, title), h('span', { class: 'pill primary' }, `${i + 1}/${steps.length} · ${s.part}`)), timerEl),
      s.card ? cueCard(s.card) : h('div', { class: 'card q-speak' }, h('p', { class: 'qbig' }, s.q),
        h('button', { class: 'btn sm ghost', onclick: () => ask(s) }, '🔊 Soruyu dinle')),
      notes, live, actions);
    ask(s);
    const startBtn = h('button', { class: 'btn primary block', onclick: () => startRec(s, timerEl, live, actions, notes) }, '🎙️ Konuşmaya başla');
    actions.replaceChildren(startBtn, h('button', { class: 'btn ghost block', onclick: () => { answers.push({ part: s.part, q: s.q, transcript: '', seconds: 0, skipped: true }); i++; showStep(); } }, 'Bu soruyu atla'));
    if (s.prep) cd = countdown(s.prep, (l) => { timerEl.textContent = `Hazırlık ${fmtTime(l)}`; }, () => startRec(s, timerEl, live, actions, notes));
    window.scrollTo(0, 0);
  }

  async function startRec(s, timerEl, live, actions, notes) {
    cd && cd.stop();
    stopSpeaking();
    rec = createRecorder({ lang, mode, onText: (t) => { live.textContent = '📝 ' + t; } });
    try { await rec.start(); } catch (e) {
      toast('Mikrofon açılamadı: izin ver veya Ayarlar\'dan Speaking modunu değiştir.');
      return;
    }
    const stopBtn = h('button', { class: 'btn danger block', onclick: () => stopRec(s) }, '⏹ Bitir');
    actions.replaceChildren(stopBtn);
    const max = s.max || 90;
    let el = 0;
    cd = countdown(max, (l) => {
      el = max - l;
      timerEl.textContent = `🔴 ${fmtTime(el)}${s.max ? ' / ' + fmtTime(max) : ''}`;
    }, () => stopRec(s));
    if (notes) notes.readOnly = true;
  }

  async function stopRec(s) {
    cd && cd.stop();
    const r = await rec.stop();
    const m = analyzeSpeech(r.transcript, r.seconds);
    const a = { part: s.part, q: s.q, transcript: r.transcript, seconds: r.seconds, metrics: m, sttError: r.sttError, url: r.url, blob: r.blob };
    answers.push(a);
    const tx = h('textarea', { rows: 4, oninput: (e) => { a.transcript = e.target.value; a.metrics = analyzeSpeech(a.transcript, a.seconds); } }, r.transcript);
    root.replaceChildren(
      h('div', { class: 'runbar' }, h('b', null, `${s.part} — cevabın`)),
      h('div', { class: 'card' }, h('p', { class: 'small muted' }, s.q),
        r.url ? h('audio', { controls: true, src: r.url, style: { width: '100%' } }) : null,
        r.sttError ? h('p', { class: 'small txt-bad' }, STT_ERR_TR[r.sttError] || ('Yazıya dökme hatası: ' + r.sttError)) : null,
        h('label', { class: 'field', style: { marginTop: '8px' } }, h('span', { class: 'small' }, 'Yazıya dökülen metin (tanıma hatalarını düzeltebilirsin)'), tx),
        metricsView(m, r.seconds, s.part),
        r.blob ? h('a', { class: 'btn sm ghost', href: r.url, download: `speaking-${Date.now()}.webm` }, '⬇️ Kaydı indir') : null),
      h('div', { class: 'bottom-bar', style: { flexDirection: 'column' } },
        h('button', { class: 'btn primary block', onclick: () => { i++; showStep(); } }, i + 1 < steps.length ? 'Sonraki soru' : 'Bitir ve değerlendir'),
        h('button', { class: 'btn ghost block', onclick: () => { answers.pop(); showStep(); } }, '↺ Bu soruyu tekrar cevapla')));
  }

  async function summary() {
    const seconds = (Date.now() - t0) / 1000;
    await logDay({ seconds: Math.min(seconds, 1800), done: 'speaking' });
    const clean = answers.map(({ blob, url, ...rest }) => rest);
    const session = { title, date: new Date().toISOString(), answers: clean, examiner };
    const id = await db.put('speaking', session);
    session.id = id;
    const checks = new Set();
    const selfEl = h('b');
    const selfBand = () => Math.min(8.5, 4.5 + checks.size * 0.5);
    const updSelf = async () => { selfEl.textContent = fmtBand(selfBand()); session.selfBand = selfBand(); await db.put('speaking', session); };
    root.replaceChildren(
      topbar('Speaking özeti', { back: false }),
      h('div', { class: 'card' }, h('h3', null, 'Cevapların'), answers.map((a, k) => h('div', { class: 'list-item', style: { display: 'block' } },
        h('div', { class: 'small muted' }, `${a.part}: ${a.q}`),
        a.skipped ? h('div', { class: 'small' }, '(atlandı)') : h('div', { class: 'small' }, `${a.metrics.words} kelime · ${Math.round(a.seconds)} sn · ${a.metrics.wpm} kelime/dk`),
        a.url ? h('audio', { controls: true, src: a.url, style: { width: '100%', marginTop: '6px' } }) : null))),
      h('div', { class: 'card' }, h('h3', null, '✅ Öz-değerlendirme'), h('p', { class: 'small muted' }, 'Kayıtlarını dinledikten sonra doğru olanları işaretle. Kaba öz tahmin: ', selfEl),
        SELF.map(([c, text]) => h('label', { class: 'row self-row' }, h('input', { type: 'checkbox', onchange: (e) => { e.target.checked ? checks.add(text) : checks.delete(text); updSelf(); } }),
          h('span', { class: 'small' }, text, h('span', { class: 'muted' }, ` (${c})`))))),
      evalPanel({
        crit: S_CRIT,
        buildPrompt: () => speakingPrompt({ parts: clean.filter((a) => !a.skipped) }),
        onSaved: async (r) => {
          session.eval = r;
          await db.put('speaking', session);
          await db.put('results', { module: 'speaking', itemIds: [], title, mode: onDone ? 'exam' : 'practice', date: new Date().toISOString(), band: r.overall, criteria: r.criteria });
          if (onDone) onDone(session);
        }
      }),
      samples.length ? h('div', null, h('h2', null, 'Örnek yüksek band cevap'), samples.map((s) => h('div', { class: 'card' }, h('p', { class: 'small muted' }, s.q), s.a.split(/\n+/).map((p) => mdEl('p', p))))) : null,
      onDone ? h('button', { class: 'btn ghost block', style: { marginTop: '12px' }, onclick: () => onDone(session) }, 'Claude değerlendirmesi olmadan devam et') : h('a', { class: 'btn ghost block', href: '#/speaking', style: { marginTop: '12px' } }, 'Speaking ekranı'));
    updSelf();
  }

  showStep();
  return root;
}

function metricsView(m, seconds, part) {
  const tips = [];
  const target = part === 'Part 2' ? [180, 320] : part === 'Part 3' ? [50, 140] : [25, 80];
  if (m.words < target[0]) tips.push(`Cevap kısa (${m.words} kelime). ${part} için ~${target[0]}–${target[1]} kelime hedefle: neden + örnek ekle.`);
  if (m.wpm && m.wpm < 90) tips.push(`Hız ${m.wpm} kelime/dk: akıcılık için ~110–160 hedefle.`);
  const fill = Object.entries(m.fillers);
  if (fill.reduce((a, [, n]) => a + n, 0) >= 4) tips.push('Dolgu kelimeleri sık: ' + fill.map(([f, n]) => `${f} ×${n}`).join(', ') + '. Kısa sessiz duraklama, "um"dan iyidir.');
  if (m.reps.length) tips.push('Tekrar eden kelimeler: ' + m.reps.map(([w, n]) => `${w} ×${n}`).join(', '));
  return h('div', { class: 'metrics' },
    h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('b', null, m.words), h('span', null, 'kelime')),
      h('div', { class: 'kpi' }, h('b', null, m.wpm || '–'), h('span', null, 'kelime/dk')),
      h('div', { class: 'kpi' }, h('b', null, Math.round(seconds)), h('span', null, 'saniye'))),
    tips.map((t) => h('div', { class: 'finding warn' }, t)));
}

export async function renderArchive() {
  const list = (await db.all('speaking')).sort((a, b) => b.date.localeCompare(a.date));
  return h('div', null, topbar('🗂️ Speaking oturumlarım'),
    h('div', { class: 'card' }, list.map((s) => h('details', { class: 'list-item', style: { display: 'block' } },
      h('summary', { class: 'row spread', style: { listStyle: 'none', cursor: 'pointer' } },
        h('span', null, h('b', null, s.title), h('div', { class: 'small muted' }, new Date(s.date).toLocaleString('tr-TR'))),
        s.eval ? h('span', { class: 'band-pill sm' }, fmtBand(s.eval.overall)) : s.selfBand ? h('span', { class: 'pill' }, `öz ${fmtBand(s.selfBand)}`) : null),
      s.answers.map((a) => h('div', { class: 'small', style: { marginTop: '8px' } }, h('b', null, `${a.part}: ${a.q}`), h('div', null, a.transcript || '(metin yok)')))))));
}
