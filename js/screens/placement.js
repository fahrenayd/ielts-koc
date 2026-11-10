// Seviye tespiti (≈35 dk): Listening + Reading + Writing paragrafı + Speaking Part 1 → tahmini bandlar ve haftalık plan
import { h, topbar, ask } from '../util.js';
import { db, getKV, setKV } from '../db.js';
import { state } from '../store.js';
import { loadItem } from '../content.js';
import { runListening } from './listening.js';
import { runReading } from './reading.js';
import { runWriting, saveWriting, evalPanel } from './writing.js';
import { runSpeaking } from './speaking.js';
import { saveOutcome, estimateBand, scoreCard } from '../results.js';
import { analyzeWriting, writingPrompt, W_CRIT } from '../eval.js';
import { weeklyPlan, SKILLS, SKILL_TR } from '../planner.js';
import { overallBand, fmtBand } from '../scoring.js';

const W_TASK = {
  id: 'w-place', task: 2, kind: 'opinion', title: 'Seviye tespiti paragrafı',
  prompt: 'Some people believe that university students should study whatever they like, while others think they should only study subjects that will be useful in the future, such as science and technology.\n\n**Seviye tespiti için:** Bu soruya kendi görüşünü veren TEK bir gövde paragrafı yaz (~120–150 kelime, 12 dk).'
};
const SP_STEPS = [
  { part: 'Part 1', q: 'Let\'s talk about where you live. Do you live in a house or an apartment?' },
  { part: 'Part 1', q: 'What do you like most about your neighbourhood?' },
  { part: 'Part 1', q: 'How do you usually spend your weekends?' },
  { part: 'Part 1', q: 'Is there anything you would like to learn in the future? Why?' }
];

export async function render() {
  const prev = await getKV('placement', null);
  const root = h('div');
  const bands = {};
  let resultsEl = null;

  function intro() {
    root.replaceChildren(
      topbar('🧭 Seviye tespiti'),
      prev ? h('div', { class: 'card small' }, `Son seviye tespitin: ${new Date(prev.date).toLocaleDateString('tr-TR')}. Yeniden yaparsan planın güncellenir.`) : h('span'),
      h('div', { class: 'card' },
        h('p', null, 'Yaklaşık 35 dakika, sessiz bir yer ve kulaklık gerekiyor. Dört kısım var:'),
        h('ol', { class: 'small' },
          h('li', null, '🎧 Listening: 1 bölüm, ses bir kez çalar (~8 dk)'),
          h('li', null, '📖 Reading: 1 kısa pasaj, 15 dk'),
          h('li', null, '✍️ Writing: tek paragraf, 12 dk (değerlendirme Claude ile, isteğe bağlı)'),
          h('li', null, '🗣️ Speaking: 4 kısa Part 1 sorusu (mikrofon)')),
        h('p', { class: 'small muted' }, 'Az soru olduğu için sonuç kaba bir tahmindir; pratik yaptıkça bandların güncellenir.')),
      h('div', { class: 'bottom-bar' }, h('button', { class: 'btn primary block', onclick: listening }, 'Başla')));
  }

  async function listening() {
    const it = await loadItem('placement', 'l00');
    root.replaceChildren(runListening({ items: [it], mode: 'exam', title: '1/4 · Listening', checkSeconds: 60, onDone: async (res) => {
      bands.listening = estimateBand('listening', res);
      await saveOutcome({ module: 'listening', itemIds: ['l00'], title: 'Seviye tespiti', res, mode: 'placement' });
      between(`Listening: ${res.correct}/${res.total} doğru`, reading);
    } }));
  }

  async function reading() {
    const it = await loadItem('placement', 'r00');
    root.replaceChildren(runReading({ items: [it], mode: 'exam', minutes: 15, title: '2/4 · Reading', onDone: async (res) => {
      bands.reading = estimateBand('reading', res);
      await saveOutcome({ module: 'reading', itemIds: ['r00'], title: 'Seviye tespiti', res, mode: 'placement' });
      between(`Reading: ${res.correct}/${res.total} doğru`, writing);
    } }));
  }

  function writing() {
    root.replaceChildren(runWriting({ tasks: [W_TASK], minutes: 12, onDone: async ([r]) => {
      const id = await saveWriting(W_TASK, r.text, r.seconds, { placement: true });
      const w = await db.get('writings', id);
      const findings = analyzeWriting(r.text, 2).filter((f) => f.level !== 'good').slice(0, 4);
      root.replaceChildren(topbar('3/4 · Writing değerlendirmesi', { back: false }),
        h('p', { class: 'small muted' }, 'Claude ile değerlendirirsen Writing bandın da tahmin edilir. Şimdi yapmak istemezsen atla; Writing ölçülmemiş olarak işaretlenir ve planın ona öncelik verir.'),
        findings.length ? h('div', { class: 'card' }, h('h3', null, '⚡ Hızlı kontrol'), findings.map((f) => h('div', { class: 'finding ' + f.level }, f.text))) : null,
        evalPanel({ crit: W_CRIT, buildPrompt: () => writingPrompt({ task: 2, kind: 'Opinion — seviye tespiti için tek gövde paragrafı (tam essay değil; kelime sınırı ve yapı eksikliğini cezalandırma)', prompt: W_TASK.prompt, text: r.text, minutes: 12 }),
          onSaved: async (ev) => {
            bands.writing = ev.overall;
            await db.put('writings', { ...w, eval: ev });
            await db.put('results', { module: 'writing', itemIds: ['w-place'], title: 'Seviye tespiti', mode: 'placement', date: new Date().toISOString(), band: ev.overall, criteria: ev.criteria });
          } }),
        h('div', { class: 'bottom-bar' }, h('button', { class: 'btn primary block', onclick: speaking }, 'Speaking\'e geç')));
    } }));
  }

  function speaking() {
    let done = false;
    root.replaceChildren(runSpeaking({ title: '4/4 · Speaking', steps: SP_STEPS, examiner: true, onDone: (session) => {
      if (done) return;
      done = true;
      bands.speaking = session.eval ? session.eval.overall : session.selfBand ?? null;
      if (!session.eval && session.selfBand != null) db.put('results', { module: 'speaking', itemIds: [], title: 'Seviye tespiti (öz değerlendirme)', mode: 'placement', date: new Date().toISOString(), band: session.selfBand });
      finish();
    } }));
  }

  function between(msg, next) {
    root.replaceChildren(topbar('Kısa mola', { back: false }), h('div', { class: 'card center' }, h('div', { style: { fontSize: '2.5rem' } }, '✅'), h('p', null, msg), h('p', { class: 'small muted' }, 'Ayrıntılı açıklamaları sonuç ekranında ve Hata Defteri\'nde görebilirsin.')),
      h('div', { class: 'bottom-bar' }, h('button', { class: 'btn primary block', onclick: next }, 'Devam')));
  }

  async function finish() {
    const p = state.profile;
    await setKV('placement', { date: new Date().toISOString(), bands });
    const known = SKILLS.every((s) => bands[s] != null);
    const overall = known ? overallBand(bands.listening, bands.reading, bands.writing, bands.speaking) : null;
    const plan = weeklyPlan(bands, p);
    root.replaceChildren(
      topbar('Seviye tespiti sonucu', { back: false }),
      h('div', { class: 'card hero center' }, h('div', { class: 'small muted' }, 'Tahmini genel band'), h('div', { class: 'big-num' }, overall != null ? fmtBand(overall) : '–'),
        h('div', { class: 'small muted' }, `Hedef ${fmtBand(p.targetOverall)} · her bölüm ≥ ${fmtBand(p.targetMin)}`)),
      h('div', { class: 'card' }, h('h3', null, 'Beceriler'), SKILLS.map((s) => {
        const b = bands[s];
        const gap = b != null ? p.targetMin - b : null;
        return h('div', { class: 'row spread', style: { padding: '8px 0', borderTop: '1px solid var(--line)' } },
          h('b', null, SKILL_TR[s]),
          h('span', null, b != null ? h('span', { class: 'band-pill sm' }, fmtBand(b)) : h('span', { class: 'pill' }, 'ölçülmedi'), ' ',
            gap != null ? h('span', { class: 'pill ' + (gap <= 0 ? 'good' : gap <= 1 ? 'warn' : '') }, gap <= 0 ? 'hedefte' : `+${fmtBand(gap)} gerekli`) : null));
      })),
      h('h2', null, 'Haftalık planın'),
      h('div', { class: 'card' }, plan.map((d) => h('div', { class: 'list-item', style: { display: 'block' } }, h('b', null, `${d.day} · ${d.minutes} dk`), h('div', { class: 'small muted' }, d.text)))),
      h('p', { class: 'small muted' }, 'Bugün ekranındaki görevler bu plana göre otomatik oluşur. Zayıf beceri haftada 3 kez gelir.'),
      h('a', { class: 'btn primary block', href: '#/today' }, 'Bugün ekranına git'));
  }

  intro();
  return root;
}
