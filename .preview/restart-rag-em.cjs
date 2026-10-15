const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync, spawn } = require('node:child_process');
const executable = 'D:\\ai\\NXY-AIClient\\src-tauri\\target\\release\\em.exe';
async function homePage(browser) {
  for (let i = 0; i < 40; i++) {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
    if (page) return page;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('EM 主窗口未完成加载');
}
(async () => {
  let previousDraft = '';
  let browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 10000 });
  try {
    const page = await homePage(browser);
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true });
    if (await input.count()) previousDraft = await input.inputValue();
  } finally { await browser.close(); }
  if (!process.env.EM_SKIP_RESTART) {
  execFileSync('powershell.exe', ['-NoProfile', '-Command', "$targets = Get-CimInstance Win32_Process -Filter \"Name = 'em.exe'\" | Where-Object { $_.ExecutablePath -in @('D:\\ai\\NXY-AIClient\\src-tauri\\target\\release\\em.exe', 'D:\\ai\\NXY-AIClient\\src-tauri\\target\\release\\em-before-rag-auth.exe') }; foreach ($target in $targets) { Stop-Process -Id $target.ProcessId -ErrorAction Stop }"], { windowsHide: true });
  const child = spawn(executable, [], { cwd: 'D:\\ai\\NXY-AIClient', detached: true, stdio: 'ignore', env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=19224' } });
  child.unref();
  }
  for (let i = 0; i < 30; i++) {
    try { browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 1000 }); break; }
    catch (error) { if (i === 29) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  try {
    const page = await homePage(browser);
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true });
    await input.waitFor({ timeout: 15000 });
    if (previousDraft && !(await input.inputValue())) await input.fill(previousDraft);
    const failedId = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1') || '{}');
      const chat = data.conversations?.find(c => c.id === data.selectedId);
      return chat?.messages.slice().reverse().find(m => m.assistant === 'ragflow' && m.status === 'error')?.id;
    });
    if (failedId) {
      await page.evaluate(() => {
        const original = window.__TAURI_INTERNALS__.invoke;
        window.__emRagTrace = [];
        window.__emRagOriginalInvoke = original;
        const paths = new Map();
        window.__TAURI_INTERNALS__.invoke = async (command, args, ...rest) => {
          const result = await original(command, args, ...rest);
          if (command === 'plugin:http|fetch') paths.set(result, new URL(args.clientConfig.url).pathname);
          if (command === 'plugin:http|fetch_send') window.__emRagTrace.push({ path: paths.get(args.rid), status: result.status });
          return result;
        };
      });
      await page.locator(`[data-message-id="${failedId}"]`).getByRole('button', { name: '重试', exact: true }).click();
      await page.waitForFunction(id => {
        const data = JSON.parse(localStorage.getItem('em.local-chat.v1') || '{}');
        const message = data.conversations?.flatMap(c => c.messages).find(m => m.id === id);
        return message && message.status !== 'pending';
      }, failedId, { timeout: 130000 });
      const result = await page.evaluate(id => {
        const data = JSON.parse(localStorage.getItem('em.local-chat.v1') || '{}');
        const message = data.conversations?.flatMap(c => c.messages).find(m => m.id === id);
        return { status: message.status, error: message.error, answerLength: message.text.length, references: message.rag?.references.length, options: message.rag?.options.length };
      }, failedId);
      console.log(JSON.stringify(result));
      console.log('HTTP trace:', JSON.stringify(await page.evaluate(() => {
        window.__TAURI_INTERNALS__.invoke = window.__emRagOriginalInvoke;
        return window.__emRagTrace;
      })));
      if (result.status !== 'done') throw new Error(result.error || 'RAG 请求未完成');
    } else console.log('No failed RAG reply in the active conversation.');
    await page.bringToFront();
    await page.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/15/01a13ea7-db9e-76c3-a593-f48a2308e0a3/em-rag-auth-fixed.png' });
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
