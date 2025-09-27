// debugger.js
// Robust bootstrap debugger: captures script errors, preloads modules,
// and signals bootstrap to continue or stop with a detailed report.

export function initDebugger({
  // Required callbacks supplied by bootstrap.js
  onPassed = () => {},
  onFailed = () => {},
  // Optional UI hooks from bootstrap.js (pass real elements, not selectors)
  ui = {
    titleEl: null,        // e.g. document.getElementById('boot-title')
    spinnerEl: null,      // e.g. document.getElementById('boot-spinner')
    messageEl: null,      // e.g. document.getElementById('boot-msg')
    copyBtnEl: null       // e.g. document.getElementById('boot-copy')
  }
} = {}) {

  const state = {
    errors: [],
    passed: false,
    finished: false
  };

  // ---- Helpers ---------------------------------------------------------
  const setText = (el, txt) => { if (el) el.textContent = txt; };
  const addClass = (el, cls) => { if (el) el.classList.add(cls); };
  const removeClass = (el, cls) => { if (el) el.classList.remove(cls); };

  function formatError({ message, filename, lineno, colno, stack }) {
    const file = filename || '(unknown file)';
    const ln = Number.isFinite(lineno) ? lineno : '?';
    const cn = Number.isFinite(colno) ? colno : '?';
    const header = `${file}:${ln}:${cn}`;
    const body = stack ? String(stack) : String(message || '(no message)');
    return { header, body, plain: `${header}\n${body}` };
  }

  function renderErrorUI(err) {
    // Stop spinner + show red state + message + copy button.
    removeClass(ui.spinnerEl, 'spin');
    addClass(ui.spinnerEl, 'error');          // let bootstrap.css color it red
    setText(ui.titleEl, 'Titan Forge — Error');
    setText(ui.messageEl, `${err.header}\n${err.body}`);

    if (ui.copyBtnEl) {
      ui.copyBtnEl.classList.remove('hidden');
      ui.copyBtnEl.onclick = async () => {
        try { await navigator.clipboard.writeText(err.plain); }
        catch {}
      };
    }
  }

  function renderOkUI() {
    // Let bootstrap fade out; we just mark success.
    addClass(ui.spinnerEl, 'ok');             // optional green tint if you style it
    setText(ui.messageEl, 'All systems good.');
  }

  function fail(e) {
    if (state.finished) return;
    state.finished = true;
    const formatted = formatError(e);
    state.errors.push(formatted);
    renderErrorUI(formatted);
    try { onFailed(formatted); } catch {}
  }

  function pass() {
    if (state.finished) return;
    state.finished = true;
    state.passed = true;
    renderOkUI();
    try { onPassed(); } catch {}
  }

  // ---- Global error wiring --------------------------------------------
  // Browser "error" events
  window.addEventListener('error', (evt) => {
    fail({
      message: evt.message,
      filename: evt.filename,
      lineno: evt.lineno,
      colno: evt.colno,
      stack: (evt.error && evt.error.stack) || evt.message
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (evt) => {
    const err = evt.reason || {};
    fail({
      message: err.message || String(evt.reason),
      filename: (err.fileName || err.filename || ''),
      lineno: err.lineNumber || err.lineno,
      colno: err.columnNumber || err.colno,
      stack: err.stack || String(evt.reason)
    });
  });

  // ---- Public API ------------------------------------------------------
  return {
    /**
     * Dynamically import a set of modules during bootstrap.
     * If any import fails, we fail the boot and print where.
     */
    async checkModules(moduleUrls = []) {
      // Make spinner visibly "working"
      addClass(ui.spinnerEl, 'spin');
      setText(ui.messageEl, 'Loading modules…');

      for (const url of moduleUrls) {
        try {
          // Note: rely on correct <script type="module"> origin settings
          await import(url);
        } catch (err) {
          // Try to enrich filename when browser omits it
          fail({
            message: err?.message || 'Failed to import module',
            filename: err?.fileName || err?.filename || url,
            lineno: err?.lineNumber || err?.lineno,
            colno: err?.columnNumber || err?.colno,
            stack: err?.stack || `${url}\n${String(err)}`
          });
          return;
        }
      }

      pass();
    },

    /**
     * Manual guard you can call around any async boot step.
     */
    async guard(stepName, fn) {
      try {
        setText(ui.messageEl, `${stepName}…`);
        return await fn();
      } catch (err) {
        fail({
          message: `${stepName} failed: ${err?.message || err}`,
          filename: err?.fileName || err?.filename || '',
          lineno: err?.lineNumber || err?.lineno,
          colno: err?.columnNumber || err?.colno,
          stack: err?.stack || String(err)
        });
        return undefined;
      }
    },

    get state() { return { ...state }; }
  };
}