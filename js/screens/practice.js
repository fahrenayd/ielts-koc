// Pratik sekmesi — Aşama 2 ve 3'te açılacak modüller
import { h } from '../util.js';

const MODULES = [
  { icon: '🎧', name: 'Listening', stage: 2, desc: '4 bölüm, form/not tamamlama, çoktan seçmeli, eşleştirme, harita etiketleme.',
    tip: 'Ses başlamadan önce soruları oku ve boşluğa gelecek kelimenin türünü (sayı, isim, tarih) tahmin et.' },
  { icon: '📖', name: 'Reading', stage: 2, desc: '3 akademik pasaj, T/F/NG, matching headings, summary completion ve diğer tüm tipler.',
    tip: 'Soruları önce tara; pasajda aynı kelimeyi değil, eş anlamlısını (paraphrase) ara.' },
  { icon: '✍️', name: 'Writing', stage: 3, desc: 'Task 1 grafik/süreç/harita, Task 2 beş soru tipi; zamanlayıcı ve Claude ile değerlendirme.',
    tip: 'Task 2 Task 1\'in iki katı puan değerinde: sınavda önce Task 2\'ye 40 dk ayırmayı düşün.' },
  { icon: '🗣️', name: 'Speaking', stage: 3, desc: 'Part 1-2-3, cue card zamanlayıcısı, kayıt, yazıya dökme ve akıcılık ölçümleri.',
    tip: 'Part 1\'de cevabı 2-3 cümleyle genişlet: cevap + neden + kısa örnek.' }
];

export function render() {
  return h('div', null,
    h('h1', null, 'Pratik'),
    h('p', { class: 'muted' }, 'Bölümler aşama aşama açılıyor. Şimdilik Kelime sekmesindeki kartlar ve gramer dersleriyle temeli kur.'),
    MODULES.map((m) => h('div', { class: 'card locked' },
      h('div', { class: 'row' },
        h('div', { class: 'emoji' }, m.icon),
        h('div', { class: 'grow' }, h('h3', null, m.name), h('p', { class: 'small muted', style: { margin: 0 } }, m.desc)),
        h('span', { class: 'pill' }, `Aşama ${m.stage}`)),
      h('p', { class: 'small', style: { margin: '10px 0 0' } }, '💡 ' + m.tip))),
    h('a', { class: 'btn primary block', href: '#/vocab', style: { marginTop: '16px' } }, 'Kelime çalışmaya git'));
}
