// Tarayıcının metin okuma özelliği (Android'de Google TTS sesleri)
let voices = [];
const supported = 'speechSynthesis' in window;

function loadVoices() {
  voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
}
if (supported) {
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

export const ttsSupported = () => supported;
const norm = (l) => l.replace('_', '-').toLowerCase();
export const hasAccent = (lang) => voices.some((v) => norm(v.lang) === lang.toLowerCase());
export const voiceCount = () => voices.length;

export function speak(text, { accent = 'en-GB', rate = 0.95 } = {}) {
  if (!supported) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = voices.find((x) => norm(x.lang) === accent.toLowerCase()) || voices.find((x) => norm(x.lang).startsWith('en'));
  if (v) u.voice = v;
  u.lang = v ? v.lang : accent;
  u.rate = rate;
  speechSynthesis.speak(u);
  return true;
}
