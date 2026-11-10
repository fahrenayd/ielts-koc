// Deneme sınavı: gerçek sıra ve süreler (bilgisayarda IELTS). Bölümler arasında kalınan yerden devam edilebilir.
import { h, topbar, ask, toast } from '../util.js';
import { db, getKV, setKV } from '../db.js';
import { state } from '../store.js';
import { loadIndex, loadItem } from '../content.js';
import { runListening } from './listening.js';
import { runReading, externalCard } from './reading.js';
import { runWriting, saveWriting } from './writing.js';
import { runSpeaking, examinerSteps } from './speaking.js';
import { saveOutcome, estimateBand, renderResults } from '../results.js';
import { writingOverall } from '../eval.js';
import { overallBand, fmtBand } from '../scoring.js';
import { SKILLS, SKILL_TR } from '../planner.js';

// Deneme sınavında sorular gerçek sınavdaki gibi 1–40 numaralanır (önbellekteki içeriği bozmamak için kopya üzerinde)
function renumber(items) {
  let off = 0;
  return items.map((src) => {
    const it = structuredClone(src);
    for (const g of it.groups) {
      for (const q of g.questions) q.n += off;
      if (g.text) g.text = g.text.replace(/\{\{(\d+)\}\}/g, (_, d) => `{{${Number(d) + off}}}`);
    }
    off += it.groups.reduce((a, g) => a + g.questions.length, 0);
    return it;
  });
}
const STAGE_TR = { listening: '🎧 Listening (~32 dk)', reading: '📖 Reading (60 dk)', writing: '✍️ Writing (60 dk)', speaking: '🗣️ Speaking (~12 dk)' };

export async function render() {
  const [idx, results] = await Promise.all([loadIndex(), db.all('results')]);
  const mocks = idx.mocks || [];
  const states = await Promise.all(mocks.map((m) => getKV('mock:' + m.id, null)));
  const history = results.filter((r) => r.module === 'mock' || r.mode === 'external').sort((a, b) => b.date.localeCompare(a.date));
  return h('div', null,
    h('h1', null, 'Deneme'),
    h('a', { class: 'card tap row', href: '#/placement', style: { marginTop: '12px' } }, h('span', { class: 'emoji' }, '🧭'),
      h('span', { class: 'grow' }, h('b', null, 'Seviye tespiti (~35 dk)'), h('div', { class: 'small muted' }, 'Kısa L + R + W + S, kişisel plan')), h('span', { class: 'chev' }, '›')),
    h('h2', null, 'Tam deneme sınavları'),
    h('p', { class: 'small muted' }, 'Gerçek sıra: Listening → Reading → Writing (arada mola yok), Speaking ayrı. Uygulamayı kapatırsan bitirdiğin bölümler kayıtlı kalır.'),
    mocks.map((m, i) => {
      const st = states[i];
      const stage = st ? st.stage : null;
      return h('div', { class: 'card' },
        h('div', { class: 'row spread' }, h('h3', { style: { margin: 0 } }, m.title), stage === 'done' ? h('span', { class: 'band-pill sm' }, fmtBand(st.overall)) : stage ? h('span', { class: 'pill warn' }, 'devam ediyor') : null),
        h('p', { class: 'small muted' }, m.desc),
        stage && stage !== 'done' ? h('a', { class: 'btn primary block', href: '#/mock/' + m.id }, `Devam et: ${STAGE_TR[stage]}`) : null,
        stage === 'done' ? h('a', { class: 'btn ghost block', href: '#/mock/' + m.id }, 'Sonucu gör / Writing bandını tamamla') : null,
        h('button', { class: 'btn ' + (stage && stage !== 'done' ? 'ghost' : 'primary') + ' block', style: { marginTop: '8px' }, onclick: async () => {
          if (stage && stage !== 'done' && !(await ask('Bu denemeyi baştan başlatmak ilerlemeyi siler. Emin misin?', { ok: 'Baştan başlat', danger: true }))) return;
          await setKV('mock:' + m.id, { stage: 'listening', started: new Date().toISOString(), bands: {} });
          location.hash = '#/mock/' + m.id;
        } }, stage === 'done' ? 'Tekrar çöz' : stage ? 'Baştan başlat' : 'Başla'));
    }),
    h('h2', null, 'Dış test sonucu ekle'),
    externalForm(),
    history.length ? h('div', null, h('h2', null, 'Geçmiş'), h('div', { class: 'card' }, history.map((r) => h('div', { class: 'list-item' },
      h('span', { class: 'grow' }, h('b', null, r.title), h('div', { class: 'small muted' }, new Date(r.date).toLocaleDateString('tr-TR') + (r.bands ? ' · ' + SKILLS.map((s) => `${SKILL_TR[s][0]} ${fmtBand(r.bands[s])}`).join(' ') : ''))),
      h('span', { class: 'band-pill sm' }, fmtBand(r.band ?? r.overall)))))) : null,
    externalCard());
}

function externalForm() {
  const mod = h('select', null, SKILLS.map((s) => h('option', { value: s }, SKILL_TR[s])));
  const band = h('input', { type: 'number', min: 1, max: 9, step: 0.5, inputmode: 'decimal', placeholder: 'ör. 6.5' });
  const src = h('input', { type: 'text', placeholder: 'Kaynak (ör. IELTS Online Tests, Test 3)' });
  return h('div', { class: 'card' },
    h('p', { class: 'small muted' }, 'Başka sitelerde veya kitaplarda çözdüğün testlerin bandını ekle; ilerleme grafiğine ve planına yansır.'),
    h('div', { class: 'grid2' }, h('label', { class: 'field' }, h('span', null, 'Bölüm'), mod), h('label', { class: 'field' }, h('span', null, 'Band'), band)),
    h('label', { class: 'field' }, h('span', null, 'Kaynak'), src),
    h('button', { class: 'btn ghost block', onclick: async () => {
      const b = Math.round(Number(band.value) * 2) / 2;
      if (!(b >= 1 && b <= 9)) return toast('1 ile 9 arasında bir band gir.');
      await db.put('results', { module: mod.value, itemIds: [], title: src.value || 'Dış test', mode: 'external', date: new Date().toISOString(), band: b });
      toast('Eklendi.'); band.value = ''; src.value = '';
    } }, 'Ekle'));
}

export async function renderRun(id) {
  const idx = await loadIndex();
  const m = (idx.mocks || []).find((x) => x.id === id);
  if (!m) throw new Error('Deneme bulunamadı.');
  const key = 'mock:' + id;
  let st = await getKV(key, null);
  if (!st) { st ={ stage: 'listening', started: new Date().toISOString(), bands: {} }; await setKV(key, st); }
  const root = h('div');
  const save = () => setKV(key, st);
  const advance = async (next) => { st.stage = next; await save(); go(); };

  async function go() {
    window.scrollTo(0, 0);
    if (st.stage === 'listening') {
      const items = renumber(await Promise.all(m.listening.map((x) => loadItem('listening', x))));
      root.replaceChildren(runListening({ items, mode: 'exam', title: `${m.title} · Listening`, onDone: async (res) => {
        st.bands.listening = estimateBand('listening', res);
        await saveOutcome({ module: 'listening', itemIds: m.listening, title: m.title + ' Listening', res, mode: 'mock', seconds: 1900 });
        breakScreen('Listening bitti', `${res.correct}/40 doğru · tahmini band ${fmtBand(st.bands.listening)}`, () => advance('reading'), { res, items, module: 'listening' });
      } }));
    } else if (st.stage === 'reading') {
      const items = renumber(await Promise.all(m.reading.map((x) => loadItem('reading', x))));
      root.replaceChildren(runReading({ items, mode: 'exam', minutes: 60, title: `${m.title} · Reading`, onDone: async (res) => {
        st.bands.reading = estimateBand('reading', res);
        await saveOutcome({ module: 'reading', itemIds: m.reading, title: m.title + ' Reading', res, mode: 'mock', seconds: 3600 });
        breakScreen('Reading bitti', `${res.correct}/${res.total} doğru · tahmini band ${fmtBand(st.bands.reading)}`, () => advance('writing'), { res, items, module: 'reading' });
      } }));
    } else if (st.stage === 'writing') {
      const tasks = await Promise.all(m.writing.map((x) => loadItem('writing', x)));
      root.replaceChildren(runWriting({ tasks, minutes: 60, onDone: async (rs) => {
        st.writingIds = [];
        for (let i = 0; i < tasks.length; i++) st.writingIds.push(await saveWriting(tasks[i], rs[i].text, rs[i].seconds, { mock: id }));
        await save();
        breakScreen('Writing bitti', 'Metinlerin arşive kaydedildi. Bandı almak için sonuç ekranından her iki görevi Claude ile değerlendir.', () => advance('speaking'));
      } }));
    } else if (st.stage === 'speaking') {
      const [p1, p2] = await Promise.all([loadItem('speaking', 'part1'), loadItem('speaking', 'part2')]);
      let done = false;
      root.replaceChildren(runSpeaking({ title: `${m.title} · Speaking`, examiner: true, ...examinerSteps(p1, p2), onDone: async (session) => {
        if (done) return;
        done = true;
        st.speakingId = session.id;
        await advance('done');
      } }));
    } else {
      root.replaceChildren(await finalScreen(m, st, save));
    }
  }

  function breakScreen(title, msg, next, review) {
    root.replaceChildren(topbar(title, { back: false }),
      h('div', { class: 'card center' }, h('div', { style: { fontSize: '2.5rem' } }, '✅'), h('p', null, msg)),
      review ? h('details', { class: 'card' }, h('summary', null, 'Cevapları şimdi incele (sınavda bu yapılamaz)'), renderResults({ title: '', module: review.module, res: review.res, band: null, items: review.items })) : null,
      h('div', { class: 'bottom-bar' }, h('button', { class: 'btn primary block', onclick: next }, 'Sonraki bölüme geç')));
  }

  go();
  return root;
}

async function finalScreen(m, st, save) {
  const ws = await Promise.all((st.writingIds || []).map((id) => db.get('writings', id)));
  const t1 = ws.find((w) => w && w.task === 1)?.eval?.overall ?? null;
  const t2 = ws.find((w) => w && w.task === 2)?.eval?.overall ?? null;
  const sp = st.speakingId ? await db.get('speaking', st.speakingId) : null;
  const bands = {
    listening: st.bands.listening, reading: st.bands.reading,
    writing: t1 != null && t2 != null ? writingOverall(t1, t2) : null,
    speaking: sp?.eval?.overall ?? sp?.selfBand ?? null
  };
  const all = SKILLS.every((s) => bands[s] != null);
  const overall = all ? overallBand(bands.listening, bands.reading, bands.writing, bands.speaking) : null;
  if (all && st.overall !== overall) {
    st.overall = overall;
    await save();
    await db.put('results', { module: 'mock', itemIds: [m.id], title: m.title, mode: 'mock', date: new Date().toISOString(), band: overall, bands });
  }
  const p = state.profile;
  return h('div', null,
    topbar(m.title + ' sonucu', { back: false }),
    h('div', { class: 'card hero center' }, h('div', { class: 'small muted' }, 'Genel band'), h('div', { class: 'big-num' }, overall != null ? fmtBand(overall) : '–'),
      h('div', { class: 'small muted' }, all ? 'Dört bölümün ortalaması, resmi yuvarlama kuralıyla' : 'Eksik bölüm bandları tamamlanınca hesaplanır')),
    h('div', { class: 'card' }, SKILLS.map((s) => h('div', { class: 'row spread', style: { padding: '8px 0', borderTop: '1px solid var(--line)' } },
      h('b', null, SKILL_TR[s]),
      bands[s] != null ? h('span', { class: 'band-pill sm' + (bands[s] < p.targetMin ? ' low' : '') }, fmtBand(bands[s])) : h('span', { class: 'pill warn' }, 'değerlendirilmedi')))),
    bands.writing == null ? h('div', { class: 'card' }, h('h3', null, 'Writing bandını tamamla'),
      h('p', { class: 'small muted' }, 'Her görevi Claude ile değerlendir; sonra bu ekrana dön. Writing bandı: Task 2 iki kat ağırlıklı (doğrulanmalı).'),
      ws.filter(Boolean).map((w) => h('a', { class: 'btn ghost block', style: { marginTop: '8px' }, href: '#/writing-review/' + w.id }, `Task ${w.task} ${w.eval ? '✓ ' + fmtBand(w.eval.overall) : '→ değerlendir'}`))) : null,
    bands.speaking == null && sp ? h('p', { class: 'small muted' }, 'Speaking: oturum özetinde öz-değerlendirme veya Claude değerlendirmesi yapılmadı.') : null,
    h('a', { class: 'btn primary block', href: '#/mock', style: { marginTop: '12px' } }, 'Deneme ekranı'));
}
