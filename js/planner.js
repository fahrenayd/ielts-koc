// Çalışma planı, günlük görevler, kelime kuyruğu, istatistikler
import { db, getKV } from './db.js';
import { state, getDay } from './store.js';
import { loadAllVocab, loadIndex } from './content.js';
import { dayNum, daysUntil, isWeekend, todayKey, keyToDate } from './util.js';
import { newState, isLearned, isMature } from './srs.js';

// ---------- Dönem (sınava kalan süreye göre) ----------
export function studyPhase(profile) {
  const weeks = Math.floor(daysUntil(profile.examDate) / 7);
  if (weeks < 0) return { id: 'done', name: 'Sınav tarihi geçti', focus: 'Ayarlar\'dan yeni sınav tarihini gir.' };
  if (weeks > 39) return { id: 'foundation', name: 'Temel dönem', focus: 'Kelime, gramer ve soru tiplerini tanıma. Henüz hız değil, doğruluk önemli.' };
  if (weeks > 17) return { id: 'skills', name: 'Beceri geliştirme', focus: 'Zayıf soru tiplerine yoğunlaş, Writing ve Speaking pratiğini düzenli yap.' };
  if (weeks > 4) return { id: 'timed', name: 'Süreli pratik', focus: 'Gerçek sürelerle çalış, ayda iki tam deneme.' };
  return { id: 'final', name: 'Son düzlük', focus: 'Haftada bir deneme, Hata Defteri tekrarı, dinlen.' };
}

export const goalMinutes = (profile, d = new Date()) => (isWeekend(d) ? profile.weekendMinutes : profile.weekdayMinutes);

// ---------- Kelime ----------
export async function cardStates() {
  const rows = await db.all('cards');
  return new Map(rows.map((r) => [r.id, r]));
}

export async function activeTopics() {
  const idx = await loadIndex();
  const off = await getKV('topicsOff', []);
  return idx.vocab.map((t) => t.id).filter((id) => !off.includes(id));
}

// Bugünkü çalışma kuyruğu: önce vadesi gelen tekrarlar, sonra günlük limit kadar yeni kart
export async function buildQueue({ topicId = null } = {}) {
  const [topics, states, day, active] = await Promise.all([loadAllVocab(), cardStates(), getDay(), activeTopics()]);
  const today = dayNum();
  const pool = [];
  for (const t of topics) {
    if (topicId ? t.id !== topicId : !active.includes(t.id)) continue;
    for (const w of t.words) pool.push({ ...w, topic: t.id, topicTr: t.tr });
  }
  const due = pool
    .filter((c) => states.get(c.id)?.seen && states.get(c.id).due <= today)
    .sort((a, b) => states.get(a.id).due - states.get(b.id).due)
    .slice(0, Math.max(0, state.settings.maxReviews - day.reviews));
  const newLeft = Math.max(0, state.settings.newPerDay - day.newCards);
  // Yeni kartları konular arasında sırayla dağıt (tek konuya yığılmasın)
  const byTopic = new Map();
  for (const c of pool) if (!states.get(c.id)?.seen) {
    if (!byTopic.has(c.topic)) byTopic.set(c.topic, []);
    byTopic.get(c.topic).push(c);
  }
  const fresh = [];
  const lists = [...byTopic.values()];
  for (let i = 0; fresh.length < newLeft && lists.some((l) => i < l.length); i++) {
    for (const l of lists) if (l[i] && fresh.length < newLeft) fresh.push(l[i]);
  }
  return {
    cards: [...due.map((c) => ({ ...c, isNew: false })), ...fresh.map((c) => ({ ...c, isNew: true }))],
    dueCount: due.length,
    newCount: fresh.length,
    states,
    today,
    getState: (id) => states.get(id) || newState(id)
  };
}

export async function vocabStats() {
  const [topics, states] = await Promise.all([loadAllVocab(), cardStates()]);
  const today = dayNum();
  let total = 0, learned = 0, mature = 0, due = 0;
  const perTopic = {};
  for (const t of topics) {
    const pt = { total: t.words.length, learned: 0, mature: 0 };
    for (const w of t.words) {
      const s = states.get(w.id);
      total++;
      if (isLearned(s)) { learned++; pt.learned++; }
      if (isMature(s)) { mature++; pt.mature++; }
      if (s?.seen && s.due <= today) due++;
    }
    perTopic[t.id] = pt;
  }
  return { total, learned, mature, due, perTopic };
}

// ---------- Seri (streak) ----------
export async function streakInfo() {
  const days = await db.all('days');
  const active = new Set(days.filter((d) => d.seconds >= 60 || d.reviews > 0 || d.lessons.length).map((d) => d.date));
  let streak = 0;
  const d = new Date();
  if (!active.has(todayKey(d))) d.setDate(d.getDate() - 1); // bugün henüz çalışmadıysan seri bozulmaz
  while (active.has(todayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
  const totalSeconds = days.reduce((a, x) => a + x.seconds, 0);
  return { streak, totalSeconds, activeDays: active.size, days };
}

export function lastNDays(days, n = 14) {
  const map = new Map(days.map((d) => [d.date, d]));
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const k = todayKey(d);
    out.push({ date: keyToDate(k), minutes: Math.round((map.get(k)?.seconds || 0) / 60) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

// ---------- Günlük görevler ----------
async function vocabTasks() {
  const [q, day, idx, lessonState] = await Promise.all([buildQueue(), getDay(), loadIndex(), getKV('lessons', {})]);
  const tasks = [];
  tasks.push({
    id: 'review', icon: '🔁', title: 'Kelime tekrarı',
    sub: q.dueCount ? `${q.dueCount} kart bekliyor` : day.reviews ? `${day.reviews} kart tekrar edildi` : 'Bugün tekrar yok',
    done: q.dueCount === 0, href: '#/vocab/review'
  });
  const newGoal = state.settings.newPerDay;
  tasks.push({
    id: 'new', icon: '✨', title: 'Yeni kelimeler',
    sub: `${Math.min(day.newCards, newGoal)} / ${newGoal}`,
    done: day.newCards >= newGoal || (q.newCount === 0 && q.dueCount === 0), href: '#/vocab/review'
  });
  const nextLesson = idx.grammar.find((g) => !lessonState[g.id]?.best) || null;
  if (nextLesson || day.lessons.length) {
    const doneToday = day.lessons.length > 0;
    const l = doneToday ? idx.grammar.find((g) => g.id === day.lessons[0]) : nextLesson;
    tasks.push({
      id: 'grammar', icon: '🧩', title: 'Gramer dersi', sub: l ? l.tr : '',
      done: doneToday, href: l ? '#/grammar/' + l.id : '#/vocab'
    });
  } else {
    // Tüm dersler bitti: zayıf skorlu dersi tekrar öner
    const weakest = idx.grammar.slice().sort((a, b) => (lessonState[a.id]?.best || 0) - (lessonState[b.id]?.best || 0))[0];
    if (weakest) tasks.push({ id: 'grammar', icon: '🧩', title: 'Gramer tekrarı', sub: weakest.tr, done: day.quizzes > 0, href: '#/grammar/' + weakest.id });
  }
  return tasks;
}

// ---------- Aşama 2+: bandlar, soru tipi başarısı, beceri planı ----------
export const SKILLS = ['listening', 'reading', 'writing', 'speaking'];
export const SKILL_TR = { listening: 'Listening', reading: 'Reading', writing: 'Writing', speaking: 'Speaking' };
const SKILL_LINK = { listening: '#/listening', reading: '#/reading', writing: '#/writing', speaking: '#/speaking' };
const SKILL_ICON = { listening: '🎧', reading: '📖', writing: '✍️', speaking: '🗣️' };

// Her beceri için son 3 bandın ortalaması (.5'e yuvarlanır); yoksa null
export async function latestBands() {
  const rows = (await db.all('results')).filter((r) => r.band != null && SKILLS.includes(r.module)).sort((a, b) => a.date.localeCompare(b.date));
  const out = {};
  for (const s of SKILLS) {
    const last = rows.filter((r) => r.module === s).slice(-3);
    out[s] = last.length ? Math.round((last.reduce((a, r) => a + r.band, 0) / last.length) * 2) / 2 : null;
  }
  return out;
}

export async function typeAccuracy() {
  const acc = {};
  for (const r of await db.all('results')) {
    for (const [t, [c, n]] of Object.entries(r.byType || {})) {
      acc[t] = acc[t] || { type: t, c: 0, n: 0, module: r.module };
      acc[t].c += c; acc[t].n += n;
    }
  }
  return Object.values(acc).map((x) => ({ ...x, pct: x.c / x.n })).sort((a, b) => a.pct - b.pct);
}

// Zayıftan güçlüye beceri sırası (ölçülmemiş beceri en önce gelir)
export function weaknessOrder(bands) {
  return SKILLS.slice().sort((a, b) => (bands[a] ?? 0) - (bands[b] ?? 0));
}

// Haftalık ritim: en zayıf beceri haftada 3 kez, ikinci 2 kez, diğerleri 1'er kez
export function weeklyPlan(bands, profile) {
  const [w1, w2, w3, w4] = weaknessOrder(bands);
  const days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const skills = [w1, w2, w1, w3, w2, 'writing', w1 === 'writing' ? w4 : w1];
  const detail = {
    listening: 'Listening: 1 bölüm sınav modunda + yanlışların transkriptini oku',
    reading: 'Reading: 1 pasaj (pratikte zayıf soru tipleri, haftada bir süreli)',
    writing: 'Writing: 1 Task (hafta sonu Task 2) + Claude değerlendirmesi',
    speaking: 'Speaking: 1 cue card + Part 3 soruları, kaydını dinle'
  };
  return days.map((d, i) => ({
    day: d, skill: skills[i],
    text: `${detail[skills[i]]} · Kelime tekrarı${i === 6 ? ' · Hata Defteri' : ''}`,
    minutes: i >= 5 ? profile.weekendMinutes : profile.weekdayMinutes
  }));
}

export async function todayTasks() {
  const [tasks, day, bands, placement, mistakes] = await Promise.all([vocabTasks(), getDay(), latestBands(), getKV('placement', null), db.all('mistakes')]);
  const out = [];
  if (!placement) out.push({ id: 'placement', icon: '🧭', title: 'Seviye tespiti (≈35 dk)', sub: 'Planın buna göre kişiselleşir', done: false, href: '#/placement' });
  const plan = weeklyPlan(bands, state.profile);
  const today = plan[(new Date().getDay() + 6) % 7];
  out.push({ id: 'skill', icon: SKILL_ICON[today.skill], title: `${SKILL_TR[today.skill]} pratiği`, sub: today.text.split(' · ')[0].replace(/^\w+: /, ''), done: day.done.includes(today.skill), href: SKILL_LINK[today.skill] });
  out.push(...tasks);
  if (mistakes.length) out.push({ id: 'mistakes', icon: '📕', title: 'Hata Defteri tekrarı', sub: `${mistakes.length} soru bekliyor`, done: day.done.includes('mistakes'), href: '#/mistakes' });
  return out;
}
