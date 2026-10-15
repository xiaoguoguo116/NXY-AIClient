const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 10000 });
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
    console.log(JSON.stringify(await page.evaluate(async () => {
      const saved = JSON.parse(localStorage.getItem('em.local-applications.v1') || '{}');
      const base = (saved.url || 'http://127.0.0.1:8090/').replace(/\/+$/, '');
      const invoke = window.__TAURI_INTERNALS__.invoke;
      async function probe(path) {
        const rid = await invoke('plugin:http|fetch', { clientConfig: { method: 'GET', url: base + path, headers: [['content-type', 'application/json'], ['origin', '']], data: null } });
        const response = await invoke('plugin:http|fetch_send', { rid });
        let bytes = [];
        while (true) {
          const chunk = new Uint8Array(await invoke('plugin:http|fetch_read_body', { rid: response.rid }));
          if (chunk[chunk.length - 1] === 1) break;
          bytes.push(...chunk.slice(0, -1));
        }
        let body;
        try { body = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes))); } catch {}
        return { status: response.status, body };
      }
      const config = await probe('/config');
      const sessions = config.body?.chatId ? await probe(`/ragflow-api/chats/${encodeURIComponent(config.body.chatId)}/sessions?page_size=1`) : null;
      return { base, config: { status: config.status, localDemo: config.body?.localDemo, hasChatId: !!config.body?.chatId }, sessions: sessions ? { status: sessions.status, code: sessions.body?.code, reason: sessions.body?.message } : null };
    })), null, 2);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
