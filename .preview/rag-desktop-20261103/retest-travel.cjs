const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 10000 });
  const logs = [];
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('tauri.localhost/home'));
    if (!page) throw new Error('Desktop home not found');
    page.on('console', async message => {
      if (!message.text().startsWith('[RAG timing]')) return;
      const values = await Promise.all(message.args().map(a => a.jsonValue().catch(() => null)));
      logs.push(values[1]);
      console.log(JSON.stringify(values[1]));
    });
    if (!page.url().includes('/home/message')) await page.goto('http://tauri.localhost/home/message');
    const input = page.getByRole('textbox', { name: '消息输入框', exact: true });
    await input.waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: /新建/ }).click();
    if (await input.inputValue()) throw new Error('New test chat has a draft; refusing to overwrite it');
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).selectedId);
    await input.fill('@AI RAG助手 出差流程');
    const started = Date.now();
    await page.getByRole('button', { name: '发送', exact: true }).click();
    console.log(JSON.stringify({ stage: 'sent', conversationId: id }));
    await page.waitForFunction(id => {
      const chat = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id);
      const message = chat?.messages.at(-1);
      return message?.assistant === 'ragflow' && message.status !== 'pending';
    }, id, { timeout: 135000 });
    const result = await page.evaluate(id => {
      const chat = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id);
      const message = chat.messages.at(-1);
      return { status: message.status, error: message.error, text: message.text, references: message.rag?.references?.length, options: message.rag?.options?.length };
    }, id);
    result.elapsedMs = Date.now() - started;
    result.logs = logs;
    fs.writeFileSync('.preview/rag-desktop-20261103/travel-retest.json', JSON.stringify(result, null, 2));
    await page.screenshot({ path: '.preview/rag-desktop-20261103/travel-retest.png' });
    console.log(JSON.stringify({ ...result, logs: undefined }));
    if (result.status !== 'done') process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
