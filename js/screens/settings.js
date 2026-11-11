// Ayarlar: tema, ses, kelime limitleri, profil, yedekleme
import { h, topbar, toast, ask, todayKey } from '../util.js';
import { state, saveSettings, saveProfile } from '../store.js';
import { exportAll, importAll, wipeAll } from '../db.js';
import { speak, ttsSupported, hasAccent, voiceCount } from '../tts.js';
import { profileForm } from './onboarding.js';
import { applyTheme, install, APP_VERSION } from '../app.js';

function seg(options, value, onChange) {
  const wrap = h('div', { class: 'seg' });
  for (const [val, label] of options) {
    wrap.append(h('button', { type: 'button', class: val === value ? 'on' : '', onclick: (e) => {
      wrap.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
      onChange(val);
    } }, label));
  }
  return wrap;
}

async function update(patch) {
  await saveSettings({ ...state.settings, ...patch });
}

export function render() {
  const s = state.settings;
  const rateLabel = h('b', null, s.rate.toFixed(2) + 'x');
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', onchange: async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      if (!(await ask('Yedek geri yüklenecek. Bu cihazdaki mevcut ilerlemenin yerini alacak. Devam edilsin mi?', { ok: 'Geri yükle', danger: true }))) return;
      await importAll(obj);
      toast('Yedek geri yüklendi.');
      setTimeout(() => location.replace('#/today') || location.reload(), 600);
    } catch (err) {
      toast('Geri yükleme başarısız: ' + err.message);
    } finally { e.target.value = ''; }
  } });

  const accents = [['en-GB', '🇬🇧 İngiliz'], ['en-US', '🇺🇸 Amerikan'], ['en-AU', '🇦🇺 Avustralya']];
  const voiceNote = ttsSupported()
    ? h('p', { class: 'small muted', style: { margin: '8px 0 0' } },
      voiceCount() ? `Cihazında ${voiceCount()} İngilizce ses var.` + (hasAccent(s.accent) ? '' : ' Seçtiğin aksan bulunamadı, başka bir İngilizce ses kullanılacak.') : 'Sesler yükleniyor…',
      ' İnternetsiz kullanım için: Android Ayarlar → Sistem → Diller → Metin okuma çıkışı → Google → İngilizce sesleri indir.')
    : h('p', { class: 'small', style: { color: 'var(--bad)' } }, 'Bu tarayıcı metin okumayı desteklemiyor.');

  return h('div', null,
    topbar('Ayarlar'),

    install.prompt ? h('button', { class: 'btn primary block', style: { marginBottom: '12px' }, onclick: async (e) => {
      install.prompt.prompt(); await install.prompt.userChoice; install.prompt = null; e.currentTarget.remove();
    } }, '📲 Ana ekrana ekle') : null,

    h('h2', null, 'Görünüm'),
    h('div', { class: 'card' },
      seg([['system', 'Sistem'], ['light', 'Açık'], ['dark', 'Koyu']], s.theme, async (v) => { await update({ theme: v }); applyTheme(); })),

    h('h2', null, 'Ses (telaffuz & Listening)'),
    h('div', { class: 'card' },
      seg(accents, s.accent, (v) => update({ accent: v })),
      h('label', { class: 'field', style: { marginTop: '14px' } },
        h('span', { class: 'row spread' }, 'Okuma hızı', rateLabel),
        h('input', { type: 'range', min: 0.7, max: 1.2, step: 0.05, value: s.rate, oninput: (e) => { rateLabel.textContent = Number(e.target.value).toFixed(2) + 'x'; },
          onchange: (e) => update({ rate: Number(e.target.value) }) })),
      h('button', { class: 'btn ghost block', onclick: () => speak('Urbanisation has placed enormous pressure on public infrastructure.', { accent: state.settings.accent, rate: state.settings.rate }) }, '🔊 Sesi dene'),
      voiceNote),

    h('h2', null, 'Maskot'),
    h('div', { class: 'card' },
      h('label', { class: 'row spread', style: { cursor: 'pointer' } },
        h('span', null, h('b', null, '🦊 Pofi geri bildirim versin'), h('div', { class: 'small muted' }, 'Kapatırsan açıklamalar maskotsuz gösterilir.')),
        h('input', { type: 'checkbox', checked: s.mascot !== false, onchange: (e) => update({ mascot: e.target.checked }) }))),

    h('h2', null, 'Speaking (mikrofon)'),
    h('div', { class: 'card' },
      seg([['both', 'Kayıt + metin'], ['stt', 'Sadece metin'], ['rec', 'Sadece kayıt']], s.speechMode || 'both', (v) => update({ speechMode: v })),
      h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, 'Kayıt internetsiz çalışır; metne dökme internet ister. Bazı telefonlar ikisine aynı anda izin vermez: metin gelmiyorsa "Sadece metin"i dene.')),

    h('h2', null, 'Kelime kartları'),
    h('div', { class: 'card' },
      h('label', { class: 'field' }, h('span', null, 'Günlük yeni kart'),
        h('input', { type: 'number', inputmode: 'numeric', min: 0, max: 100, value: s.newPerDay, onchange: (e) => update({ newPerDay: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }) })),
      h('label', { class: 'field', style: { marginBottom: 0 } }, h('span', null, 'Günlük en fazla tekrar'),
        h('input', { type: 'number', inputmode: 'numeric', min: 10, max: 999, value: s.maxReviews, onchange: (e) => update({ maxReviews: Math.max(10, Math.min(999, Number(e.target.value) || 150)) }) })),
      h('p', { class: 'small muted', style: { margin: '8px 0 0' } }, 'Öneri: günde 10–20 yeni kart. Fazlası birkaç gün sonra tekrar yığını oluşturur.')),

    h('h2', null, 'Profil & hedef'),
    profileForm(state.profile, async (p) => { await saveProfile(p); toast('Profil kaydedildi.'); }, 'Profili kaydet'),

    h('h2', null, 'Yedekleme'),
    h('div', { class: 'card stack' },
      h('p', { class: 'small muted' }, 'Tüm ilerlemen bu telefonda saklanıyor. Telefon değiştirirsen veya tarayıcı verilerini silersen kaybolmasın diye ayda bir yedek al.'),
      h('button', { class: 'btn primary block', onclick: async () => {
        const data = await exportAll();
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = h('a', { href: URL.createObjectURL(blob), download: `ielts-koc-yedek-${todayKey()}.json` });
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        toast('Yedek dosyası indirildi.');
      } }, '⬇️ Yedeği indir'),
      h('button', { class: 'btn ghost block', onclick: () => fileInput.click() }, '⬆️ Yedekten geri yükle'),
      fileInput),

    h('h2', null, 'Tehlikeli bölge'),
    h('div', { class: 'card' },
      h('button', { class: 'btn danger block', onclick: async () => {
        if (!(await ask('Tüm ilerleme, kelime geçmişi ve profil kalıcı olarak silinecek. Geri alınamaz. Emin misin?', { ok: 'Hepsini sil', danger: true }))) return;
        await wipeAll();
        location.replace('#/onboarding');
        location.reload();
      } }, 'Tüm verileri sil')),

    h('p', { class: 'small muted center', style: { marginTop: '20px' } }, `IELTS Koç ${APP_VERSION}`));
}
