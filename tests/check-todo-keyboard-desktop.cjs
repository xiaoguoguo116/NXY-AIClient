// Actual packaged client: keyboard input, save/edit, reload persistence.
// Removes ONLY the uniquely identified task created by this test; never restores old snapshots.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
(async () => {
  let browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  let page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
  assert(page, 'formal home window exists');
  const marker = `【输入验证】${Date.now()}`;
  let createdId;
  const protectedKeys = ['em.local-ai.v1', 'em.local-ai-key.v1', 'em.local-chat.v1', 'em.local-meetings.v1'];
  const before = await page.evaluate(keys => ({
    todos: JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"items":[]}').items,
    protected: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]))
  }), protectedKeys);
  try {
    await page.goto('http://tauri.localhost/home/todos');
    await page.evaluate(async () => {
      for (const command of ['plugin:window|unminimize', 'plugin:window|show', 'plugin:window|set_focus'])
        await window.__TAURI_INTERNALS__.invoke(command, { label: 'home' });
    });
    await page.getByRole('button', { name: '新建待办', exact: true }).click();
    const title = page.getByLabel('待办事项内容', { exact: true });
    await title.click();
    assert.equal(await title.evaluate(el => document.activeElement === el), true, 'click retains focus');
    await page.keyboard.type('keyboard-test');
    assert.equal(await title.inputValue(), 'keyboard-test');
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(marker);
    assert.equal(await title.inputValue(), marker, 'Chinese keyboard insertion works');
    await page.getByLabel('待办提醒方式', { exact: true }).selectOption('off');
    await page.getByRole('button', { name: '添加待办', exact: true }).click();
    await page.locator('.todo-editor-dialog').waitFor({ state: 'detached' });
    const stored = await page.evaluate(marker => JSON.parse(localStorage.getItem('em.local-todos.v1')).items.find(t => t.title === marker), marker);
    assert(stored && stored.reminderAt === null, 'task saved without a reminder');
    createdId = stored.id;
    const row = page.locator('.todos-page > article').filter({ hasText: marker });
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    await title.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText(' 已编辑');
    assert.equal(await title.inputValue(), marker + ' 已编辑');
    await page.getByLabel('待办结束时间日期', { exact: true }).fill('2026-10-28');
    await page.getByLabel('待办结束时间时刻', { exact: true }).selectOption('09:15');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await page.locator('.todo-editor-dialog').waitFor({ state: 'detached' });
    await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('plugin:process|exit', { code: 0 }))
      .catch(e => { if (!/closed|Target|disconnected/i.test(e.message)) throw e; });
    await browser.close();
    execFileSync('powershell.exe', ['-NoProfile', '-Command',
      "Start-Process -FilePath 'D:\\ai\\NXY-AIClient\\src-tauri\\target\\release\\em.exe' -WorkingDirectory 'D:\\ai\\NXY-AIClient' -WindowStyle Normal"], {
      env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-address=127.0.0.1 --remote-debugging-port=19224' },
      windowsHide: true
    });
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 1000 });
        page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
        if (page) break;
        await browser.close();
      } catch { /* Wait for the same formal client to finish startup. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert(page && !page.isClosed(), 'formal client restarted');
    await page.goto('http://tauri.localhost/home/todos');
    await page.locator('.todos-page > article').filter({ hasText: marker + ' 已编辑' }).waitFor();
    const persisted = await page.evaluate(id => JSON.parse(localStorage.getItem('em.local-todos.v1')).items.find(t => t.id === id), createdId);
    assert.equal(persisted.title, marker + ' 已编辑');
    assert.equal(new Date(persisted.dueAt).getMinutes(), 15);
    assert.equal(persisted.reminderAt, null);
    await page.screenshot({ path: path.resolve('.preview/todo-recipient-tests/desktop-keyboard-saved.png'), fullPage: true });
    console.log('PASS: formal client accepts mouse+keyboard English/Chinese input, saves, edits, selects quarter-hour time, and retains the created task after a full native process restart.');
  } finally {
    const removed = await page.evaluate(({ id, marker }) => {
      const data = JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"items":[]}');
      const matches = data.items.filter(t => id ? t.id === id : t.title === marker);
      if (matches.length === 1 && matches[0].title.startsWith(marker)) {
        data.items = data.items.filter(t => t.id !== matches[0].id);
        localStorage.setItem('em.local-todos.v1', JSON.stringify(data));
        return true;
      }
      return false;
    }, { id: createdId, marker });
    await page.reload();
    await page.getByRole('button', { name: '新建待办', exact: true }).waitFor();
    const preserved = await page.evaluate(before => {
      const current = JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"items":[]}').items;
      return before.todos.every(old => current.some(item => item.id === old.id && JSON.stringify(item) === JSON.stringify(old))) &&
        Object.entries(before.protected).every(([key, value]) => localStorage.getItem(key) === value);
    }, before);
    await browser.close();
    assert.equal(preserved, true, 'existing todos, chat records, meetings and AI configuration are preserved');
    console.log(`Test task removed: ${removed}; existing user data unchanged.`);
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
