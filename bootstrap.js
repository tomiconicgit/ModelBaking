// bootstrap.js
// Splash + orchestrator for Titan Forge

import { initDebugger } from './debugger.js';

const MODULES = [
  './viewer.js',
  './loader.js',
  './panel.js',
  './dashboard.js',
  './grid.js',
  './transform.js',
  './meshes.js',
  './textures.js',
  './tabs.js',
  './export.js'
];

// --- Splash handles ----------------------------------------------------
const splash = (() => {
  const root = document.getElementById('bootstrap');
  const brand = document.getElementById('brand');
  const spin  = document.getElementById('spin');
  const msg   = document.getElementById('boot-msg');
  const err   = document.getElementById('boot-err');
  const copy  = document.getElementById('copy-err');

  if (brand) brand.classList.add('show');

  function setMessage(t) { if (msg) msg.textContent = t; }
  function showError(text) {
    if (spin) spin.classList.add('error');
    setMessage('A startup error occurred.');
    if (err) { err.style.display = 'block'; err.textContent = text || ''; }
    if (copy) {
      copy.style.display = 'inline-flex';
      copy.onclick = () => navigator.clipboard.writeText(text || '').catch(()=>{});
    }
  }
  function fadeOutAndRevealApp() {
    if (!root) { document.getElementById('app')?.classList.remove('hidden'); return; }
    root.style.transition = 'opacity .35s ease';
    root.style.opacity = '0';
    setTimeout(() => {
      root.remove();
      document.getElementById('app')?.classList.remove('hidden');
    }, 350);
  }

  return { setMessage, showError, fadeOutAndRevealApp, root };
})();

// --- Wire debugger to splash ------------------------------------------
const dbg = initDebugger({
  // we’ll drive start-up below; no onPassed handler needed
  onFailed: (formatted) => splash.showError(formatted.plain),
  ui: {
    titleEl:   document.getElementById('brand'),
    spinnerEl: document.getElementById('spin'),
    messageEl: document.getElementById('boot-msg'),
    copyBtnEl: document.getElementById('copy-err')
  }
});

// --- Boot sequence -----------------------------------------------------
(async function boot() {
  try {
    splash.setMessage('Scanning modules…');
    await dbg.checkModules(MODULES);
    if (!dbg.state.passed) return;

    splash.setMessage('Starting Titan Forge…');

    // viewer.js self-initializes on import (no initViewer call)
    await import('./viewer.js');

    // Load the rest in parallel
    const [{ initLoader }, { initPanels }] = await Promise.all([
      import('./loader.js'),
      import('./panel.js')
    ]);

    await initLoader();
    await initPanels();

    splash.setMessage('Ready');
    splash.fadeOutAndRevealApp();

  } catch (e) {
    const message = (e && (e.stack || e.message)) || String(e);
    splash.showError(message);
  }
})();

// Optional: quell accidental overscroll on splash
(() => {
  const el = document.getElementById('bootstrap');
  if (!el) return;
  el.addEventListener('touchmove', (ev) => ev.preventDefault(), { passive: false });
})();