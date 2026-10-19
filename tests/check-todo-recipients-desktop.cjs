// Read-only packaged-client verification: no task writes, attachments or native dialogs.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 15000 });
  const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().includes('/home'));
  assert(page, 'EM home window is available');
  const saved = await page.evaluate(() => localStorage.getItem('em.local-todos.v1'));
  let search;
  try {
    if (!page.url().endsWith('/home/todos')) await page.goto('http://tauri.localhost/home/todos');
    search = page.getByLabel('搜索待办接收人', { exact: true });
    await search.waitFor({ state: 'attached' });
    await page.getByText(/可选 \d+ 位联系人/).waitFor();
    assert.equal(await page.locator('.todo-editor').count(), 0, 'list opens without the editor');
    const firstRow = page.locator('.todos-page > article').first();
    if (await firstRow.count()) {
      const box = await firstRow.boundingBox();
      assert(box && box.y < await page.evaluate(() => innerHeight), 'first task visible without scrolling');
    }
    await page.getByRole('button', { name: '新建待办', exact: true }).click();
    await page.getByLabel('待办事项内容', { exact: true }).waitFor();
    await page.screenshot({ path: path.resolve('.preview/todo-recipient-tests/desktop-editor-window.png'), fullPage: true });
    await page.getByRole('button', { name: '关闭待办编辑', exact: true }).click();
    await page.locator('.todo-editor-dialog').waitFor({ state: 'detached' });
    const options = page.locator('.n-base-select-option');
    for (const term of ['sq', '苏', '前端']) {
      if (!await search.isVisible()) await page.locator('.viewer-label .n-base-selection').click();
      await search.fill(term);
      await options.filter({ hasText: '苏晴' }).waitFor();
    }
    await options.filter({ hasText: '苏晴' }).click();
    assert.equal(await page.locator('.viewer-label .n-tag').count(), 2, 'self and contact selected together');
    await search.fill('qiaoan');
    await options.filter({ hasText: '乔安' }).click();
    assert.equal(await page.locator('.viewer-label .n-tag').count(), 3, 'another contact can be added');
    await search.fill('sq');
    await options.filter({ hasText: '苏晴' }).click();
    assert.equal(await page.locator('.viewer-label .n-tag').count(), 2, 'deselecting only removes that person');
    if (!await search.isVisible()) await page.locator('.viewer-label .n-base-selection').click();
    await search.fill('不存在的接收人xyz');
    await page.getByText('没有找到匹配的联系人或历史接收人').waitFor();
    await search.fill('sq');
    await options.filter({ hasText: '苏晴' }).waitFor();
    const output = path.resolve('.preview/todo-recipient-tests');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'desktop-recipient-search.png'), fullPage: true });
    assert.equal(await page.evaluate(() => localStorage.getItem('em.local-todos.v1')), saved, 'recipient browsing does not alter saved tasks');
    await search.press('Escape');
    await page.getByRole('button', { name: '查看所有', exact: true }).click();
    assert.equal(await page.locator('.viewer-label .n-tag').count(), 1);
    await page.getByRole('button', { name: '清空选择', exact: true }).click();
    await page.getByText('请选择一个或多个接收人。').waitFor();
    console.log('PASS: packaged client supports multiple contacts, search, deselection, view all, clear and empty feedback; saved tasks unchanged. No native file dialogs.');
  } finally {
    if (search && await search.count()) {
      await search.press('Escape');
      await page.getByRole('button', { name: '只看我', exact: true }).click();
      await page.screenshot({ path: path.resolve('.preview/todo-recipient-tests/desktop-todo-list.png'), fullPage: true });
    }
    await page.evaluate(async () => {
      for (const command of ['plugin:window|unminimize', 'plugin:window|show', 'plugin:window|set_focus'])
        await window.__TAURI_INTERNALS__.invoke(command, { label: 'home' }).catch(() => {});
    });
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
