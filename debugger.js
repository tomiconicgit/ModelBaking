// Loads each module and surfaces filename + line/column if something explodes.
export async function runSelfCheck(moduleUrls = []) {
  for (const url of moduleUrls) {
    try {
      await import(url);
    } catch (e) {
      const msg = [
        `Module failed: ${url}`,
        e && (e.message || String(e)),
        e && e.stack ? `\nStack:\n${e.stack}` : ''
      ].join('\n');
      throw new Error(msg);
    }
  }
}