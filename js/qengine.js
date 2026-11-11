// Ortak soru motoru: Reading, Listening, Hata Defteri, seviye tespiti ve deneme sınavı bunu kullanır.
// Grup tipleri: tfng, ynng, mcq, multi, match (subtype: headings|info|features|endings|map), gap (subtype: sentence|summary|note|form|table|short)
import { h, mdEl, md } from './util.js';
import { mascot, pick } from './mascot.js';

export const LETTERS = 'ABCDEFGHIJKLMNOP'.split('');

const TYPE_TR = {
  tfng: 'True / False / Not Given', ynng: 'Yes / No / Not Given', mcq: 'Çoktan seçmeli', multi: 'Çoktan seçmeli (iki cevap)',
  headings: 'Matching headings', info: 'Matching information', features: 'Matching features', endings: 'Sentence endings',
  map: 'Harita / plan etiketleme', match: 'Eşleştirme',
  sentence: 'Sentence completion', summary: 'Summary completion', note: 'Not tamamlama', form: 'Form tamamlama',
  table: 'Tablo tamamlama', short: 'Kısa cevap', gap: 'Boşluk doldurma'
};
export const KIND_TR = {
  blank: 'Boş bırakıldı', limit: 'Kelime sınırı aşıldı', spelling: 'Yazım hatası (doğruya çok yakın)', wrong: 'Yanlış cevap',
  corrected: 'Tuzak: konuşmacı bilgiyi sonradan düzeltti', distractor: 'Tuzak: bahsedilen ama doğru olmayan seçenek (distractor)',
  paraphrase: 'Eş anlamlı ifade (paraphrase) kaçırıldı', ngfalse: 'NOT GIVEN karışıklığı'
};

// Hata türüne göre kısa ders
export const KIND_TIP = {
  blank: 'Hiçbir soruyu boş bırakma. IELTS\'te yanlış cevap puan götürmez; tahmin bile şans verir.',
  limit: 'Kelime sınırını aştın. "the", "a" gibi kelimeler de sayılır; sınırı aşan cevap doğru bilgiyi içerse bile **yanlış** sayılır.',
  spelling: 'Cevabın neredeyse doğru ama yazımı hatalı. Gerçek sınavda yazım hatası = yanlış. Bu kelimeyi not al ve yazarak tekrar et.',
  corrected: 'Konuşmacılar sık sık ilk söylediklerini düzeltir ("Actually, no…", "sorry, I mean…"). Her zaman **son söylenen** bilgiyi yaz.',
  distractor: 'Çeldirici: metinde/kayıtta geçen ama sorunun cevabı olmayan bilgi. Sorunun **tam olarak neyi** sorduğunu (tarih mi, fiyat mı, kimin görüşü mü) altını çizerek oku.',
  paraphrase: 'Soru ve metin aynı fikri farklı kelimelerle anlatır. Anahtar kelimenin eş anlamlılarını düşünerek dinle/oku.',
  ngfalse: '**FALSE** = metin ifadenin **tersini** açıkça söylüyor. **NOT GIVEN** = metin bu konuda **hiç bilgi vermiyor**. Kendine sor: "Metinde bunu çürüten bir cümle var mı?" Varsa FALSE, yoksa NOT GIVEN.'
};
// Soru tipine göre strateji (genel yanlışlarda gösterilir)
export const TYPE_TIP = {
  tfng: 'TRUE: metin aynı şeyi söylüyor · FALSE: tersini söylüyor · NOT GIVEN: bilgi yok. Kendi genel bilgini kullanma; "some, all, always, only" gibi kelimelere dikkat et.',
  ynng: 'YES/NO yazarın **görüşü** ile ilgilidir. "I believe, it would be wrong, in my view" gibi değerlendirme ifadelerini ara; başkalarının görüşünü (some people argue) yazarınkiyle karıştırma.',
  mcq: 'Seçenekteki kelimeler metinde geçse bile anlam farklı olabilir. Her seçeneği metindeki ilgili cümleyle tek tek karşılaştır, kesin yanlışları ele.',
  multi: 'İki cevaplı sorularda her seçeneği ayrı ayrı doğrula; konuşmada bahsedilip reddedilen seçenekler çeldiricidir.',
  headings: 'Başlık paragrafın **ana fikri** olmalı, tek bir detay değil. Paragrafın ilk ve son cümlesine odaklan.',
  info: 'Bilginin **türünü** ara: örnek mi, istatistik mi, neden mi, öneri mi? Bu sorular metindeki sırayı izlemez.',
  features: 'İsimlerin geçtiği cümleleri tara ve fikrin **kime ait olduğuna** dikkat et.',
  endings: 'Önce gramer olarak uyan sonları belirle, sonra anlamı metinle kontrol et.',
  map: 'Girişten başla ve yön ifadelerini takip et: on your left/right, opposite, beyond, north-east corner.',
  sentence: 'Boşluğa gereken kelime türünü (isim, fiil, sıfat) tahmin et; cevabı metinden **birebir** al ve kelime sınırını aşma.',
  summary: 'Özet metnin bir bölümünü paraphrase eder. O bölümü bul, boşluk için gramer olarak uyan kelimeyi seç.',
  note: 'Notlar konuşmanın sırasını izler. Boşluğun öncesindeki/sonrasındaki kelimeyi kayıtta yakalamaya çalış.',
  form: 'Form sorularında isim, tarih, sayı ve yazım çok önemlidir. Harf harf söylenen kelimeleri dikkatle yaz.',
  table: 'Tablonun başlıkları hangi bilgi türünün (sayı, isim) gerektiğini söyler.',
  short: 'Cevap metinden birebir alınır; kelime sınırını ve sayıların doğru yazımını kontrol et.'
};

// Bir maddenin açıklaması (iki cevaplı gruplarda tüm açıklamalar birleştirilir)
export function explainFor(it) {
  if (it.g.type === 'multi') return it.g.questions.map((x) => x.explain).filter(Boolean).join(' ');
  if (it.q.explain) return it.q.explain;
  if (it.q.quote) return `Metindeki ilgili kısım: "${it.q.quote}"`;
  return '';
}
export function lessonFor(it) {
  if (it.ok) return '';
  if (it.kind && it.kind !== 'wrong' && KIND_TIP[it.kind]) return KIND_TIP[it.kind];
  return TYPE_TIP[it.type] || '';
}

export function qType(g) {
  if (g.type === 'match') return g.subtype || 'match';
  if (g.type === 'gap') return g.subtype || 'gap';
  return g.type;
}
export const typeName = (t) => TYPE_TR[t] || t;

// ---------- Cevap kontrolü ----------
export function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[’‘`]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
    .replace(/^[.,;:!?"']+|[.,;:!?"']+$/g, '');
}
const isNum = (t) => /^[£$€]?[\d][\d.,:/%-]*(st|nd|rd|th|am|pm|kg|km|m)?$/.test(t);
export function overLimit(g, given) {
  if (!g.maxWords) return false;
  const toks = norm(given).split(' ').filter(Boolean);
  const nums = toks.filter(isNum).length;
  const words = toks.length - nums;
  if (g.number) return words > g.maxWords || nums > 1;
  return toks.length > g.maxWords;
}
function lev(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 3) return 99;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[m][n];
}
function gradeGap(g, q, given) {
  if (!given || !norm(given)) return { ok: false, kind: 'blank' };
  const acc = q.answer.map(norm);
  const gv = norm(given);
  if (acc.includes(gv)) return { ok: true, kind: null };
  if (overLimit(g, given)) return { ok: false, kind: 'limit' };
  if (acc.some((a) => lev(a, gv) <= Math.max(1, Math.floor(a.length / 6)))) return { ok: false, kind: 'spelling' };
  return { ok: false, kind: q.trap || 'wrong' };
}

function choiceText(g, q, key) {
  if (key == null) return '—';
  if (g.type === 'tfng' || g.type === 'ynng') return key;
  if (g.type === 'mcq') return `${key}. ${q.options[LETTERS.indexOf(key)] ?? ''}`;
  const opts = g.options || g.bank || [];
  const o = opts.find((x) => x.key === key);
  return o ? `${key}. ${o.text}` : key;
}

export function grade(groups, answers) {
  const items = [];
  for (const g of groups) {
    const type = qType(g);
    if (g.type === 'multi') {
      const given = answers[g.questions[0].id] || [];
      const hits = given.filter((x) => g.answers.includes(x)).length;
      g.questions.forEach((q, i) => items.push({
        q, g, type, ok: i < hits, kind: i < hits ? null : (given.length ? (q.trap || 'distractor') : 'blank'),
        given: given.length ? given.map((k) => `${k}. ${g.options[LETTERS.indexOf(k)]}`).join(' · ') : '—',
        expected: g.answers.map((k) => `${k}. ${g.options[LETTERS.indexOf(k)]}`).join(' · ')
      }));
      continue;
    }
    for (const q of g.questions) {
      const given = answers[q.id];
      if (g.type === 'gap' && !g.bank) {
        const r = gradeGap(g, q, given);
        items.push({ q, g, type, ok: r.ok, kind: r.kind, given: given || '—',
          expected: q.answer[0] + (q.answer.length > 1 ? `  (diğer kabul: ${q.answer.slice(1).join(' / ')})` : '') });
      } else {
        const key = Array.isArray(q.answer) ? q.answer[0] : q.answer;
        const ok = given != null && given !== '' && norm(given) === norm(key);
        const kind = given == null || given === '' ? 'blank' : ok ? null : (q.trap || ((g.type === 'tfng' || g.type === 'ynng') && /NOT GIVEN/.test(key + given) ? 'ngfalse' : 'wrong'));
        items.push({ q, g, type, ok, kind, given: choiceText(g, q, given || null), expected: choiceText(g, q, key) });
      }
    }
  }
  const correct = items.filter((i) => i.ok).length;
  const byType = {};
  for (const i of items) {
    byType[i.type] = byType[i.type] || [0, 0];
    byType[i.type][1]++;
    if (i.ok) byType[i.type][0]++;
  }
  return { items, correct, total: items.length, byType };
}

export function unanswered(groups, answers) {
  let n = 0;
  for (const g of groups) {
    if (g.type === 'multi') { n += Math.max(0, g.questions.length - (answers[g.questions[0].id] || []).length); continue; }
    for (const q of g.questions) if (answers[q.id] == null || answers[q.id] === '') n++;
  }
  return n;
}

// ---------- Görünüm ----------
function gapInput(g, q, answers, onChange) {
  if (g.bank) {
    return h('select', { class: 'gap gap-sel', 'data-qid': q.id, 'aria-label': `Soru ${q.n}`, onchange: (e) => { answers[q.id] = e.target.value || null; onChange(); } },
      h('option', { value: '' }, `(${q.n}) seç`),
      g.bank.map((o) => h('option', { value: o.key, selected: answers[q.id] === o.key }, `${o.key}`)));
  }
  return h('input', {
    class: 'gap', 'data-qid': q.id, type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', autocorrect: 'off',
    placeholder: String(q.n), 'aria-label': `Soru ${q.n}`, value: answers[q.id] || '',
    oninput: (e) => { answers[q.id] = e.target.value; onChange(); }
  });
}

function optionButtons(keys, labels, current, onPick, multiMax) {
  const wrap = h('div', { class: 'options' });
  const sel = new Set(Array.isArray(current) ? current : current ? [current] : []);
  keys.forEach((k, i) => {
    const b = h('button', { type: 'button', class: 'btn opt' + (sel.has(k) ? ' sel' : ''), 'data-key': k },
      labels ? h('b', { class: 'okey' }, k) : null, h('span', null, labels ? labels[i] : k));
    b.addEventListener('click', () => {
      if (wrap.classList.contains('locked')) return;
      if (multiMax) {
        if (sel.has(k)) sel.delete(k); else { if (sel.size >= multiMax) return; sel.add(k); }
        b.classList.toggle('sel', sel.has(k));
        onPick([...sel].sort());
      } else {
        wrap.querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
        b.classList.add('sel');
        onPick(k);
      }
    });
    wrap.append(b);
  });
  return wrap;
}

function inlineGapText(g, answers, onChange) {
  // g.text içinde {{n}} işaretleri boşlukları gösterir; satırlar \n ile ayrılır
  const byN = new Map(g.questions.map((q) => [String(q.n), q]));
  const wrap = h('div', { class: 'gaptext' });
  for (const line of g.text.split('\n')) {
    const row = h('div', { class: 'gapline' + (line.startsWith('#') ? ' gaphead' : '') });
    const parts = line.replace(/^#\s*/, '').split(/\{\{(\d+)\}\}/);
    parts.forEach((p, i) => {
      if (i % 2 === 0) { if (p) row.append(h('span', { html: md(p) })); } else {
        const q = byN.get(p);
        row.append(h('span', { class: 'gapwrap', 'data-q': q.id }, h('b', { class: 'gapn' }, p), gapInput(g, q, answers, onChange)));
      }
    });
    wrap.append(row);
  }
  return wrap;
}

export function renderGroup(g, answers, opts = {}) {
  const onChange = opts.onChange || (() => {});
  const ns = g.questions.map((q) => q.n);
  const box = h('section', { class: 'qgroup card', 'data-g': g.questions[0].id },
    h('div', { class: 'qrange' }, `Questions ${ns[0]}${ns.length > 1 ? '–' + ns[ns.length - 1] : ''}`),
    g.instructions ? mdEl('p', g.instructions, 'qinstr') : null,
    g.maxWords ? h('p', { class: 'qlimit' }, g.limitText || `NO MORE THAN ${['', 'ONE', 'TWO', 'THREE'][g.maxWords] || g.maxWords} WORD${g.maxWords > 1 ? 'S' : ''}${g.number ? ' AND/OR A NUMBER' : ''}`) : null,
    g.tip && !opts.exam ? h('details', { class: 'tip' }, h('summary', null, '💡 Strateji'), mdEl('p', g.tip)) : null,
    g.svg ? h('div', { class: 'qsvg', html: g.svg }) : null,
    g.title ? h('h3', { class: 'qtitle' }, g.title) : null);

  if (((g.type === 'match' && g.options) || g.bank) && (g.options || g.bank).some((o) => o.text)) {
    box.append(h('div', { class: 'optlist' }, (g.options || g.bank).map((o) => h('div', null, h('b', null, o.key + '  '), o.text))));
  }

  if (g.type === 'gap' && g.text) {
    box.append(inlineGapText(g, answers, onChange));
  } else if (g.type === 'multi') {
    box.append(h('div', { class: 'q', 'data-q': g.questions[0].id },
      mdEl('p', g.prompt, 'qprompt'),
      optionButtons(LETTERS.slice(0, g.options.length), g.options, answers[g.questions[0].id], (v) => { answers[g.questions[0].id] = v; onChange(); }, g.questions.length)));
  } else {
    for (const q of g.questions) {
      const row = h('div', { class: 'q', 'data-q': q.id });
      if (g.type === 'gap') {
        const parts = (q.prompt || '___').split('___');
        row.append(h('div', { class: 'gapline' }, h('b', { class: 'gapn' }, q.n), h('span', { html: md(parts[0]) }), gapInput(g, q, answers, onChange), parts[1] ? h('span', { html: md(parts[1]) }) : null));
      } else if (g.type === 'match') {
        row.append(h('div', { class: 'row match-row' },
          h('div', { class: 'grow' }, h('b', { class: 'gapn' }, q.n), h('span', { html: md(q.prompt) })),
          h('select', { class: 'gap gap-sel', 'aria-label': `Soru ${q.n}`, onchange: (e) => { answers[q.id] = e.target.value || null; onChange(); } },
            h('option', { value: '' }, 'seç'), g.options.map((o) => h('option', { value: o.key, selected: answers[q.id] === o.key }, o.key)))));
      } else {
        const keys = g.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : g.type === 'ynng' ? ['YES', 'NO', 'NOT GIVEN'] : LETTERS.slice(0, q.options.length);
        row.append(h('p', { class: 'qprompt' }, h('b', { class: 'gapn' }, q.n), h('span', { html: md(q.prompt) })),
          optionButtons(keys, g.type === 'mcq' ? q.options : null, answers[q.id], (v) => { answers[q.id] = v; onChange(); }));
        if (g.type !== 'mcq') row.querySelector('.options').classList.add('options-inline');
      }
      box.append(row);
    }
  }
  return box;
}

export function renderGroups(groups, answers, opts = {}) {
  return h('div', { class: 'qgroups' }, groups.map((g) => renderGroup(g, answers, opts)));
}

// Satır içi geri bildirim (pratik modu)
// Her cevap için: sonuç, doğru cevap, nedeni, metindeki kanıt ve (yanlışsa) hata türüne göre ders
export function feedbackBody(it, opts = {}) {
  const why = explainFor(it);
  const lesson = lessonFor(it);
  return [
    h('div', null, h('b', null, `${it.q.n}. ${it.ok ? '✓ Doğru' : '✗ ' + (KIND_TR[it.kind] || 'Yanlış')}`)),
    !it.ok ? h('div', { class: 'small' }, 'Senin cevabın: ', h('b', { class: 'txt-bad' }, it.given)) : null,
    h('div', { class: 'small' }, it.ok ? 'Cevap: ' : 'Doğru cevap: ', h('b', { class: 'txt-good' }, it.expected)),
    why ? h('div', { class: 'small fb-explain' }, h('b', null, '💡 Neden? '), h('span', { html: md(why) })) : null,
    it.q.quote && opts.showQuote !== false && !why.includes(it.q.quote) ? h('div', { class: 'small quote' }, '📌 ', h('i', null, `"${it.q.quote}"`)) : null,
    lesson ? h('div', { class: 'small fb-lesson' }, h('b', null, '🧭 Ders: '), h('span', { html: md(lesson) })) : null
  ];
}

export function feedbackEl(it, opts = {}) {
  const mood = it.ok ? 'happy' : it.kind === 'blank' ? 'think' : 'sad';
  const line = it.ok ? pick('correct') : it.kind === 'blank' ? pick('blank') : pick('wrong');
  return h('div', { class: 'feedback ' + (it.ok ? 'ok' : 'no') }, mascot(mood, line, ...feedbackBody(it, opts)));
}

export function lockGroups(root) {
  root.querySelectorAll('input.gap, select.gap').forEach((e) => { e.disabled = true; });
  root.querySelectorAll('.options').forEach((e) => e.classList.add('locked'));
}

export function markGroups(root, res) {
  for (const it of res.items) {
    const id = it.g.type === 'multi' ? it.g.questions[0].id : it.q.id;
    const el = root.querySelector(`[data-q="${id}"]`);
    if (!el) continue;
    el.classList.add(it.ok ? 'q-ok' : 'q-no');
    const inp = el.querySelector('.gap');
    if (inp) inp.classList.add(it.ok ? 'correct' : 'wrong');
    if (it.g.type !== 'gap' && it.g.type !== 'match') {
      const keys = it.g.type === 'multi' ? it.g.answers : [Array.isArray(it.q.answer) ? it.q.answer[0] : it.q.answer];
      el.querySelectorAll('.opt').forEach((b) => {
        if (keys.includes(b.dataset.key)) b.classList.add('correct');
        else if (b.classList.contains('sel')) b.classList.add('wrong');
      });
    }
  }
}

// ---------- Hata Defteri için tek soruluk grup ----------
export function snapshot(it, meta) {
  const g = it.g, q = it.q;
  let prompt = q.prompt;
  if (g.type === 'gap' && g.text) {
    const line = g.text.split('\n').find((l) => l.includes(`{{${q.n}}}`)) || '';
    prompt = line.replace(/^#\s*/, '').replace(`{{${q.n}}}`, '___').replace(/\{\{\d+\}\}/g, '…');
  }
  const base = {
    type: g.type, subtype: g.subtype, instructions: g.instructions, maxWords: g.maxWords, number: g.number, limitText: g.limitText,
    options: g.options, bank: g.bank
  };
  if (g.type === 'multi') {
    return { id: g.questions[0].id + '-multi', ...meta, qtype: qType(g), group: { ...base, prompt: g.prompt, answers: g.answers, questions: g.questions.map((x, i) => ({ id: x.id, n: i + 1, explain: x.explain })) },
      explain: g.questions[0].explain, quote: g.questions[0].quote };
  }
  return { id: q.id, ...meta, qtype: qType(g), group: { ...base, questions: [{ ...q, n: 1, prompt }] }, explain: q.explain, quote: q.quote };
}
