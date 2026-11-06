const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('tauri.localhost/home'));
    const state = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'));
      const chat = data.conversations.find(c => c.id === 'c0ff7a6e-836f-495f-9cec-735ac0a98844');
      return { id: chat.id, selected: data.selectedId, previous: chat.messages.at(-1).id, question: chat.messages.at(-1).rag.options[0].question };
    });
    if (state.id !== state.selected) throw new Error('Test chat is no longer selected');
    page.on('console', async message => {
      if (message.text().startsWith('[RAG timing]')) console.log(JSON.stringify(await message.args()[1].jsonValue()));
    });
    const started = Date.now();
    await page.getByRole('button', { name: state.question }).click();
    await page.waitForFunction(state => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'));
      const message = data.conversations.find(c => c.id === state.id).messages.at(-1);
      return message.id !== state.previous && message.assistant === 'ragflow' && message.status !== 'pending';
    }, state, { timeout: 135000 });
    const result = await page.evaluate(id => {
      const data = JSON.parse(localStorage.getItem('em.local-chat.v1'));
      const message = data.conversations.find(c => c.id === id).messages.at(-1);
      return { status: message.status, error: message.error, text: message.text, references: message.rag?.references?.length, options: message.rag?.options?.length };
    }, state.id);
    result.elapsedMs = Date.now() - started;
    fs.writeFileSync('.preview/rag-desktop-20261103/travel-followup.json', JSON.stringify(result, null, 2));
    await page.screenshot({ path: '.preview/rag-desktop-20261103/travel-followup.png' });
    console.log(JSON.stringify(result));
    if (result.status !== 'done' || !result.references) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
