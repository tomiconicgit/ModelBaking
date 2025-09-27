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

  // Visual kick: fade brand in
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
    if (!root) {
      // Fallback: just unhide app
      document.getElementById('app')?.classList.remove('hidden');
      return;
    }
    root.style.transition = 'opacity .35s ease';
    root.style.opacity = '0';
    setTimeout(() => {
      root.remove();
      document.getElementById('app')?.classList.remove('hidden');
    }, 350);
  }

  return { root, brand, spin, msg, err, copy, setMessage, showError, fadeOutAndRevealApp };
})();

// --- Wire debugger to splash ------------------------------------------
const dbg = initDebugger({
  onPassed: startApp,
  onFailed: (formatted) => {
    // formatted.plain already contains "file:line:col\nstack"
    splash.showError(formatted.plain);
  },
  ui: {
    titleEl:   document.getElementById('brand'),   // optional
    spinnerEl: document.getElementById('spin'),
    messageEl: document.getElementById('boot-msg'),
    copyBtnEl: document.getElementById('copy-err')
  }
});

// --- Boot sequence -----------------------------------------------------
(async function boot() {
  try {
    splash.setMessage('Scanning modules…');
    await dbg.checkModules(MODULES);   // on failure, this already renders error + halts
    if (!dbg.state.passed) return;     // safety guard

    // If we got here, core modules are available.
    splash.setMessage('Starting Titan Forge…');

    // Load app shell in parallel (these export init* functions)
    const [viewer, loader, panel] = await Promise.all([
      import('./viewer.js'),
      import('./loader.js'),
      import('./panel.js')
    ]);

    // Init core pieces (order matters: viewer first so canvas exists)
    await viewer.initViewer();
    await loader.initLoader();
    await panel.initPanels();

    // Done — reveal application
    splash.setMessage('Ready');
    splash.fadeOutAndRevealApp();

  } catch (e) {
    const message = (e && (e.stack || e.message)) ? (e.stack || e.message) : String(e);
    splash.showError(message);
  }
})();

// --- Optional niceties -------------------------------------------------
// Prevent stray pull-to-refresh / overscroll on mobile splash area.
(() => {
  const el = splash.root;
  if (!el) return;
  el.addEventListener('touchmove', (ev) => {
    // If you styled #bootstrap with `overscroll-behavior: contain`, you can skip this.
    ev.preventDefault();
  }, { passive: false });
})();