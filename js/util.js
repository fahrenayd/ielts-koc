// Küçük yardımcılar: DOM oluşturma, tarih, bildirim, onay penceresi

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Güvenli mini-markdown: **kalın** ve `kod`
export function md(str) {
  const esc = String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
}
export const mdEl = (tag, str, cls) => h(tag, { class: cls, html: md(str) });

// ---------- Tarih ----------
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function dayNum(d = new Date()) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function daysUntil(key) {
  return dayNum(keyToDate(key)) - dayNum();
}
export const isWeekend = (d = new Date()) => d.getDay() === 0 || d.getDay() === 6;
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const shortDay = (d) => TR_DAYS[d.getDay()];

// ---------- Bildirim ----------
let toastTimer;
export function toast(msg, action) {
  const el = document.getElementById('toast');
  el.replaceChildren(h('span', null, msg));
  if (action) el.append(h('button', { onclick: () => { el.classList.remove('show'); action.run(); } }, action.label));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 10000 : 2600);
}

// ---------- Onay penceresi ----------
export function ask(message, { ok = 'Evet', cancel = 'Vazgeç', danger = false } = {}) {
  return new Promise((resolve) => {
    const dlg = h('dialog', null,
      h('p', null, message),
      h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: '16px' } },
        h('button', { class: 'btn ghost', onclick: () => close(false) }, cancel),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => close(true) }, ok)));
    function close(v) { dlg.close(); dlg.remove(); resolve(v); }
    dlg.addEventListener('cancel', () => close(false));
    document.body.append(dlg);
    dlg.showModal();
  });
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function topbar(title, { back = true } = {}) {
  return h('div', { class: 'topbar' },
    back ? h('button', { class: 'icon-btn', 'aria-label': 'Geri', onclick: () => history.length > 1 ? history.back() : (location.hash = '#/today') }, '←') : null,
    h('h1', null, title));
}

// ---------- Aşama 2+ yardımcıları ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function fmtTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const countWords = (t) => (String(t || '').trim().match(/[A-Za-z0-9'’-]+/g) || []).length;

// Metni panoya kopyala (eski tarayıcılar için yedek yöntem)
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* yedek yönteme geç */ }
  const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }, text);
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
  ta.remove();
  return ok;
}

// Metin içindeki alıntıları <mark> ile vurgula (güvenli: önce kaçış yapılır)
export function highlight(text, quotes = []) {
  let html = esc(text);
  for (const q of quotes.filter(Boolean)) {
    const e = esc(q);
    const i = html.indexOf(e);
    if (i >= 0) html = html.slice(0, i) + '<mark>' + e + '</mark>' + html.slice(i + e.length);
  }
  return html;
}

// Geri sayım: her saniye onTick(kalan), sıfırda onEnd
export function countdown(seconds, onTick, onEnd) {
  let left = seconds;
  onTick(left);
  const id = setInterval(() => {
    left -= 1;
    onTick(left);
    if (left <= 0) { clearInterval(id); onEnd && onEnd(); }
  }, 1000);
  return { stop: () => clearInterval(id), left: () => left };
}

// Sayfa değişince çalışan zamanlayıcıları durdurmak için
const cleanups = new Set();
export function onLeave(fn) { cleanups.add(fn); }
export function runCleanups() { for (const fn of cleanups) { try { fn(); } catch (e) { console.warn(e); } } cleanups.clear(); }

// replaceChildren'a dizi veya boş (null/false) değer verilebilsin: düzleştir ve boşları at
const nativeReplace = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function (...kids) {
  return nativeReplace.apply(this, kids.flat(Infinity).filter((k) => k != null && k !== false));
};
