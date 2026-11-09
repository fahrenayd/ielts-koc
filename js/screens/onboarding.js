// İlk açılış: profil
import { h } from '../util.js';
import { state, DEFAULT_PROFILE, saveProfile } from '../store.js';

export function profileForm(initial, onSave, submitLabel) {
  const p = { ...DEFAULT_PROFILE, ...(initial || {}) };
  const num = (name, label, value, attrs) => h('label', { class: 'field' }, h('span', null, label),
    h('input', { name, type: 'number', inputmode: 'decimal', value, required: true, ...attrs }));
  const form = h('form', { class: 'card' },
    h('label', { class: 'field' }, h('span', null, 'Sınav türü'),
      h('select', { name: 'examType' },
        h('option', { value: 'academic', selected: p.examType === 'academic' }, 'Academic'),
        h('option', { value: 'general', selected: p.examType === 'general' }, 'General Training'))),
    h('label', { class: 'field' }, h('span', null, 'Sınav tarihi'),
      h('input', { name: 'examDate', type: 'date', value: p.examDate, required: true })),
    h('div', { class: 'grid2' },
      num('targetOverall', 'Hedef genel band', p.targetOverall, { min: 4, max: 9, step: 0.5 }),
      num('targetMin', 'Her bölümde en az', p.targetMin, { min: 4, max: 9, step: 0.5 })),
    h('div', { class: 'grid2' },
      num('weekdayMinutes', 'Hafta içi (dk/gün)', p.weekdayMinutes, { min: 5, max: 600, step: 5 }),
      num('weekendMinutes', 'Hafta sonu (dk/gün)', p.weekendMinutes, { min: 5, max: 600, step: 5 })),
    h('button', { class: 'btn primary block', type: 'submit' }, submitLabel));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    await onSave({
      ...p,
      examType: f.get('examType'),
      examDate: f.get('examDate'),
      targetOverall: Number(f.get('targetOverall')),
      targetMin: Number(f.get('targetMin')),
      weekdayMinutes: Number(f.get('weekdayMinutes')),
      weekendMinutes: Number(f.get('weekendMinutes'))
    });
  });
  return form;
}

export function render() {
  return h('div', null,
    h('div', { class: 'center', style: { margin: '24px 0 16px' } },
      h('div', { style: { fontSize: '3rem' } }, '🎯'),
      h('h1', null, 'IELTS Koç\'a hoş geldin'),
      h('p', { class: 'muted' }, 'Hedefini ve sınav tarihini gir; günlük planın buna göre oluşsun. Bu bilgileri sonra Ayarlar\'dan değiştirebilirsin.')),
    profileForm(state.profile, async (p) => {
      await saveProfile(p);
      location.hash = '#/today';
    }, 'Başla'),
    h('p', { class: 'small muted center', style: { marginTop: '12px' } },
      'Seviyeni bilmiyorsan sorun değil: seviye tespiti testi Aşama 2\'de eklenecek ve planın ona göre güncellenecek.'));
}
