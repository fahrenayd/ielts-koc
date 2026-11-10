// IELTS Koç — giriş noktası: yönlendirme, tema, service worker
import { state, loadState } from './store.js';
import { h, toast, runCleanups } from './util.js';
import * as onboarding from './screens/onboarding.js';
import * as today from './screens/today.js';
import * as practice from './screens/practice.js';
import * as vocab from './screens/vocab.js';
import * as grammar from './screens/grammar.js';
import * as mock from './screens/mock.js';
import * as me from './screens/me.js';
import * as settings from './screens/settings.js';
import * as reading from './screens/reading.js';
import * as listening from './screens/listening.js';
import * as mistakes from './screens/mistakes.js';
import * as writing from './screens/writing.js';
import * as speaking from './screens/speaking.js';
import * as placement from './screens/placement.js';

export const APP_VERSION = '2.0.0 · Tüm modüller';

// rota → [ekran fonksiyonu, sekme, alt menü görünsün mü]
const routes = [
  [/^onboarding$/, onboarding.render, null, false],
  [/^today$/, today.render, 'today', true],
  [/^practice$/, practice.render, 'practice', true],
  [/^vocab$/, vocab.renderHome, 'vocab', true],
  [/^vocab\/review$/, vocab.renderReview, 'vocab', false],
  [/^vocab\/topic\/([\w-]+)$/, vocab.renderTopic, 'vocab', true],
  [/^vocab\/study\/([\w-]+)$/, vocab.renderReview, 'vocab', false],
  [/^grammar\/([\w-]+)$/, grammar.renderLesson, 'vocab', true],
  [/^grammar\/([\w-]+)\/quiz$/, grammar.renderQuiz, 'vocab', false],
  [/^mock$/, mock.render, 'mock', true],
  [/^mock\/([\w-]+)$/, mock.renderRun, 'mock', false],
  [/^placement$/, placement.render, 'mock', false],
  [/^me$/, me.render, 'me', true],
  [/^settings$/, settings.render, 'me', true],
  [/^reading$/, reading.renderList, 'practice', true],
  [/^reading\/([\w-]+)$/, reading.renderIntro, 'practice', true],
  [/^reading\/([\w-]+)\/(practice|timed)$/, reading.renderRun, 'practice', false],
  [/^listening$/, listening.renderList, 'practice', true],
  [/^listening\/([\w-]+)$/, listening.renderIntro, 'practice', true],
  [/^listening\/([\w-]+)\/(practice|exam)$/, listening.renderRun, 'practice', false],
  [/^mistakes$/, mistakes.renderHome, 'practice', true],
  [/^mistakes\/review\/([\w-]+)$/, mistakes.renderReview, 'practice', false],
  [/^writing$/, writing.renderHome, 'practice', true],
  [/^writing-archive$/, writing.renderArchive, 'practice', true],
  [/^writing-library$/, writing.renderLibrary, 'practice', true],
  [/^writing-review\/(\d+)$/, writing.renderReview, 'practice', true],
  [/^writing\/([\w-]+)$/, writing.renderTask, 'practice', true],
  [/^writing\/([\w-]+)\/models$/, writing.renderModels, 'practice', true],
  [/^writing\/([\w-]+)\/plan$/, writing.renderPlan, 'practice', false],
  [/^writing\/([\w-]+)\/write$/, writing.renderWrite, 'practice', false],
  [/^speaking$/, speaking.renderHome, 'practice', true],
  [/^speaking-archive$/, speaking.renderArchive, 'practice', true],
  [/^speaking\/examiner$/, speaking.renderExaminer, 'practice', false],
  [/^speaking\/p1\/([\w-]+)$/, speaking.renderP1, 'practice', false],
  [/^speaking\/p2\/([\w-]+)$/, speaking.renderP2, 'practice', false]
];

let renderToken = 0;
async function route() {
  const path = location.hash.replace(/^#\/?/, '') || 'today';
  if (!state.profile && path !== 'onboarding') { location.replace('#/onboarding'); return; }
  const view = document.getElementById('view');
  const match = routes.find(([re]) => re.test(path)) || routes[1];
  const [re, fn, tab, showTabs] = match;
  const params = path.match(re)?.slice(1) || [];
  document.body.classList.toggle('no-tabbar', !showTabs);
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  runCleanups();
  if (window.speechSynthesis) speechSynthesis.cancel();
  const token = ++renderToken;
  try {
    const el = await fn(...params);
    if (token !== renderToken) return; // kullanıcı bu arada başka ekrana geçti
    view.replaceChildren(el);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    view.replaceChildren(h('div', { class: 'card' }, h('h3', null, 'Bir sorun oluştu'), h('p', { class: 'muted' }, String(err.message || err)),
      h('a', { class: 'btn primary', href: '#/today' }, 'Ana ekrana dön')));
  }
}

export function applyTheme() {
  const t = state.settings.theme;
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#18222e' : '#1f3a5f');
}

// ---------- Ana ekrana yükleme ----------
export const install = { prompt: null };
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  install.prompt = e;
  document.dispatchEvent(new Event('installable'));
});
window.addEventListener('appinstalled', () => { install.prompt = null; toast('Uygulama ana ekrana eklendi 🎉'); });

// ---------- Service worker ve güncelleme ----------
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (w) => toast('Yeni sürüm hazır.', { label: 'Yenile', run: () => w.postMessage('SKIP_WAITING') });
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch((e) => console.warn('SW kaydı başarısız', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; location.reload(); }
  });
}

async function start() {
  await loadState();
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  // Tarayıcıdan verileri silmemesini iste (yüklenmiş uygulamalarda genelde otomatik verilir)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  window.addEventListener('hashchange', route);
  route();
  registerSW();
}

start();
