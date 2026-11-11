// Gramer mini dersleri + quiz
import { h, md, mdEl, topbar, shuffle } from '../util.js';
import { getKV, setKV } from '../db.js';
import { logDay, makeTimer } from '../store.js';
import { loadGrammar } from '../content.js';
import { mascot, pick as pofiLine } from '../mascot.js';

export async function renderLesson(id) {
  const [g, lessons] = await Promise.all([loadGrammar(id), getKV('lessons', {})]);
  const best = lessons[id]?.best;
  return h('div', null,
    topbar(`${g.icon} ${g.tr}`),
    h('p', { class: 'muted' }, g.intro),
    g.sections.map((s) => h('div', { class: 'card' },
      h('h3', null, s.h),
      (s.p || []).map((t) => mdEl('p', t)),
      (s.ex || []).map((e) => h('div', { class: 'example' },
        e.wrong ? h('div', { class: 'wrong' }, '✗ ' + e.wrong) : null,
        h('div', { class: 'right' }, '✓ ' + e.right),
        e.note ? mdEl('div', e.note, 'small muted') : null)))),
    h('div', { class: 'bottom-bar' },
      h('a', { class: 'btn primary block', href: `#/grammar/${id}/quiz` }, best != null ? `Quiz'i tekrar çöz (en iyi: %${best})` : `Quiz'e başla (${g.quiz.length} soru)`)));
}

export async function renderQuiz(id) {
  const g = await loadGrammar(id);
  const qs = shuffle(g.quiz);
  const timer = makeTimer();
  let i = 0, correct = 0;
  const wrongs = [];
  const root = h('div');

  function show() {
    const q = qs[i];
    let answered = false;
    const fb = h('div');
    const next = h('button', { class: 'btn primary block hidden', onclick: () => { i++; i < qs.length ? show() : finish(); } }, i + 1 < qs.length ? 'Sonraki soru' : 'Sonucu gör');
    const opts = h('div', { class: 'options' }, q.options.map((o, k) => h('button', { class: 'btn opt', onclick: (e) => pick(k, e.currentTarget) }, o)));
    function pick(k, btn) {
      if (answered) return;
      answered = true;
      const ok = k === q.answer;
      if (ok) correct++; else wrongs.push(q);
      btn.classList.add(ok ? 'correct' : 'wrong');
      opts.children[q.answer].classList.add('correct');
      fb.replaceChildren(h('div', { class: 'feedback ' + (ok ? 'ok' : 'no') }, mascot(ok ? 'happy' : 'sad', ok ? pofiLine('correct') : pofiLine('wrong'), !ok ? h('div', { class: 'small' }, 'Doğru cevap: ', h('b', { class: 'txt-good' }, q.options[q.answer])) : null, h('div', { class: 'small fb-explain' }, h('b', null, '💡 Neden? '), h('span', { html: md(q.explain) })))));
      next.classList.remove('hidden');
    }
    root.replaceChildren(
      topbar(g.tr + ' — Quiz'),
      h('div', { class: 'row spread small muted' }, h('span', null, `Soru ${i + 1} / ${qs.length}`), h('span', null, `${correct} doğru`)),
      h('div', { class: 'bar', style: { margin: '6px 0 14px' } }, h('i', { style: { width: Math.round((i / qs.length) * 100) + '%' } })),
      h('div', { class: 'card' }, mdEl('p', q.q, null), opts, fb),
      h('div', { class: 'bottom-bar' }, next));
  }

  async function finish() {
    const pct = Math.round((correct / qs.length) * 100);
    const lessons = await getKV('lessons', {});
    const prev = lessons[id] || {};
    lessons[id] = { best: Math.max(prev.best || 0, pct), last: pct, attempts: (prev.attempts || 0) + 1 };
    await setKV('lessons', lessons);
    await logDay({ seconds: timer.tick(), lesson: id, quizzes: 1 });
    root.replaceChildren(topbar('Quiz sonucu', { back: false }),
      h('div', { class: 'card center' },
        h('div', { class: 'big-num' }, `%${pct}`),
        h('p', { class: 'muted' }, `${correct} / ${qs.length} doğru`),
        mascot(pct >= 80 ? 'celebrate' : pct >= 55 ? 'happy' : 'sad', pct >= 80 ? 'Bu konuyu iyi kavramışsın! Writing ve Speaking\'de bilinçli kullanmaya başla. 🎉' : 'Ders kısmını bir kez daha oku, sonra quiz\'i tekrar çöz. Hedef: %80+. Yapabilirsin! 💪')),
      wrongs.length ? h('div', null, h('h2', null, 'Yanlış yaptıkların'), wrongs.map((q) => h('div', { class: 'card' },
        mdEl('p', q.q), h('p', { class: 'right', style: { color: 'var(--good)', fontWeight: 600 } }, '✓ ' + q.options[q.answer]), mdEl('p', q.explain, 'small muted')))) : null,
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('a', { class: 'btn ghost grow', href: '#/grammar/' + id }, 'Derse dön'),
        h('a', { class: 'btn primary grow', href: '#/today' }, 'Bugün')));
  }

  show();
  return root;
}
