// Writing: Task 1 ve Task 2, zamanlayıcı, kelime sayacı, planlama, internetsiz analiz, Claude ile ücretsiz değerlendirme
import { h, topbar, mdEl, fmtTime, countdown, onLeave, countWords, copyText, toast, ask } from '../util.js';
import { db, getKV, setKV } from '../db.js';
import { logDay } from '../store.js';
import { listItems, loadItem } from '../content.js';
import { renderChart, chartText } from '../charts.js';
import { analyzeWriting, writingPrompt, parseResult, W_CRIT } from '../eval.js';
import { fmtBand } from '../scoring.js';
import { mascot } from '../mascot.js';

const KIND_TR = { line: 'Çizgi grafik', bar: 'Sütun grafik', pie: 'Pasta grafik', table: 'Tablo', process: 'Süreç', map: 'Harita',
  opinion: 'Opinion (agree/disagree)', discussion: 'Discussion (both views)', problem: 'Problem–Solution', advdis: 'Advantages–Disadvantages', twopart: 'Two-part question' };
export const kindName = (k) => KIND_TR[k] || k;

export async function renderHome() {
  const [list, writings] = await Promise.all([listItems('writing'), db.all('writings')]);
  const done = new Set(writings.map((w) => w.taskId));
  const item = (m) => h('a', { class: 'list-item', href: '#/writing/' + m.id },
    h('span', { class: 'emoji' }, m.task === 1 ? '📊' : '📝'),
    h('span', { class: 'grow' }, h('b', null, m.title), h('div', { class: 'small muted' }, kindName(m.kind) + (m.model ? ' · örnek cevaplı' : ''))),
    done.has(m.id) ? h('span', { class: 'pill good' }, 'yazıldı') : null, h('span', { class: 'chev' }, '›'));
  return h('div', null,
    topbar('✍️ Writing'),
    h('div', { class: 'card small' }, h('b', null, 'Gerçek sınav: '), '60 dakika. Task 1 (150+ kelime, ~20 dk) ve Task 2 (250+ kelime, ~40 dk). Task 2 puanın iki katı ağırlıktadır.',
      h('p', { class: 'muted', style: { margin: '6px 0 0' } }, '💡 Değerlendirme ücretsiz: metnini yazdıktan sonra "Claude ile değerlendir" ile claude.ai\'ye yapıştırıp sonucu geri alırsın.')),
    h('div', { class: 'grid2', style: { marginTop: '12px' } },
      h('a', { class: 'card tap center', href: '#/writing-archive' }, h('div', { style: { fontSize: '1.6rem' } }, '🗂️'), h('b', null, 'Arşivim'), h('div', { class: 'small muted' }, `${writings.length} metin`)),
      h('a', { class: 'card tap center', href: '#/writing-library' }, h('div', { style: { fontSize: '1.6rem' } }, '🧱'), h('b', null, 'Kalıp kütüphanesi'), h('div', { class: 'small muted' }, 'iskelet & ifadeler'))),
    h('h2', null, 'Task 1 — Academic'), h('div', { class: 'card' }, list.filter((m) => m.task === 1).map(item)),
    h('h2', null, 'Task 2 — Essay'), h('div', { class: 'card' }, list.filter((m) => m.task === 2).map(item)));
}

export async function renderTask(id) {
  const t = await loadItem('writing', id);
  return h('div', null,
    topbar(`Task ${t.task}: ${t.title}`),
    h('p', null, h('span', { class: 'pill primary' }, kindName(t.kind)), ' ', h('span', { class: 'pill' }, `${t.task === 1 ? 20 : 40} dk · ${t.task === 1 ? 150 : 250}+ kelime`)),
    taskPrompt(t),
    t.tip ? h('div', { class: 'card small' }, '💡 ', h('span', { html: '' }), mdEl('span', t.tip)) : null,
    h('a', { class: 'btn primary block', href: `#/writing/${id}/plan`, style: { marginTop: '12px' } }, '🗺️ 5 dk planla, sonra yaz'),
    h('a', { class: 'btn ghost block', href: `#/writing/${id}/write`, style: { marginTop: '8px' } }, `⏱️ Doğrudan yaz (${t.task === 1 ? 20 : 40} dk)`),
    t.model ? h('a', { class: 'btn ghost block', href: `#/writing/${id}/models`, style: { marginTop: '8px' } }, '📚 Örnek cevaplar' + (t.band6 ? ' (band 6 vs 8)' : '')) : null);
}

export function taskPrompt(t) {
  return h('div', null,
    h('div', { class: 'card task-prompt' }, mdEl('p', t.prompt), t.task === 1 ? h('p', { class: 'small muted', style: { margin: 0 } }, 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.')
      : h('p', { class: 'small muted', style: { margin: 0 } }, 'Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.')),
    t.chart ? renderChart(t.chart) : null);
}

export async function renderModels(id) {
  const t = await loadItem('writing', id);
  return h('div', null,
    topbar('Örnek cevaplar'),
    taskPrompt(t),
    t.band6 ? h('div', null, h('h2', null, 'Band 6 cevap'), h('div', { class: 'card essay' }, t.band6.split('\n').map((p) => h('p', null, p))),
      t.compare ? h('div', { class: 'card' }, h('h3', null, 'Band 6 → Band 8: farklar'),
        t.compare.map((c) => h('div', { class: 'example' }, h('div', { class: 'wrong' }, c.b6), h('div', { class: 'right' }, c.b8), mdEl('div', c.why, 'small muted')))) : null) : null,
    h('h2', null, `Band ${t.modelBand || '8+'} örnek`),
    h('div', { class: 'card essay' }, t.model.split('\n').map((p) => h('p', null, p))),
    t.modelNotes ? h('div', { class: 'card small' }, h('h3', null, 'Neden yüksek band?'), t.modelNotes.map((n) => mdEl('p', '• ' + n))) : null);
}

export async function renderLibrary() {
  const lib = await loadItem('writing', 'library');
  return h('div', null, topbar('🧱 Kalıp kütüphanesi'),
    h('p', { class: 'small muted' }, lib.intro),
    lib.sections.map((s) => h('div', { class: 'card' }, h('h3', null, s.h),
      s.note ? mdEl('p', s.note, 'small muted') : null,
      (s.items || []).map((x) => h('div', { class: 'lib-item' }, mdEl('div', x.en), x.tr ? h('div', { class: 'small muted' }, x.tr) : null)),
      (s.warn || []).map((x) => h('div', { class: 'example' }, h('div', { class: 'wrong' }, x.bad), h('div', { class: 'right' }, x.good), x.why ? mdEl('div', x.why, 'small muted') : null)))));
}

// ---------- Planlama ----------
export async function renderPlan(id) {
  const t = await loadItem('writing', id);
  const key = 'plan:' + id;
  const plan = await getKV(key, { thesis: '', ideas: '', examples: '' });
  const field = (name, label, ph) => h('label', { class: 'field' }, h('span', null, label),
    h('textarea', { rows: 3, placeholder: ph, oninput: (e) => { plan[name] = e.target.value; setKV(key, plan); } }, plan[name]));
  const timerEl = h('b', { class: 'timer' });
  const cd = countdown(300, (l) => { timerEl.textContent = '⏱ ' + fmtTime(l); }, () => toast('Planlama süresi doldu, yazmaya geç.'));
  onLeave(() => cd.stop());
  return h('div', null,
    h('div', { class: 'topbar' }, h('button', { class: 'icon-btn', onclick: () => history.back() }, '←'), h('h1', null, 'Planlama'), timerEl),
    taskPrompt(t),
    h('div', { class: 'card' },
      t.task === 1 ? field('thesis', 'Overview: en önemli 2 eğilim', 'Overall, … while …') : field('thesis', 'Tez cümlesi (pozisyonun)', 'I believe that … because …'),
      field('ideas', t.task === 1 ? 'Detay paragraflarının gruplanması' : '2–3 ana fikir', t.task === 1 ? 'Paragraf 2: … / Paragraf 3: …' : '1) … 2) …'),
      field('examples', t.task === 1 ? 'Kullanacağın önemli sayılar' : 'Örnekler / açıklamalar', '…')),
    h('a', { class: 'btn primary block', href: `#/writing/${id}/write` }, 'Yazmaya başla'));
}

// ---------- Yazma ----------
export async function renderWrite(id) {
  const t = await loadItem('writing', id);
  const plan = await getKV('plan:' + id, null);
  const root = h('div');
  root.append(runWriting({
    tasks: [t], plan,
    onDone: async ([r]) => {
      const rec = await saveWriting(t, r.text, r.seconds);
      location.hash = `#/writing-review/${rec}`;
    }
  }));
  return root;
}

export async function saveWriting(t, text, seconds, extra = {}) {
  const rec = { taskId: t.id, task: t.task, kind: t.kind, title: t.title, prompt: t.prompt, chartText: t.chart ? chartText(t.chart) : '', text, words: countWords(text), minutes: Math.round(seconds / 60), date: new Date().toISOString(), ...extra };
  const id = await db.put('writings', rec);
  await setKV('draft:' + t.id, '');
  await logDay({ seconds: Math.min(seconds, 3900), done: 'writing' });
  return id;
}

// tasks: 1 veya 2 görev (deneme sınavında ikisi birlikte, toplam 60 dk)
export function runWriting({ tasks, minutes, plan, onDone }) {
  const total = (minutes || tasks.reduce((a, t) => a + (t.task === 1 ? 20 : 40), 0)) * 60;
  const t0 = Date.now();
  let cur = 0, finished = false;
  const texts = tasks.map(() => '');
  const timerEl = h('b', { class: 'timer' });
  const wcEl = h('span', { class: 'pill' });
  const area = h('textarea', { class: 'essay-input', spellcheck: 'false', autocapitalize: 'sentences', autocorrect: 'off', placeholder: 'Write your answer here…' });
  const promptBox = h('div');
  const tabs = tasks.length > 1 ? h('div', { class: 'seg' }, tasks.map((t, i) => h('button', { type: 'button', class: i === 0 ? 'on' : '', onclick: (e) => switchTo(i, e) }, `Task ${t.task}`))) : null;
  const min = () => (tasks[cur].task === 1 ? 150 : 250);
  function updateWC() {
    const n = countWords(area.value);
    wcEl.textContent = `${n} / ${min()}+ kelime`;
    wcEl.className = 'pill ' + (n >= min() ? 'good' : 'warn');
  }
  function switchTo(i, e) {
    texts[cur] = area.value;
    cur = i;
    area.value = texts[i];
    if (tabs) tabs.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
    showPrompt();
    updateWC();
  }
  function showPrompt() {
    const t = tasks[cur];
    promptBox.replaceChildren(h('details', { class: 'card', open: true }, h('summary', null, h('b', null, `Task ${t.task} sorusu`)), taskPrompt(t),
      plan && tasks.length === 1 ? h('div', { class: 'small muted' }, h('b', null, 'Planın: '), [plan.thesis, plan.ideas, plan.examples].filter(Boolean).join(' · ')) : null));
  }
  // Taslağı otomatik kaydet (uygulama kapanırsa kaybolmasın)
  Promise.all(tasks.map((t) => getKV('draft:' + t.id, ''))).then((ds) => {
    ds.forEach((d, i) => { if (d && !texts[i]) texts[i] = d; });
    area.value = texts[cur]; updateWC();
    if (ds.some(Boolean)) toast('Kaydedilmiş taslak yüklendi.');
  });
  let saveT;
  area.addEventListener('input', () => {
    updateWC();
    clearTimeout(saveT);
    saveT = setTimeout(() => setKV('draft:' + tasks[cur].id, area.value), 800);
  });
  async function finish(force) {
    if (finished) return;
    texts[cur] = area.value;
    if (!force) {
      const short = tasks.filter((t, i) => countWords(texts[i]) < (t.task === 1 ? 150 : 250)).length;
      if (!(await ask(short ? 'Kelime sınırının altında görev var. Yine de bitirilsin mi?' : 'Yazmayı bitir?', { ok: 'Bitir' }))) return;
    }
    finished = true;
    cd.stop();
    const seconds = (Date.now() - t0) / 1000;
    onDone(tasks.map((t, i) => ({ text: texts[i], seconds: seconds / tasks.length })));
  }
  const cd = countdown(total, (l) => {
    timerEl.textContent = '⏱ ' + fmtTime(l);
    timerEl.classList.toggle('urgent', l <= 300);
    if (l === 0) toast('Süre doldu! Gerçek sınavda kalem bırakılır. İstersen bitirebilirsin.');
  }, null);
  onLeave(() => { cd.stop(); clearTimeout(saveT); texts[cur] = area.value; tasks.forEach((t, i) => setKV('draft:' + t.id, texts[i])); });
  showPrompt();
  updateWC();
  return h('div', { class: 'runner' },
    h('div', { class: 'runbar' }, h('div', { class: 'row spread' }, h('b', null, 'Writing'), timerEl), tabs, h('div', { class: 'row spread' }, wcEl, h('span', { class: 'small muted' }, 'Yazım denetimi kapalı (sınavdaki gibi)'))),
    promptBox, area,
    h('div', { class: 'bottom-bar' }, h('button', { class: 'btn primary block', onclick: () => finish(false) }, 'Bitir')));
}

// ---------- Claude ile ücretsiz değerlendirme paneli (Writing ve Speaking ortak) ----------
export function evalPanel({ buildPrompt, crit, existing, onSaved }) {
  const out = h('div');
  const area = h('textarea', { rows: 5, placeholder: 'Claude\'un cevabının tamamını buraya yapıştır…' });
  const err = h('p', { class: 'small txt-bad' });
  const show = (r) => out.replaceChildren(resultCard(r, crit));
  if (existing) show(existing);
  return h('div', { class: 'card eval' },
    h('h3', null, '🤖 Claude ile değerlendir (ücretsiz)'),
    h('ol', { class: 'small steps' },
      h('li', null, '"Kopyala ve Claude\'u aç"a bas: değerlendirme talimatı + metnin panoya kopyalanır.'),
      h('li', null, 'Claude\'da yeni sohbete yapıştır ve gönder.'),
      h('li', null, 'Gelen cevabın tamamını kopyala, aşağıya yapıştır, "Sonucu kaydet"e bas.')),
    h('button', { class: 'btn primary block', onclick: async () => {
      const ok = await copyText(buildPrompt());
      toast(ok ? 'Kopyalandı. Claude\'a yapıştır.' : 'Kopyalanamadı; tarayıcı izin vermedi.');
      if (ok) window.open('https://claude.ai/new', '_blank', 'noopener');
    } }, '📋 Kopyala ve Claude\'u aç'),
    h('button', { class: 'btn ghost block', style: { marginTop: '8px' }, onclick: async () => {
      const ok = await copyText(buildPrompt());
      toast(ok ? 'Prompt kopyalandı.' : 'Kopyalanamadı.');
    } }, 'Sadece kopyala'),
    h('label', { class: 'field', style: { marginTop: '12px' } }, h('span', null, 'Claude\'un cevabı'), area),
    err,
    h('button', { class: 'btn primary block', onclick: async () => {
      try {
        const r = parseResult(area.value, crit.map((c) => c[0]));
        err.textContent = '';
        await onSaved(r);
        show(r);
        area.value = '';
        toast('Değerlendirme kaydedildi.');
      } catch (e) { err.textContent = e.message; }
    } }, 'Sonucu kaydet'),
    out);
}

export function resultCard(r, crit) {
  return h('div', { class: 'result-card' },
    h('div', { class: 'row spread' }, h('h3', { style: { margin: 0 } }, 'Değerlendirme'), h('span', { class: 'band-pill' }, `Band ${fmtBand(r.overall)}`)),
    h('div', { class: 'crit-grid' }, crit.map(([k, name]) => h('div', { class: 'kpi' }, h('b', null, r.criteria[k] == null ? '–' : fmtBand(r.criteria[k])), h('span', null, name)))),
    r.improvements.length ? h('div', null, h('h3', null, 'Bir band yukarı için'), h('ol', { class: 'small' }, r.improvements.map((x) => h('li', null, x)))) : null,
    r.corrections.length ? h('div', null, h('h3', null, 'Düzeltmeler'), r.corrections.map((c) => h('div', { class: 'example' },
      h('div', { class: 'wrong' }, c.original), h('div', { class: 'right' }, c.better), c.why ? h('div', { class: 'small muted' }, c.why) : null))) : null);
}

// ---------- Yazı sonrası inceleme ----------
export async function renderReview(recId) {
  const w = await db.get('writings', Number(recId));
  if (!w) throw new Error('Metin bulunamadı.');
  const findings = analyzeWriting(w.text, w.task);
  const t = await loadItem('writing', w.taskId).catch(() => null);
  return h('div', null,
    topbar(`Task ${w.task}: ${w.title}`),
    h('div', { class: 'card' }, h('div', { class: 'row spread' }, h('b', null, `${w.words} kelime`), h('span', { class: 'small muted' }, `${new Date(w.date).toLocaleDateString('tr-TR')} · ${w.minutes} dk`)),
      h('details', null, h('summary', { class: 'small' }, 'Metnimi göster'), h('div', { class: 'essay small' }, w.text.split('\n').map((p) => h('p', null, p))))),
    h('div', { class: 'card' }, h('h3', null, '⚡ Hızlı kontrol (internetsiz)'), mascot(findings.some((f) => f.level === 'bad') ? 'think' : 'happy', findings.some((f) => f.level === 'bad') ? 'Metnine baktım, düzeltilecek birkaç önemli nokta var. Band vermem ama bunlar puanını doğrudan etkiler 👇' : 'İlk kontrolden geçti! Şimdi asıl bandı görmek için Claude ile değerlendir.'),
      findings.map((f) => h('div', { class: 'finding ' + f.level }, f.text))),
    evalPanel({
      crit: W_CRIT, existing: w.eval,
      buildPrompt: () => writingPrompt({ task: w.task, kind: kindName(w.kind), prompt: w.prompt, chartText: w.chartText, text: w.text, minutes: w.minutes }),
      onSaved: async (r) => {
        await db.put('writings', { ...w, eval: r });
        await db.put('results', { module: 'writing', itemIds: [w.taskId], title: w.title, mode: w.mock ? 'mock' : 'practice', date: new Date().toISOString(), band: r.overall, task: w.task, criteria: r.criteria });
      }
    }),
    t && t.model ? h('a', { class: 'btn ghost block', href: `#/writing/${w.taskId}/models`, style: { marginTop: '12px' } }, '📚 Örnek cevapla karşılaştır') : null,
    h('a', { class: 'btn ghost block', href: '#/writing', style: { marginTop: '8px' } }, 'Writing ekranı'));
}

export async function renderArchive() {
  const list = (await db.all('writings')).sort((a, b) => b.date.localeCompare(a.date));
  return h('div', null, topbar('🗂️ Writing arşivim'),
    !list.length ? h('div', { class: 'card empty' }, 'Henüz metin yok.') : h('div', { class: 'card' }, list.map((w) => h('a', { class: 'list-item', href: '#/writing-review/' + w.id },
      h('span', { class: 'grow' }, h('b', null, `T${w.task} · ${w.title}`), h('div', { class: 'small muted' }, `${new Date(w.date).toLocaleDateString('tr-TR')} · ${w.words} kelime${w.mock ? ' · deneme' : ''}`)),
      w.eval ? h('span', { class: 'band-pill sm' }, fmtBand(w.eval.overall)) : h('span', { class: 'pill' }, 'puansız'), h('span', { class: 'chev' }, '›')))));
}
