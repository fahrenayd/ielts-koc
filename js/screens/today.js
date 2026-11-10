// Bugün ekranı: geri sayım, seri, günlük görevler
import { h, daysUntil, keyToDate } from '../util.js';
import { state, getDay } from '../store.js';
import { studyPhase, goalMinutes, todayTasks, streakInfo, latestBands, SKILLS, SKILL_TR } from '../planner.js';
import { fmtBand } from '../scoring.js';
import { install } from '../app.js';

function greeting() {
  const hr = new Date().getHours();
  return hr < 6 ? 'İyi geceler' : hr < 12 ? 'Günaydın' : hr < 18 ? 'İyi günler' : 'İyi akşamlar';
}

function installCard() {
  const card = h('div', { class: 'card row install', style: { marginTop: '12px' } },
    h('div', { class: 'emoji' }, '📲'),
    h('div', { class: 'grow' }, h('h3', null, 'Ana ekrana ekle'), h('p', { class: 'small muted', style: { margin: 0 } }, 'Uygulama gibi açılsın ve internetsiz çalışsın.')),
    h('button', { class: 'btn primary sm', onclick: async () => {
      if (!install.prompt) return;
      install.prompt.prompt();
      await install.prompt.userChoice;
      install.prompt = null;
      card.remove();
    } }, 'Ekle'));
  return card;
}

export async function render() {
  const p = state.profile;
  const [day, tasks, st, bands] = await Promise.all([getDay(), todayTasks(), streakInfo(), latestBands()]);
  const left = daysUntil(p.examDate);
  const phase = studyPhase(p);
  const goal = goalMinutes(p);
  const mins = Math.round(day.seconds / 60);
  const pct = Math.min(100, Math.round((mins / goal) * 100));
  const doneCount = tasks.filter((t) => t.done).length;
  const examStr = keyToDate(p.examDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

  const root = h('div', null,
    h('p', { class: 'muted', style: { margin: '4px 0 0' } }, greeting() + ' 👋'),
    h('h1', null, 'Bugünkü planın'),

    h('div', { class: 'card hero', style: { marginTop: '12px' } },
      h('div', { class: 'row spread' },
        h('div', null,
          h('div', { class: 'big-num' }, left >= 0 ? left : 0),
          h('div', { class: 'muted small' }, `gün kaldı · ${examStr}`)),
        h('div', { style: { textAlign: 'right' } },
          h('div', { class: 'small muted' }, 'Hedef'),
          h('div', { style: { fontSize: '1.6rem', fontWeight: 750 } }, fmtBand(p.targetOverall)),
          h('div', { class: 'small muted' }, `her bölüm ≥ ${fmtBand(p.targetMin)}`))),
      h('div', { style: { marginTop: '14px' } },
        h('div', { class: 'row spread small' }, h('span', null, `Bugün ${mins} / ${goal} dk`), h('span', null, `🔥 ${st.streak} gün seri`)),
        h('div', { class: 'bar', style: { marginTop: '6px' } }, h('i', { style: { width: pct + '%' } })))),

    h('div', { class: 'card', style: { marginTop: '12px' } },
      h('div', { class: 'row spread' }, h('h3', null, 'Görevler'), h('span', { class: 'pill ' + (doneCount === tasks.length ? 'good' : '') }, `${doneCount}/${tasks.length}`)),
      tasks.map((t) => h('a', { class: 'task' + (t.done ? ' done' : ''), href: t.href },
        h('span', { class: 'check' }, t.done ? '✓' : ''),
        h('span', { class: 'emoji', style: { fontSize: '1.3rem', width: '28px' } }, t.icon),
        h('span', { class: 'grow' }, h('div', { class: 't-title' }, t.title), h('div', { class: 'small muted' }, t.sub)),
        h('span', { class: 'chev' }, '›')))),

    h('div', { class: 'card', style: { marginTop: '12px' } },
      h('div', { class: 'row spread' }, h('h3', null, 'Dönem: ' + phase.name), h('span', { class: 'pill primary' }, 'Plan')),
      h('p', { class: 'small muted', style: { margin: 0 } }, phase.focus)),

    h('div', { class: 'card', style: { marginTop: '12px' } },
      h('div', { class: 'row spread' }, h('h3', null, 'Tahmini bandların'), h('a', { class: 'small', href: '#/me' }, 'Ayrıntı ›')),
      h('div', { class: 'kpis kpis4' }, SKILLS.map((s) => h('div', { class: 'kpi' }, h('b', { class: bands[s] != null && bands[s] < p.targetMin ? 'txt-bad' : '' }, fmtBand(bands[s])), h('span', null, SKILL_TR[s]))))));

  if (install.prompt) root.insertBefore(installCard(), root.children[2]);
  document.addEventListener('installable', () => {
    if (root.isConnected && !root.querySelector('.install')) root.insertBefore(installCard(), root.children[2]);
  }, { once: true });
  return root;
}
