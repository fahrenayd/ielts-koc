// Mikrofon kaydı (internetsiz çalışır) + konuşmayı yazıya dökme (Android Chrome'da internet gerekir)
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const support = {
  record: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
  stt: !!SR
};

// mode: both | stt | rec
export function createRecorder({ lang = 'en-GB', mode = 'both', onText } = {}) {
  let stream = null, mr = null, chunks = [], rec = null, active = false, startT = 0;
  let finalText = '', interim = '', sttError = null;

  function startSTT() {
    if (!support.stt || mode === 'rec') return;
    if (!navigator.onLine) { sttError = 'offline'; return; }
    rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript.trim() + ' ';
        else interim += r[0].transcript;
      }
      onText && onText((finalText + interim).trim());
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') sttError = e.error; };
    // Android sessizlikte tanımayı durdurur: kayıt sürerken yeniden başlat
    rec.onend = () => { if (active && !['not-allowed', 'audio-capture', 'network', 'service-not-allowed'].includes(sttError)) { try { rec.start(); } catch (e) { /* zaten çalışıyor */ } } };
    try { rec.start(); } catch (e) { sttError = 'start-failed'; }
  }

  return {
    async start() {
      finalText = ''; interim = ''; sttError = null; chunks = [];
      if (support.record && mode !== 'stt') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
        mr.start();
      }
      startT = Date.now();
      active = true;
      startSTT();
    },
    stop() {
      active = false;
      const seconds = (Date.now() - startT) / 1000;
      try { rec && rec.stop(); } catch (e) { /* yok say */ }
      return new Promise((resolve) => {
        const done = () => {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          const blob = chunks.length ? new Blob(chunks, { type: (mr && mr.mimeType) || 'audio/webm' }) : null;
          // Son tanıma sonuçlarının gelmesi için kısa bekleme
          setTimeout(() => resolve({ blob, url: blob ? URL.createObjectURL(blob) : null, seconds, transcript: (finalText + interim).trim(), sttError }), 600);
        };
        if (mr && mr.state !== 'inactive') { mr.onstop = done; mr.stop(); } else done();
      });
    },
    get active() { return active; }
  };
}

export const STT_ERR_TR = {
  offline: 'İnternet yok: kayıt alındı ama yazıya dökülemedi.',
  'not-allowed': 'Mikrofon izni verilmedi. Chrome ayarlarından bu siteye mikrofon izni ver.',
  'audio-capture': 'Telefon aynı anda kayıt ve yazıya dökmeye izin vermiyor olabilir. Ayarlar\'da Speaking modunu "Sadece yazıya dökme" yap.',
  network: 'Yazıya dökme servisine ulaşılamadı (internet).',
  'service-not-allowed': 'Bu cihazda konuşma tanıma kapalı.',
  'start-failed': 'Yazıya dökme başlatılamadı.'
};
