const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 15000 });
  try {
    const pages = browser.contexts().flatMap(context => context.pages());
    console.log('Pages:', pages.map(page => page.url()));
    const page = pages.find(page => page.url().includes('/home'));
    if (!page) throw new Error('未找到 EM 主窗口');
    const messageNav = page.locator('.home__sider-nav [aria-label="消息"]');
    if (await messageNav.count()) await messageNav.click();
    const general = page.getByRole('button', { name: '@AI 通用助手', exact: true });
    const rag = page.getByRole('button', { name: '@AI RAG助手 制度问答', exact: true });
    await general.waitFor({ timeout: 15000 });
    await rag.waitFor({ timeout: 15000 });
    await page.bringToFront();
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true });
    if (!(await input.inputValue()).trim()) {
      await input.fill('@');
      await page.getByRole('option', { name: /AI RAG助手/ }).waitFor();
      await page.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/15/01a13ea7-db9e-76c3-a593-f48a2308e0a3/em-ai-rag-assistants.png' });
      await input.fill('');
    } else {
      await page.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/15/01a13ea7-db9e-76c3-a593-f48a2308e0a3/em-ai-rag-assistants.png' });
    }
    console.log('Verified: both independent assistant buttons are visible in the running desktop client.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
