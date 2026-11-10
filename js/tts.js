// Tarayıcının metin okuma özelliği (Android'de Google TTS sesleri)
let voices = [];
const supported = 'speechSynthesis' in window;

function loadVoices() {
  voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en'));
}
if (supported) {
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

export const ttsSupported = () => supported;
const norm = (l) => l.replace('_', '-').toLowerCase();
export const hasAccent = (lang) => voices.some((v) => norm(v.lang) === lang.toLowerCase());
export const voiceCount = () => voices.length;

// Aksana uygun ses; aynı aksanda birden çok ses varsa index ile farklı konuşmacılara farklı ses
export function pickVoice(accent = 'en-GB', index = 0) {
  const same = voices.filter((v) => norm(v.lang) === accent.toLowerCase());
  const pool = same.length ? same : voices;
  return pool.length ? pool[index % pool.length] : null;
}

export function speak(text, { accent = 'en-GB', rate = 0.95 } = {}) {
  if (!supported) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(accent);
  if (v) u.voice = v;
  u.lang = v ? v.lang : accent;
  u.rate = rate;
  speechSynthesis.speak(u);
  return true;
}

// Tek satırı okur, bitince resolve olur (Listening oynatıcısı için)
export function speakLine(text, { accent = 'en-GB', rate = 1, pitch = 1, voiceIndex = 0 } = {}) {
  return new Promise((resolve) => {
    if (!supported) return resolve(false);
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(accent, voiceIndex);
    if (v) u.voice = v;
    u.lang = v ? v.lang : accent;
    u.rate = rate;
    u.pitch = pitch;
    let done = false;
    const finish = (ok) => { if (!done) { done = true; clearTimeout(guard); resolve(ok); } };
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    // Bazı cihazlarda onend gelmeyebilir: metin uzunluğuna göre güvenlik süresi
    const guard = setTimeout(() => finish(true), 4000 + (text.length * 110) / rate);
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() { if (supported) speechSynthesis.cancel(); }

// Listening oynatıcısı: satır satır okur; duraklat / devam / baştan
export function createPlayer(item, { rate = 1, onLine, onEnd } = {}) {
  let i = 0, playing = false, token = 0;
  const lines = item.script;
  const spk = item.speakers || {};
  const ids = Object.keys(spk);
  async function loop(my) {
    while (playing && my === token && i < lines.length) {
      const l = lines[i];
      const s = spk[l.s] || {};
      onLine && onLine(i);
      await speakLine(l.t, { accent: s.accent || 'en-GB', rate, pitch: s.gender === 'm' ? 0.85 : s.gender === 'f' ? 1.12 : 1, voiceIndex: Math.max(0, ids.indexOf(l.s)) });
      if (my !== token) return;
      i++;
      await new Promise((r) => setTimeout(r, 380));
    }
    if (my === token && i >= lines.length) { playing = false; onEnd && onEnd(); }
  }
  return {
    play() { if (playing) return; playing = true; token++; loop(token); },
    pause() { playing = false; token++; stopSpeaking(); },
    restart() { this.pause(); i = 0; },
    setRate(r) { rate = r; },
    get playing() { return playing; },
    get index() { return i; },
    seek(n) { const was = playing; this.pause(); i = Math.max(0, Math.min(lines.length - 1, n)); if (was) this.play(); }
  };
}
