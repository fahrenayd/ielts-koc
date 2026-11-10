// Değerlendirme: ücretsiz claude.ai için prompt üretme, dönen sonucu okuma, internetsiz metin analizi
import { countWords } from './util.js';

export const W_CRIT = [
  ['task', 'Task Achievement / Response'], ['coherence', 'Coherence & Cohesion'],
  ['lexical', 'Lexical Resource'], ['grammar', 'Grammatical Range & Accuracy']
];
export const S_CRIT = [
  ['fluency', 'Fluency & Coherence'], ['lexical', 'Lexical Resource'],
  ['grammar', 'Grammatical Range & Accuracy'], ['pronunciation', 'Pronunciation']
];

const RESULT_SPEC = (keys) => `
En sonda, başka hiçbir şey eklemeden, tam olarak şu biçimde tek bir blok ver (uygulamam bunu otomatik okuyacak):
IELTS-SONUC
{"criteria":{${keys.map((k) => `"${k}":0`).join(',')}},"overall":0,"improvements":["…","…","…"],"corrections":[{"original":"…","better":"…","why":"…"}]}
Kurallar: puanlar 0–9 arası ve 0.5'in katı; "improvements" metni bir band yukarı taşıyacak en önemli 3 değişiklik (Türkçe); "corrections" en önemli 5–8 cümle düzeltmesi ("why" Türkçe). JSON geçerli olsun.`;

export function writingPrompt({ task, kind, prompt, chartText, text, minutes }) {
  const wc = countWords(text);
  return `Sen deneyimli bir IELTS Writing examiner'ısın. Aşağıdaki IELTS Academic Writing Task ${task} cevabını resmi, herkese açık IELTS band tanımlayıcılarına (Task ${task === 1 ? 'Achievement' : 'Response'}, Coherence and Cohesion, Lexical Resource, Grammatical Range and Accuracy) göre değerlendir. Gerçek bir examiner kadar katı ol; puanı şişirme.

Açıklamaları TÜRKÇE yaz. Her kriter için: band, 2–3 cümlelik gerekçe ve metinden somut örnekler. Sonra cümle düzeyinde düzeltmeler ve metni bir band yukarı taşıyacak en önemli 3 değişiklik.
${task === 1 ? 'Özellikle bir "overview" (genel eğilim özeti) olup olmadığını ve önemli verilerin seçilip karşılaştırılıp karşılaştırılmadığını kontrol et.' : 'Özellikle sorunun tüm kısımlarının cevaplanıp cevaplanmadığını, net bir pozisyon olup olmadığını ve fikirlerin örneklerle geliştirilip geliştirilmediğini kontrol et.'}
Kelime sayısı: ${wc} (en az ${task === 1 ? 150 : 250} olmalı).${minutes ? ` Yazma süresi: ${minutes} dk.` : ''}

SORU (${kind}):
${prompt}
${chartText ? `\nGRAFİK VERİSİ:\n${chartText}\n` : ''}
CEVABIM:
"""
${text}
"""
${RESULT_SPEC(W_CRIT.map((c) => c[0]))}`;
}

export function speakingPrompt({ parts }) {
  const body = parts.map((p) => `[${p.part}] Soru: ${p.q}\nCevabım (konuşmadan otomatik yazıya döküldü, ${Math.round(p.seconds)} sn): ${p.transcript || '(yazıya dökülemedi)'}`).join('\n\n');
  return `Sen deneyimli bir IELTS Speaking examiner'ısın. Aşağıdaki cevaplar konuşmamın otomatik yazıya dökülmüş hâlidir (noktalama ve bazı kelimeler hatalı olabilir; bunları cezalandırma). Resmi, herkese açık IELTS Speaking band tanımlayıcılarına göre Fluency & Coherence, Lexical Resource ve Grammatical Range & Accuracy kriterlerini değerlendir. Pronunciation metinden ölçülemez: "pronunciation" değerini null bırak ve overall'ı diğer üç kritere göre tahmin et.

Açıklamaları TÜRKÇE yaz: her kriter için band, gerekçe ve örnek; ayrıca cevaplarımı daha doğal ve yüksek band yapacak alternatif ifadeler (collocation, idiom değil doğal ifadeler) öner.

${body}
${RESULT_SPEC(S_CRIT.map((c) => c[0])).replace('"pronunciation":0', '"pronunciation":null')}`;
}

// Claude'un cevabındaki IELTS-SONUC bloğunu bul ve oku
export function parseResult(raw, keys) {
  const s = String(raw || '');
  const start = s.indexOf('{', Math.max(0, s.indexOf('IELTS-SONUC')));
  if (start < 0) throw new Error('Sonuç bloğu bulunamadı. Claude\'un cevabının tamamını (en sondaki IELTS-SONUC bölümüyle) yapıştır.');
  let depth = 0, end = -1, inStr = false, escp = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (escp) escp = false; else if (c === '\\') escp = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('Sonuç bloğu eksik görünüyor; tamamını kopyaladığından emin ol.');
  let obj;
  try { obj = JSON.parse(s.slice(start, end + 1).replace(/[“”]/g, '"')); } catch (e) { throw new Error('Sonuç bloğu okunamadı (JSON hatası).'); }
  const crit = {};
  for (const k of keys) {
    const v = obj.criteria?.[k];
    crit[k] = v == null ? null : clampBand(v);
  }
  const vals = Object.values(crit).filter((v) => v != null);
  if (!vals.length) throw new Error('Puanlar bulunamadı.');
  const overall = obj.overall != null ? clampBand(obj.overall) : roundHalf(vals.reduce((a, b) => a + b, 0) / vals.length);
  return {
    criteria: crit, overall,
    improvements: Array.isArray(obj.improvements) ? obj.improvements.slice(0, 5).map(String) : [],
    corrections: Array.isArray(obj.corrections) ? obj.corrections.slice(0, 10).map((c) => ({ original: String(c.original || ''), better: String(c.better || ''), why: String(c.why || '') })) : []
  };
}
const clampBand = (v) => Math.max(0, Math.min(9, Math.round(Number(v) * 2) / 2));
export const roundHalf = (v) => Math.floor(v * 2) / 2; // ortalama aşağı doğru .5'e (doğrulanmalı)

// Writing genel bandı: Task 2, Task 1'in iki katı ağırlıkta (doğrulanmalı: resmi formül yayınlanmaz)
export function writingOverall(t1, t2) {
  if (t1 == null) return t2; if (t2 == null) return t1;
  const v = (t1 + 2 * t2) / 3;
  return Math.round(v * 2) / 2;
}

// ---------- İnternetsiz Writing analizi ----------
const STOP = new Set('the a an and or but of to in on at for with by from is are was were be been being it its this that these those as their there they them he she his her we our you your i my me not no so than then also can could would should will may might must have has had do does did more most such very many much some any into over about which who whom what when where why how if because while all one two people'.split(' '));
const LINKERS = ['however', 'moreover', 'furthermore', 'in addition', 'therefore', 'consequently', 'as a result', 'on the other hand', 'nevertheless', 'whereas', 'although', 'despite', 'for example', 'for instance', 'in contrast', 'similarly', 'overall', 'in conclusion', 'to conclude', 'firstly', 'secondly', 'finally', 'meanwhile', 'by contrast', 'thus', 'hence', 'in particular', 'notably'];
const TR_ERRORS = [
  [/\bin my opinion,? i think\b/i, '"In my opinion, I think" gereksiz tekrar: ikisinden birini kullan.'],
  [/\bdiscuss(es|ed|ing)? about\b/i, '"discuss about" yanlış: discuss doğrudan nesne alır (discuss the issue).'],
  [/\binformations\b/i, '"informations" yanlış: information sayılamaz.'],
  [/\b(researches|advices|knowledges|evidences|equipments)\b/i, 'Sayılamayan isim çoğul yapılmış (research, advice, knowledge, evidence, equipment -s almaz).'],
  [/\baccording to me\b/i, '"According to me" doğal değil: "In my view" veya "I would argue that" kullan.'],
  [/\bmore (better|worse|easier|cheaper|bigger)\b/i, '"more better" gibi çift karşılaştırma yanlış: better / easier yeterli.'],
  [/\bexplain me\b/i, '"explain me" yanlış: explain something to me.'],
  [/\bthe (society|nature|technology|people) (is|are|has|have|should|must|can)\b/i, 'Genel anlamda society / nature / technology / people "the" almaz.'],
  [/\bdo (a )?mistakes?\b/i, '"do a mistake" yanlış: make a mistake.'],
  [/\bmake (a )?research\b/i, '"make research" yanlış: do research.'],
  [/\bin nowadays\b/i, '"in nowadays" yanlış: "nowadays" tek başına kullanılır.'],
  [/\bpeoples\b/i, '"peoples" (halklar) büyük ihtimalle yanlış: "people" zaten çoğuldur.']
];
const MEMORISED = [
  'it is a well-known fact that', 'in this day and age', 'every coin has two sides', 'this essay will discuss', 'since the dawn of time',
  'last but not least', 'it goes without saying', 'a hot topic', 'in a nutshell', 'from time immemorial'
];
const INFORMAL = [[/\b(don't|can't|won't|isn't|aren't|doesn't|didn't|it's|i'm|they're)\b/i, 'Kısaltma (don\'t, it\'s…) akademik yazıda kullanılmaz.'],
  [/\b(stuff|kids|guys|gonna|wanna|a lot of)\b/i, 'Gündelik ifade: "a lot of / kids / stuff" yerine "a large number of / children / items".'],
  [/!/, 'Ünlem işareti akademik yazıda kullanılmaz.']];

export function analyzeWriting(text, task) {
  const t = String(text || '');
  const lower = t.toLowerCase();
  const out = [];
  const words = countWords(t);
  const min = task === 1 ? 150 : 250;
  const paras = t.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const sentences = t.split(/[.!?]+\s/).filter((s) => countWords(s) > 2);
  const avg = sentences.length ? Math.round(words / sentences.length) : 0;

  out.push(words < min ? { level: 'bad', text: `${words} kelime: en az ${min} olmalı. Eksik kelime Task ${task === 1 ? 'Achievement' : 'Response'} puanını düşürür.` }
    : { level: 'good', text: `${words} kelime ✓ (hedef ${min}+; ${task === 1 ? '170–200' : '260–300'} ideal).` });
  if (paras.length < (task === 1 ? 3 : 4)) out.push({ level: 'warn', text: `${paras.length} paragraf var. ${task === 1 ? 'Giriş + overview + 2 detay paragrafı' : 'Giriş + 2 gövde + sonuç (4–5 paragraf)'} önerilir.` });
  if (avg > 32) out.push({ level: 'warn', text: `Ortalama cümle uzunluğu ${avg} kelime: çok uzun cümleler hata riskini artırır.` });
  else if (avg && avg < 11) out.push({ level: 'warn', text: `Ortalama cümle uzunluğu ${avg} kelime: daha karmaşık cümleler (which, although, if…) dene.` });

  if (task === 1 && !/\b(overall|in general|it is clear that|generally)\b/i.test(t)) out.push({ level: 'bad', text: 'Overview bulunamadı: "Overall, …" ile başlayan ana eğilim özeti olmadan Task Achievement genelde 5\'i geçmez.' });
  if (task === 2 && !/\b(i (strongly |firmly |would )?(agree|disagree|believe|argue|think)|in my (view|opinion)|i am convinced)\b/i.test(t)) out.push({ level: 'warn', text: 'Net bir görüş cümlesi bulunamadı. Opinion sorularında girişte ve sonuçta pozisyonunu açıkça yaz.' });

  const used = LINKERS.filter((l) => new RegExp(`\\b${l}\\b`, 'i').test(lower));
  out.push(used.length < 3 ? { level: 'warn', text: `Az bağlaç (${used.length}): however, whereas, as a result gibi bağlaçlarla fikirleri bağla.` }
    : { level: 'good', text: `${used.length} farklı bağlaç kullanılmış: ${used.slice(0, 6).join(', ')}.` });
  const mech = ['firstly', 'secondly', 'moreover', 'furthermore', 'in addition'].reduce((a, w) => a + (lower.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length, 0);
  if (mech >= 4) out.push({ level: 'warn', text: 'Firstly / Moreover / In addition gibi bağlaçlar çok sık: band 7 için bağlaçlar "mekanik" değil doğal olmalı.' });

  const freq = {};
  for (const w of lower.match(/[a-z']+/g) || []) if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  const reps = Object.entries(freq).filter(([, n]) => n >= (task === 1 ? 5 : 4)).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (reps.length) out.push({ level: 'warn', text: 'Sık tekrar: ' + reps.map(([w, n]) => `${w} ×${n}`).join(', ') + '. Eş anlamlı veya zamir kullan.' });

  for (const [re, msg] of TR_ERRORS) if (re.test(t)) out.push({ level: 'bad', text: msg });
  for (const p of MEMORISED) if (lower.includes(p)) out.push({ level: 'warn', text: `Ezber kalıp: "${p}". Examiner bunları fark eder ve kelime puanına saymaz.` });
  for (const [re, msg] of INFORMAL) if (re.test(t)) out.push({ level: 'warn', text: msg });
  return out;
}

// ---------- Konuşma ölçümleri ----------
const FILLERS = ['um', 'uh', 'er', 'erm', 'hmm', 'you know', 'i mean', 'like', 'actually', 'basically', 'sort of', 'kind of'];
export function analyzeSpeech(transcript, seconds) {
  const t = String(transcript || '').toLowerCase();
  const words = countWords(t);
  const wpm = seconds > 3 ? Math.round(words / (seconds / 60)) : 0;
  const fillers = {};
  for (const f of FILLERS) { const n = (t.match(new RegExp(`\\b${f}\\b`, 'g')) || []).length; if (n) fillers[f] = n; }
  const freq = {};
  for (const w of t.match(/[a-z']+/g) || []) if (w.length > 3 && !STOP.has(w)) freq[w] = (freq[w] || 0) + 1;
  const reps = Object.entries(freq).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { words, wpm, fillers, reps };
}
