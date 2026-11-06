const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
  page.setDefaultTimeout(15000);
  const before = JSON.parse(fs.readFileSync('.preview/verification-20261104/before-labels.json', 'utf8'));
  try {
    await page.goto('http://tauri.localhost/home/message');
    await page.locator('.local-chat').waitFor();
    const current = await page.evaluate(() => ({ chats: JSON.parse(localStorage.getItem('em.local-chat.v1')), todos: localStorage.getItem('em.local-todos.v1'), meetings: localStorage.getItem('em.local-meetings.v1') }));
    assert.equal(current.chats.caseLabelsVersion, 1);
    assert.equal(current.chats.conversations.length, before.chats.conversations.length);
    assert.equal(current.todos, before.todos);
    assert.equal(current.meetings, before.meetings);
    for (const old of before.chats.conversations) {
      const chat = current.chats.conversations.find(c => c.id === old.id);
      assert(chat); assert.doesNotMatch(chat.name, /模拟|测试|演示|示例/);
      assert.deepEqual(chat.messages.map(m => m.id), old.messages.map(m => m.id));
      assert.deepEqual(chat.members, old.members);
      for (const [i, message] of chat.messages.entries()) {
        const { text: ignored, ...rest } = message;
        const { text: priorText, ...priorRest } = old.messages[i];
        assert.deepEqual(rest, priorRest);
      }
    }
    await page.locator('.conversation').filter({ hasText: '项目协作群' }).first().click();
    assert.doesNotMatch(await page.locator('.local-chat').innerText(), /模拟成员|本地测试|未读演示|模拟项目|本地示例/);
    await page.screenshot({ path: '.preview/verification-20261104/chat-labels.png' });
    console.log('PASS: business labels applied; 25 conversations, all message IDs, metadata, members, todos and meetings preserved');
    await page.reload();
    await page.getByRole('button', { name: /新建/ }).click();
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-chat.v1')).selectedId);
    const results = [];
    for (const question of ['@AI 请用一句话说明如何整理会议纪要。', '@AI RAG助手 查制度：出差申请需要提前多久提交，不同预算金额分别由谁审批？', '@AI RAG助手 找人：数据库权限开通应该联系谁？']) {
      await page.getByRole('textbox', { name: '消息输入框', exact: true }).fill(question);
      const start = Date.now();
      await page.getByRole('button', { name: '发送', exact: true }).click();
      await page.waitForFunction(id => {
        const message = JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id).messages.at(-1);
        return message.role === 'assistant' && message.status !== 'pending';
      }, id, { timeout: 130000 });
      const message = await page.evaluate(id => JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c => c.id === id).messages.at(-1), id);
      assert.equal(message.status, 'done', message.error);
      assert(message.text.length > 5);
      results.push({ question, seconds: (Date.now()-start)/1000, text: message.text, references: message.rag?.references?.length });
      console.log(JSON.stringify({ question, status: message.status, seconds: results.at(-1).seconds, references: results.at(-1).references }));
    }
    fs.writeFileSync('.preview/verification-20261104/desktop-chat.json', JSON.stringify(results, null, 2));
    await page.screenshot({ path: '.preview/verification-20261104/desktop-chat.png' });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
