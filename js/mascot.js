// Pofi: uygulamanın maskotu (mezuniyet kepli tilki). Geri bildirimleri o verir.
import { h, md } from './util.js';
import { state } from './store.js';

const EYES = {
  happy: '<path d="M39 59 q7 -8 14 0" /><path d="M67 59 q7 -8 14 0" />',
  celebrate: '<path d="M39 59 q7 -8 14 0" /><path d="M67 59 q7 -8 14 0" />',
  neutral: '<circle cx="46" cy="58" r="5" fill="#2b2230" stroke="none"/><circle cx="74" cy="58" r="5" fill="#2b2230" stroke="none"/><circle cx="47.6" cy="56.3" r="1.6" fill="#fff" stroke="none"/><circle cx="75.6" cy="56.3" r="1.6" fill="#fff" stroke="none"/>',
  sad: '<circle cx="46" cy="60" r="4.5" fill="#2b2230" stroke="none"/><circle cx="74" cy="60" r="4.5" fill="#2b2230" stroke="none"/><path d="M39 53 l12 -5" /><path d="M81 53 l-12 -5" />',
  think: '<circle cx="47" cy="56" r="4.5" fill="#2b2230" stroke="none"/><circle cx="75" cy="56" r="4.5" fill="#2b2230" stroke="none"/><path d="M68 47 q7 -4 13 1" />'
};
const MOUTH = {
  happy: '<path d="M51 80 q9 9 18 0" />',
  celebrate: '<path d="M49 78 q11 16 22 0 z" fill="#e2566b" stroke="#2b2230"/>',
  neutral: '<path d="M54 80 q6 4 12 0" />',
  sad: '<path d="M52 85 q8 -7 16 0" />',
  think: '<path d="M55 82 h10" />'
};

export function mascotSVG(mood = 'neutral', size = 64) {
  const blush = mood === 'happy' || mood === 'celebrate' ? '<circle cx="35" cy="72" r="6" fill="#ff8fa3" opacity=".45"/><circle cx="85" cy="72" r="6" fill="#ff8fa3" opacity=".45"/>' : '';
  const tear = mood === 'sad' ? '<path d="M82 64 q3 6 0 9 q-3 -3 0 -9 z" fill="#6cc3ff"/>' : '';
  const extra = mood === 'celebrate' ? '<g fill="#f5b041"><circle cx="12" cy="30" r="3"/><circle cx="108" cy="26" r="3"/><rect x="104" y="60" width="5" height="5" transform="rotate(20 106 62)"/><rect x="8" y="64" width="5" height="5" transform="rotate(-20 10 66)"/></g>'
    : mood === 'think' ? '<text x="98" y="30" font-size="22" font-weight="800" fill="#7fa2ff">?</text>' : '';
  return `<svg class="pofi pofi-${mood}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true">
  ${extra}
  <polygon points="20,46 34,8 54,34" fill="#f28c38"/><polygon points="100,46 86,8 66,34" fill="#f28c38"/>
  <polygon points="28,40 35,18 47,34" fill="#ffd9b8"/><polygon points="92,40 85,18 73,34" fill="#ffd9b8"/>
  <ellipse cx="60" cy="66" rx="42" ry="37" fill="#f28c38"/>
  <path d="M24 70 q36 46 72 0 q-12 -6 -24 -4 q-12 8 -24 0 q-12 -2 -24 4 z" fill="#fff6ec"/>
  <ellipse cx="60" cy="71" rx="6" ry="4.5" fill="#2b2230"/>
  ${blush}
  <g fill="none" stroke="#2b2230" stroke-width="3.2" stroke-linecap="round">${EYES[mood] || EYES.neutral}${MOUTH[mood] || MOUTH.neutral}</g>
  ${tear}
  <polygon points="34,24 60,13 86,24 60,35" fill="#2b2f45"/><rect x="50" y="26" width="20" height="8" fill="#2b2f45"/>
  <path d="M86 24 v14" stroke="#f5b041" stroke-width="2.5"/><circle cx="86" cy="40" r="3" fill="#f5b041"/>
</svg>`;
}

const LINES = {
  correct: ['Harika! 🎯', 'Tam isabet!', 'Süpersin, böyle devam!', 'Aynen öyle! 👏', 'Doğru! Bu soru tipini çözmeye başladın.', 'Mükemmel, examiner gibi okudun!'],
  wrong: ['Olsun, birlikte bakalım 👇', 'Bu tuzağa çok kişi düşer — artık sen düşmeyeceksin.', 'Yanlış ama çok değerli bir hata!', 'Hadi nedenine bakalım.', 'Hatalar en iyi öğretmendir. İşte açıklaması:'],
  blank: ['Boş bırakma! IELTS\'te yanlış cevap puan götürmez, tahmin bile şans verir.'],
  great: ['Muhteşem bir sonuç! 🎉 Hedef banda yaklaşıyorsun.', 'Bu performansla 7+ çok yakın! 🏆'],
  good: ['Güzel iş! Yanlışlarına göz at, bir sonrakinde daha iyisi gelir.', 'İyi gidiyorsun! Zayıf soru tipine biraz daha yüklenelim.'],
  low: ['Moral bozmak yok! Her yanlış Hata Defteri\'ne gitti, birlikte tekrar edeceğiz. 💪', 'Başlangıç böyle olur. Açıklamaları oku, yarın tekrar dene!']
};
export const pick = (key) => { const a = LINES[key] || [key]; return a[Math.floor(Math.random() * a.length)]; };

export const mascotOn = () => state.settings.mascot !== false;

// Konuşma balonu: Pofi + mesaj + isteğe bağlı ek içerik
export function mascot(mood, message, ...extra) {
  const bubble = h('div', { class: 'pofi-bubble' }, message ? h('div', { class: 'pofi-msg', html: md(message) }) : null, ...extra);
  if (!mascotOn()) return h('div', { class: 'pofi-row no-pofi' }, bubble);
  return h('div', { class: 'pofi-row' }, h('div', { class: 'pofi-wrap', html: mascotSVG(mood, 56) }), bubble);
}

// Sonuç oranına göre ruh hali ve mesaj
export function resultMood(pct) {
  if (pct >= 0.8) return ['celebrate', pick('great')];
  if (pct >= 0.55) return ['happy', pick('good')];
  return ['sad', pick('low')];
}
