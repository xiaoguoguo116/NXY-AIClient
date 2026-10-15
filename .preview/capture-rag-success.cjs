const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
    const settings = page.locator('.modal-backdrop').filter({ has: page.getByRole('heading', { name: 'RAGFlow 聊天接入', exact: true }) });
    if (await settings.count() && !(await settings.locator('input').inputValue())) await settings.getByRole('button', { name: '关闭', exact: true }).click();
    await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'));
      const chat = data.conversations.find(c => c.id === data.selectedId);
      const answer = chat.messages.slice().reverse().find(m => m.assistant === 'ragflow' && m.status === 'done');
      const article = [...document.querySelectorAll('[data-message-id]')].find(el => el.dataset.messageId === answer?.id);
      const messages = document.querySelector('main.messages');
      if (article && messages) messages.scrollTop += article.getBoundingClientRect().top - messages.getBoundingClientRect().top - 8;
    });
    await page.bringToFront();
    await page.screenshot({ path: 'C:/Users/94719/.codex/visualizations/2026/10/15/01a13ea7-db9e-76c3-a593-f48a2308e0a3/em-rag-auth-fixed.png' });
    console.log('RAG answer is visible in the running EM window.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
