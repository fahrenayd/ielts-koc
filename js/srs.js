// SM-2 tabanlı aralıklı tekrar
// Notlar: 0 = Tekrar (bilemedim), 3 = Zor, 4 = İyi, 5 = Kolay
export const GRADES = [
  { q: 0, label: 'Tekrar', cls: 'g-again' },
  { q: 3, label: 'Zor', cls: 'g-hard' },
  { q: 4, label: 'İyi', cls: 'g-good' },
  { q: 5, label: 'Kolay', cls: 'g-easy' }
];

export function newState(id) {
  return { id, ef: 2.5, reps: 0, interval: 0, due: 0, lapses: 0, seen: false, last: null };
}

export function review(state, q, today) {
  const s = { ...state, seen: true, last: today };
  if (q < 3) {
    s.reps = 0;
    s.lapses += 1;
    s.interval = 0;
    s.due = today;                    // aynı oturumda tekrar gelir
    s.ef = Math.max(1.3, s.ef - 0.2);
    return s;
  }
  if (s.reps === 0) s.interval = q === 5 ? 3 : 1;
  else if (s.reps === 1) s.interval = q === 3 ? 3 : q === 5 ? 8 : 6;
  else s.interval = Math.round(s.interval * (q === 3 ? 1.2 : q === 5 ? s.ef * 1.3 : s.ef));
  s.interval = Math.max(1, s.interval);
  s.reps += 1;
  s.due = today + s.interval;
  s.ef = Math.max(1.3, s.ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return s;
}

export function intervalLabel(state, q, today) {
  const n = review(state, q, today).interval;
  if (n === 0) return 'şimdi';
  if (n < 30) return n + ' g';
  if (n < 365) return Math.round(n / 30) + ' ay';
  return (n / 365).toFixed(1) + ' yıl';
}

export const isLearned = (s) => s && s.seen && s.reps >= 1;
export const isMature = (s) => s && s.interval >= 21;
