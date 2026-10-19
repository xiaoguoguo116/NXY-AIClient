// Isolated browser only: no desktop dialogs, native downloads or real user records.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const { getLocalFriendList } = await import('../src/services/localContacts.ts');
  const contacts = getLocalFriendList();
  const person = contacts.find(person => person.username === '苏晴');
  person.remark = '苏老师';
  const base = { title: '', createdAt: '2026-10-19T02:00:00Z', completed: false, scheduleVersion: 1 };
  const todos = [
    { ...base, id: 'self-task', title: '自己的事项' },
    { ...base, id: 'contact-task', title: '联系人任务甲', assigneeId: person.peerId, assigneeName: '苏晴' },
    { ...base, id: 'prefixed-task', title: '联系人任务乙', assigneeId: `contact:${person.peerId}`, assigneeName: '苏晴' },
    { ...base, id: 'history-task', title: '历史成员事项', assigneeId: 'old-member', assigneeName: '张三' }
  ];
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.addInitScript(({ contacts, todos }) => {
      localStorage.setItem('em.todo-test-contacts', JSON.stringify(contacts));
      localStorage.setItem('em.local-todos.v1', JSON.stringify({ version: 1, items: todos }));
    }, { contacts, todos });
    await page.goto('http://127.0.0.1:1425/tests/todos-preview.html');
    await page.getByText(/可选 13 位联系人/).waitFor();
    assert.equal(await page.locator('.todo-editor').count(), 0, 'editor is hidden until requested');
    const firstTask = await page.locator('.todos-page > article').first().boundingBox();
    assert(firstTask && firstTask.y + firstTask.height < 720, 'task is visible without scrolling on a 720px screen');
    await page.getByRole('button', { name: '清空选择', exact: true }).click();
    await page.getByText('请选择一个或多个接收人。').waitFor();
    const search = page.getByLabel('搜索待办接收人', { exact: true });
    const options = page.locator('.n-base-select-option');
    async function query(text) { if (!await search.isVisible()) await page.locator('.viewer-label .n-base-selection').click(); await search.fill(text); }
    for (const term of ['晴', '老师', 'SU.Q', '前端', 'suqing', 'sq', '前端 sq']) {
      await query(term);
      await options.filter({ hasText: '苏老师' }).waitFor();
    }
    await options.filter({ hasText: '苏老师' }).click();
    const rows = page.locator('.todos-page > article');
    assert.equal(await rows.count(), 2);
    assert((await rows.allTextContents()).every(text => text.includes('联系人任务')));
    await query('zhangsan');
    await options.filter({ hasText: '张三' }).click();
    assert.equal(await rows.count(), 3, 'multiple recipients show the union of their tasks');
    assert.equal(await page.locator('.viewer-label .n-tag').count(), 2);
    await query('sq');
    await options.filter({ hasText: '苏老师' }).click();
    assert.equal(await rows.count(), 1, 'deselecting one recipient retains the other');
    await search.press('Escape');
    await page.getByRole('button', { name: '清空选择', exact: true }).click();
    await query('qiaoan');
    await options.filter({ hasText: '乔安' }).click();
    await page.getByText('乔安暂无未完成待办记录。这里查看本机保存的待办。').waitFor();
    assert.equal(await rows.count(), 0);
    await query('不存在的联系人');
    await page.getByText('没有找到匹配的联系人或历史接收人').waitFor();
    await search.press('Escape');
    assert.equal(await rows.count(), 0, 'cancelled search keeps the selected contact');
    await query('zhangsan');
    await options.filter({ hasText: '张三' }).click();
    assert.equal(await rows.count(), 1);
    assert.match(await rows.innerText(), /历史成员事项/);
    await query('all');
    await search.press('ArrowDown');
    await search.press('Enter');
    assert.equal(await rows.count(), 4, 'keyboard selection supports all recipients');
    await query('self');
    await options.filter({ hasText: /^我$/ }).click();
    assert.equal(await rows.count(), 1);
    assert.match(await rows.innerText(), /自己的事项/);
    assert.equal(await page.locator('.viewer-label .n-tag').count(), 1, 'individual selection leaves all mode');
    await search.press('Escape');
    await page.getByRole('button', { name: '新建待办', exact: true }).click();
    await page.getByLabel('待办事项内容', { exact: true }).fill('取消的新待办');
    await page.getByRole('button', { name: '关闭待办编辑', exact: true }).click();
    assert.equal(await rows.count(), 1, 'closing creation does not create a task');
    await page.getByRole('button', { name: '新建待办', exact: true }).click();
    assert.equal(await page.getByLabel('待办事项内容', { exact: true }).inputValue(), '');
    await page.getByLabel('待办事项内容', { exact: true }).fill('列表优先测试');
    await page.getByRole('button', { name: '添加待办', exact: true }).click();
    await page.locator('.todo-editor-dialog').waitFor({ state: 'detached' });
    const created = rows.filter({ hasText: '列表优先测试' });
    await created.waitFor();
    await created.getByRole('button', { name: '编辑', exact: true }).click();
    await page.getByLabel('待办事项内容', { exact: true }).fill('编辑后返回列表');
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await page.locator('.todo-editor-dialog').waitFor({ state: 'detached' });
    await rows.filter({ hasText: '编辑后返回列表' }).waitFor();
    await query('sq');
    const out = path.resolve('.preview/todo-recipient-tests');
    fs.mkdirSync(out, { recursive: true });
    await page.screenshot({ path: path.join(out, 'recipient-search.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.equal(await page.locator('body').evaluate(body => body.scrollWidth > innerWidth), false);
    console.log('PASS: list visible without scrolling; create/cancel/edit/save return to list; all 13 contacts, fuzzy search, multiple selection and empty feedback. No native dialogs.');
  } catch (error) {
    fs.mkdirSync(path.resolve('.preview/todo-recipient-tests'), { recursive: true });
    await page.screenshot({ path: path.resolve('.preview/todo-recipient-tests/multi-failure.png'), fullPage: true });
    console.error('Page errors:', errors);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
