// Splash + orchestrator
import { runSelfCheck } from './debugger.js';

const splash = {
  root: document.getElementById('bootstrap'),
  brand: document.getElementById('brand'),
  spin: document.getElementById('spin'),
  msg: document.getElementById('boot-msg'),
  err: document.getElementById('boot-err'),
  copy: document.getElementById('copy-err')
};

splash.brand.classList.add('show');

(async () => {
  try {
    splash.msg.textContent = 'Scanning modules…';
    await runSelfCheck([
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
    ]);

    splash.msg.textContent = 'Starting Titan Forge…';

    // Load the app shell in parallel
    const [{ initViewer }, { initLoader }, { initPanels }] = await Promise.all([
      import('./viewer.js'),
      import('./loader.js'),
      import('./panel.js')
    ]);

    // Init core pieces
    await initViewer();
    await initLoader();   // sets up global state + handlers
    await initPanels();   // mounts panel modules and nav

    // Reveal app
    splash.msg.textContent = 'Ready';
    splash.root.style.transition = 'opacity .35s ease';
    splash.root.style.opacity = '0';
    setTimeout(() => {
      splash.root.remove();
      document.getElementById('app').classList.remove('hidden');
    }, 350);
  } catch (e) {
    splash.spin.classList.add('error');
    const message = e && (e.stack || e.message || String(e));
    splash.msg.textContent = 'A startup error occurred.';
    splash.err.style.display = 'block';
    splash.err.textContent = message;
    splash.copy.style.display = 'inline-flex';
    splash.copy.onclick = () => navigator.clipboard.writeText(message || '').catch(()=>{});
  }
})();