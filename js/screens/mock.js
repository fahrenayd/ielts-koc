// Deneme sekmesi — Aşama 2 ve 4'te açılacak
import { h } from '../util.js';

export function render() {
  const item = (icon, title, desc, stage) => h('div', { class: 'card locked' },
    h('div', { class: 'row' }, h('div', { class: 'emoji' }, icon),
      h('div', { class: 'grow' }, h('h3', null, title), h('p', { class: 'small muted', style: { margin: 0 } }, desc)),
      h('span', { class: 'pill' }, `Aşama ${stage}`)));
  return h('div', null,
    h('h1', null, 'Deneme'),
    h('p', { class: 'muted' }, 'Gerçek sınav sırası ve süreleriyle (bilgisayarda IELTS).'),
    item('🧭', 'Seviye tespiti (≈30 dk)', 'Reading + Listening kısmı Aşama 2\'de, Writing + Speaking kısmı Aşama 3\'te.', 2),
    item('⏱️', 'Tam deneme sınavı', 'Listening ≈30 dk + 2 dk kontrol, Reading 60 dk, Writing 60 dk, Speaking 11–14 dk. Sonunda bölüm bandları ve genel band.', 4));
}
