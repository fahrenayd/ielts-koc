// Uygulama durumu: profil, ayarlar, günlük kayıt
import { db, getKV, setKV } from './db.js';
import { todayKey } from './util.js';

export const DEFAULT_PROFILE = {
  examType: 'academic',
  examFormat: 'computer',
  examDate: '2027-11-09',
  targetOverall: 7.5,
  targetMin: 7.0,
  weekdayMinutes: 45,
  weekendMinutes: 120
};

export const DEFAULT_SETTINGS = {
  theme: 'system',      // system | light | dark
  palette: 'royal',     // royal | emerald | classic
  accent: 'en-GB',      // en-GB | en-US | en-AU
  rate: 0.95,
  newPerDay: 15,
  maxReviews: 150,
  speechMode: 'both'   // both | stt | rec (Speaking: kayıt + yazıya dökme)
};

export const state = { profile: null, settings: { ...DEFAULT_SETTINGS } };

export async function loadState() {
  state.profile = await getKV('profile', null);
  state.settings = { ...DEFAULT_SETTINGS, ...(await getKV('settings', {})) };
}
export async function saveProfile(p) { state.profile = p; await setKV('profile', p); }
export async function saveSettings(s) { state.settings = s; await setKV('settings', s); }

// ---------- Günlük kayıt ----------
export async function getDay(key = todayKey()) {
  const d = (await db.get('days', key)) || { date: key, seconds: 0, reviews: 0, newCards: 0, lessons: [], quizzes: 0 };
  d.done = d.done || [];
  return d;
}
// patch: { seconds, reviews, newCards, lesson, quizzes, done: 'reading' | 'listening' | 'writing' | 'speaking' | 'mistakes' }
export async function logDay(patch) {
  const d = await getDay();
  d.seconds += patch.seconds || 0;
  d.reviews += patch.reviews || 0;
  d.newCards += patch.newCards || 0;
  d.quizzes += patch.quizzes || 0;
  if (patch.lesson && !d.lessons.includes(patch.lesson)) d.lessons.push(patch.lesson);
  if (patch.done && !d.done.includes(patch.done)) d.done.push(patch.done);
  await db.put('days', d);
  return d;
}

// Aktif çalışma süresini ölçer: iki işlem arası en fazla 90 sn sayılır (telefonu bırakırsan şişmez)
export function makeTimer() {
  let last = Date.now();
  return {
    tick() {
      const now = Date.now();
      const s = Math.min(90, Math.round((now - last) / 1000));
      last = now;
      return s;
    }
  };
}
