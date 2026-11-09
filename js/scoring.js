// Band hesaplama
// UYARI (doğrulanmalı): Resmi ham puan → band tabloları her sınavda biraz değişir ve tam olarak yayınlanmaz.
// Aşağıdaki tablolar yaygın kabul gören ortalama değerlerdir; sonuçlar "tahmini" olarak gösterilir.

// [en az doğru sayısı, band]
const LISTENING = [[39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
const READING_ACADEMIC = [[39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5]];
const READING_GT = [[40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5], [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5]];

function lookup(table, raw) {
  for (const [min, band] of table) if (raw >= min) return band;
  return raw > 0 ? 2 : 0;
}

// 40 sorudan farklı sayıda soru çözüldüyse 40'a ölçekle
export function rawToBand(skill, correct, total = 40, examType = 'academic') {
  const raw = Math.round((correct / total) * 40);
  if (skill === 'listening') return lookup(LISTENING, raw);
  return lookup(examType === 'general' ? READING_GT : READING_ACADEMIC, raw);
}

// Genel band: dört bölümün ortalaması, resmi yuvarlama kuralıyla.
// .25 → .5'e, .75 → bir üst tam sayıya yuvarlanır; altındakiler aşağı yuvarlanır.
export function overallBand(l, r, w, s) {
  const avg = (l + r + w + s) / 4;
  const base = Math.floor(avg);
  const frac = avg - base;
  if (frac < 0.25) return base;
  if (frac < 0.75) return base + 0.5;
  return base + 1;
}

export const fmtBand = (b) => (b == null ? '–' : Number(b).toFixed(1));
