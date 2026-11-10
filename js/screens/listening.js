// Listening: liste, pratik modu, sınav modu (ses bir kez). runListening deneme ve seviye tespitinde de kullanılır.
import { h, topbar, fmtTime, countdown, onLeave, ask, md } from '../util.js';
import { db } from '../db.js';
import { state } from '../store.js';
import { listItems, loadItem } from '../content.js';
import { renderGroups, grade, unanswered, markGroups, lockGroups, feedbackEl } from '../qengine.js';
import { saveOutcome, renderResults, estimateBand } from '../results.js';
import { createPlayer, stopSpeaking, ttsSupported, voiceCount } from '../tts.js';

const SECTION_TR = { 1: 'Günlük diyalog', 2: 'Günlük monolog', 3: 'Akademik tartışma', 4: 'Akademik ders' };

export async function renderList() {
  const [list, results] = await Promise.all([listItems('listening'), db.all('results')]);
  const best = {};
  for (const r of results) if (r.module === 'listening' && r.itemIds.length === 1 && r.mode !== 'placement') best[r.itemIds[0]] = Math.max(best[r.itemIds[0]] ?? -1, r.correct / r.total);
  return h('div', null,
    topbar('🎧 Listening'),
    h('div', { class: 'card small' },
      h('b', null, 'Gerçek sınav (bilgisayarda): '), '4 bölüm, 40 soru, ~30 dk. Her kayıt yalnızca bir kez çalar; sonda 2 dk kontrol süresi var.',
      h('p', { class: 'muted', style: { margin: '6px 0 0' } }, '🔊 Ses telefonun okuma motoruyla üretilir; gerçek kayıt kadar doğal değildir ama soru formatı ve tuzak pratiği için yeterlidir. Kulaklık önerilir.')),
    !ttsSupported() || !voiceCount() ? h('div', { class: 'card', style: { marginTop: '12px', borderColor: 'var(--warn)' } },
      h('p', { class: 'small', style: { margin: 0 } }, '⚠️ Bu cihazda İngilizce ses bulunamadı. Android Ayarlar → Sistem → Diller → Metin okuma çıkışı → Google → İngilizce sesleri indir.')) : null,
    h('h2', null, 'Bölümler'),
    h('div', { class: 'card' }, list.map((m) => h('a', { class: 'list-item', href: '#/listening/' + m.id },
      h('span', { class: 'emoji' }, `S${m.section}`),
      h('span', { class: 'grow' }, h('b', null, m.title), h('div', { class: 'small muted' }, `Section ${m.section} · ${SECTION_TR[m.section]} · ${m.questions} soru`)),
      best[m.id] != null ? h('span', { class: 'pill ' + (best[m.id] >= 0.75 ? 'good' : 'warn') }, `%${Math.round(best[m.id] * 100)}`) : h('span', { class: 'pill' }, 'yeni'),
      h('span', { class: 'chev' }, '›')))));
}

export async function renderIntro(id) {
  const it = await loadItem('listening', id);
  return h('div', null,
    topbar(`Section ${it.section}: ${it.title}`),
    h('div', { class: 'card' }, h('p', { class: 'small' }, it.context),
      h('p', { class: 'small muted', style: { margin: 0 } }, 'Konuşmacılar: ' + Object.values(it.speakers).map((s) => s.name).join(', '))),
    h('a', { class: 'btn primary block', href: `#/listening/${id}/practice`, style: { marginTop: '12px' } }, '🧠 Pratik modu (durdur / geri sar)'),
    h('a', { class: 'btn ghost block', href: `#/listening/${id}/exam`, style: { marginTop: '8px' } }, '🎯 Sınav modu (ses bir kez çalar)'),
    h('p', { class: 'small muted', style: { marginTop: '12px' } }, 'Sınav modunda başlamadan önce soruları okumak için 30 saniyen olur, ses durdurulamaz.'));
}

export async function renderRun(id, mode) {
  const it = await loadItem('listening', id);
  const root = h('div');
  const t0 = Date.now();
  root.append(runListening({
    items: [it], mode, title: `Section ${it.section}`,
    onDone: async (res) => {
      const band = estimateBand('listening', res);
      await saveOutcome({ module: 'listening', itemIds: [id], title: it.title, res, mode, seconds: Math.min((Date.now() - t0) / 1000, 2400) });
      root.replaceChildren(renderResults({ title: it.title, module: 'listening', res, band, items: [it], onRetry: () => { location.hash = `#/listening/${id}/${mode}`; location.reload(); } }));
      window.scrollTo(0, 0);
    }
  }));
  return root;
}

// mode: practice | exam. Sınav modunda bölümler sırayla, her biri öncesi 30 sn okuma, sonda 2 dk kontrol.
export function runListening({ items, mode = 'practice', title = 'Listening', onDone, checkSeconds = 120, readSeconds = 30 }) {
  const exam = mode !== 'practice';
  const answers = {};
  const allGroups = items.flatMap((x) => x.groups);
  let finished = false, player = null, cd = null, sec = 0;
  const status = h('div', { class: 'lstatus' });
  const controls = h('div', { class: 'lcontrols' });
  const qEl = h('div', { class: 'qpanel' });
  const lineEl = h('div', { class: 'small muted lline' });
  const root = h('div', { class: 'runner' });
  const rate = state.settings.rate;

  function renderQuestions(i) {
    const it = items[i];
    qEl.replaceChildren(
      h('div', { class: 'card small' }, h('b', null, `Section ${it.section}`), ' — ', it.context),
      ...it.groups.map((g) => {
        const box = renderGroups([g], answers, { exam });
        if (!exam) {
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
  }

  function startSection(i) {
    sec = i;
    renderQuestions(i);
    const it = items[i];
    player = createPlayer(it, {
      rate: exam ? 1 : rate,
      onLine: (k) => { lineEl.textContent = `Satır ${k + 1} / ${it.script.length}`; },
      onEnd: () => {
        if (!exam) { status.textContent = '✅ Kayıt bitti. Cevaplarını kontrol et veya baştan dinle.'; setPracticeButtons(); return; }
        if (i + 1 < items.length) beforeSection(i + 1);
        else checkTime();
      }
    });
    if (exam) { status.textContent = `🔊 Section ${it.section} çalıyor…`; controls.replaceChildren(); player.play(); }
    else { status.textContent = '▶️ Hazır olunca başlat. Önce soruları oku.'; setPracticeButtons(); }
  }

  function setPracticeButtons() {
    const pb = h('button', { class: 'btn primary grow', onclick: () => {
      if (player.playing) { player.pause(); status.textContent = '⏸ Duraklatıldı'; } else { player.play(); status.textContent = '🔊 Çalıyor…'; }
      pb.textContent = player.playing ? '⏸ Duraklat' : '▶️ Devam';
    } }, player && player.playing ? '⏸ Duraklat' : '▶️ Başlat');
    controls.replaceChildren(h('div', { class: 'row' },
      h('button', { class: 'icon-btn', 'aria-label': '2 satır geri', onclick: () => player.seek(player.index - 2) }, '⏪'),
      pb,
      h('button', { class: 'icon-btn', 'aria-label': 'Baştan', onclick: () => { player.restart(); pb.textContent = '▶️ Başlat'; status.textContent = '⏮ Baştan'; } }, '⏮')));
  }

  function beforeSection(i) {
    renderQuestions(i);
    sec = i;
    controls.replaceChildren(h('button', { class: 'btn ghost block', onclick: () => { cd.stop(); startSection(i); } }, 'Hazırım, başlat'));
    cd = countdown(readSeconds, (left) => { status.textContent = `📖 Section ${items[i].section}: soruları oku — ${left} sn`; }, () => startSection(i));
    window.scrollTo(0, 0);
  }

  function checkTime() {
    controls.replaceChildren();
    // Sınav modunda kontrol süresinde tüm bölümlerin sorularını göster
    qEl.replaceChildren(...items.flatMap((it) => [h('h3', null, `Section ${it.section}`), renderGroups(it.groups, answers, { exam })]));
    cd = countdown(checkSeconds, (left) => { status.textContent = `✍️ Kontrol süresi: ${fmtTime(left)}`; }, () => submit(true));
  }

  async function submit(force) {
    if (finished) return;
    if (!force) {
      const left = unanswered(allGroups, answers);
      if (!(await ask(left ? `${left} soru boş. Teslim edilsin mi?` : 'Teslim edilsin mi?', { ok: 'Teslim et' }))) return;
    }
    finished = true;
    player && player.pause();
    cd && cd.stop();
    stopSpeaking();
    onDone(grade(allGroups, answers), answers);
  }

  onLeave(() => { player && player.pause(); cd && cd.stop(); stopSpeaking(); });

  root.append(
    h('div', { class: 'runbar' }, h('div', { class: 'row spread' }, h('b', null, title), h('span', { class: 'pill ' + (exam ? 'warn' : 'primary') }, exam ? 'Sınav modu' : 'Pratik')),
      status, lineEl, controls),
    qEl,
    h('div', { class: 'bottom-bar' }, h('button', { class: 'btn primary block', onclick: () => submit(false) }, 'Teslim et')));

  if (exam) beforeSection(0); else startSection(0);
  return root;
}
