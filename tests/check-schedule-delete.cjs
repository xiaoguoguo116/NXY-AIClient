const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ timezoneId: 'Asia/Shanghai', viewport: { width: 1100, height: 900 } });
  page.setDefaultNavigationTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.clock.install({ time: new Date('2026-11-06T10:00:00+08:00') });
    await page.addInitScript(() => {
      if (localStorage.getItem('schedule-delete-seed')) return;
      localStorage.setItem('schedule-delete-seed', '1');
      const base = { createdAt: '2026-10-01T00:00:00Z', completed: false, reminderAt: null, scheduleVersion: 1 };
      localStorage.setItem('em.local-todos.v1', JSON.stringify({ version: 1, items: [
        { ...base, id: 'october', title: '十月历史待办', dueAt: '2026-10-31T15:00:00+08:00' },
        { ...base, id: 'today', title: '十一月六日下午待办', dueAt: '2026-11-06T15:00:00+08:00' },
        { ...base, id: 'done', title: '已完成事项', completed: true },
        { ...base, id: 'undated', title: '无日期事项' },
        { ...base, id: 'last-year', title: '去年事项', dueAt: '2025-12-31T15:00:00+08:00' }
      ] }));
      localStorage.setItem('em.local-meetings.v1', JSON.stringify({ version: 1, items: [{
        id: 'meeting', title: '十一月六日上午会议', startAt: '2026-11-06T09:00:00+08:00',
        createdAt: base.createdAt, creatorId: 'self', participants: [{ id: 'self', name: '我', kind: 'self', response: 'pending' }]
      }] }));
    });
    await page.goto(`${process.env.TEST_ORIGIN || 'http://127.0.0.1:1426'}/tests/todos-preview.html`);
    const rows = page.locator('.todos-page > article');
    await rows.first().waitFor();
    await page.getByRole('button', { name: '日程', exact: true }).click();
    assert.deepEqual(await page.locator('.schedule-date strong').allTextContents(), ['11月6日', '10月31日', '12月31日']);
    assert.deepEqual(await page.locator('.schedule-item strong').allTextContents(), ['十一月六日下午待办', '十一月六日上午会议', '十月历史待办', '去年事项']);
    fs.mkdirSync('.preview/schedule-delete', { recursive: true });
    await page.screenshot({ path: '.preview/schedule-delete/schedule-descending.png', fullPage: true });
    await page.getByRole('button', { name: '待办事项', exact: true }).click();
    const row = title => rows.filter({ has: page.locator('.content > strong', { hasText: title }) });
    const dialog = page.getByRole('dialog', { name: '删除待办', exact: true });
    const readItems = () => page.evaluate(() => JSON.parse(localStorage.getItem('em.local-todos.v1')).items);
    await row('十月历史待办').getByRole('button', { name: '删除', exact: true }).click();
    await dialog.waitFor();
    await page.clock.runFor(400);
    await page.screenshot({ path: '.preview/schedule-delete/delete-confirmation.png', fullPage: true, animations: 'disabled' });
    await dialog.getByRole('button', { name: '取消', exact: true }).click();
    assert.equal((await readItems()).length, 5);
    // A failed disk write must leave both the visible row and persisted data intact.
    await page.evaluate(() => {
      window.__originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'em.local-todos.v1') throw new Error('测试：存储写入失败');
        return window.__originalSetItem.call(this, key, value);
      };
    });
    await row('十月历史待办').getByRole('button', { name: '删除', exact: true }).click();
    await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: '存储写入失败' }).waitFor();
    assert.equal((await readItems()).length, 5);
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
    await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal(await row('十月历史待办').count(), 0);
    await page.getByRole('button', { name: '全部', exact: true }).click();
    for (const title of ['十一月六日下午待办', '已完成事项', '无日期事项']) {
      await row(title).getByRole('button', { name: '删除', exact: true }).click();
      await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      assert.equal(await row(title).count(), 0);
    }
    assert.deepEqual((await readItems()).map(item => item.id), ['last-year']);
    await page.reload();
    await rows.first().waitFor();
    assert.equal(await rows.count(), 1);
    await page.getByRole('button', { name: '日程', exact: true }).click();
    assert.deepEqual(await page.locator('.schedule-item strong').allTextContents(), ['十一月六日上午会议', '去年事项']);
    // Shared attachment data must survive until the last referencing recipient is deleted.
    const attachments = await page.evaluate(async () => {
      const { addTodo, deleteTodo, todoState } = await import('/src/stores/localTodos.ts');
      const { saveTodoAttachments, readTodoAttachment } = await import('/src/services/todoAttachments.ts');
      const files = await saveTodoAttachments([new File(['shared bytes'], 'shared.txt', { type: 'text/plain' })]);
      const first = addTodo({ title: '附件记录一', attachments: files });
      const second = addTodo({ title: '附件记录二', attachments: files });
      await deleteTodo(first.id);
      const retained = await (await readTodoAttachment(files[0].id)).text();
      await deleteTodo(second.id);
      let removed = false;
      try { await readTodoAttachment(files[0].id); } catch { removed = true; }
      return { retained, removed, remaining: todoState.items.map(item => item.id) };
    });
    assert.deepEqual(attachments, { retained: 'shared bytes', removed: true, remaining: ['last-year'] });
    assert.deepEqual(errors, []);
    console.log('PASS: date/time descending across months/years; delete/cancel/error/retry; expired, active, completed and undated deletion; schedule refresh; persistence; shared attachment cleanup.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
