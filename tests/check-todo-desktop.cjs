// Actual packaged-client test. Creates only a uniquely named fixture and removes it afterward.
// Native save dialog and file writes are both exercised with a controlled test path.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const execFile = require('node:util').promisify(require('node:child_process').execFile);
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224', { timeout: 15000 });
  const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().includes('/home'));
  assert(page, 'EM home window is available');
  const fixtureTitle = `客户端自测-${Date.now()} 明天下午三点提交报告`;
  const output = path.resolve('.preview/todo-editor-tests');
  fs.mkdirSync(output, { recursive: true });
  const downloadPath = path.join(output, `desktop-attachment-${Date.now()}.txt`);
  const bytes = Buffer.from('桌面附件验证：保存、刷新与原生下载。', 'utf8');
  let fixtureId;
  const fileIds = [];
  try {
    await page.goto('http://tauri.localhost/home/todos');
    await page.getByLabel('待办事项内容', { exact: true }).waitFor();
    const expected = await page.evaluate(() => {
      const due = new Date(); due.setDate(due.getDate() + 1); due.setHours(15, 0, 0, 0);
      return { iso: due.toISOString(), day: new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 10) };
    });
    await page.getByLabel('待办事项内容', { exact: true }).fill(fixtureTitle);
    await page.getByLabel('待办事项内容', { exact: true }).blur();
    assert.equal(await page.getByLabel('待办结束时间日期').inputValue(), expected.day);
    assert.equal(await page.getByLabel('待办结束时间时刻').inputValue(), '15:00');
    assert.equal(await page.getByLabel('待办结束时间时刻').locator('option').count(), 97);
    await page.getByLabel('待办提醒方式').selectOption('custom');
    await page.getByLabel('待办提醒时间日期').fill('2030-12-31');
    await page.getByLabel('待办提醒时间时刻').selectOption('23:45');
    await page.getByLabel('待办文档附件').setInputFiles({ name: '桌面测试文档.txt', mimeType: 'text/plain', buffer: bytes });
    await page.getByRole('button', { name: '添加待办', exact: true }).click();
    const row = page.locator('.todos-page > article').filter({ hasText: fixtureTitle });
    await row.waitFor();
    const readFixture = () => page.evaluate(title => JSON.parse(localStorage.getItem('em.local-todos.v1')).items.find(item => item.title === title), fixtureTitle);
    let item = await readFixture();
    fixtureId = item.id;
    fileIds.push(...item.attachments.map(file => file.id));
    assert.equal(item.dueAt, expected.iso);
    assert.equal(item.reminderAt, '2030-12-31T15:45:00.000Z');
    await page.reload();
    await row.waitFor();
    await row.getByRole('button', { name: '下载附件：桌面测试文档.txt', exact: true }).click();
    await execFile('powershell.exe', ['-NoProfile', '-File', path.resolve('tests/save-todo-attachment-dialog.ps1'), '-Destination', downloadPath], { windowsHide: true, timeout: 25000 });
    for (let count = 0; count < 40 && !fs.existsSync(downloadPath); count++) await new Promise(resolve => setTimeout(resolve, 250));
    if (!fs.existsSync(downloadPath)) throw new Error(`Native download failed: ${await page.getByRole('alert').allTextContents()}`);
    assert.deepEqual(fs.readFileSync(downloadPath), bytes);
    await row.getByRole('button', { name: '15 分钟后提醒', exact: true }).click();
    item = await readFixture();
    assert.equal(item.dueAt, expected.iso);
    assert(Math.abs(Date.parse(item.reminderAt) - Date.now() - 900000) < 15000);
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    await page.getByLabel('待办提醒方式').selectOption('off');
    await page.getByRole('button', { name: '移除附件：桌面测试文档.txt', exact: true }).click();
    await page.getByRole('button', { name: '保存修改', exact: true }).click();
    await page.getByRole('button', { name: '添加待办', exact: true }).waitFor();
    item = await readFixture();
    assert.equal(item.reminderAt, null);
    assert.deepEqual(item.attachments, []);
    assert.equal(await page.locator('body').evaluate(body => body.scrollWidth > innerWidth), false);
    console.log('PASS: actual packaged client shows new editor; Chinese deadline, quarter-hour options, distant reminder, persisted attachment, native file write, snooze preserving deadline and removal. Test fixture will be removed.');
  } finally {
    await page.evaluate(async ({ fixtureId, fixtureTitle, fileIds }) => {
      const data = JSON.parse(localStorage.getItem('em.local-todos.v1') || '{"version":1,"items":[]}');
      const fixtures = data.items.filter(item => fixtureId ? item.id === fixtureId : item.title === fixtureTitle);
      const ids = new Set([...fileIds, ...fixtures.flatMap(item => (item.attachments || []).map(file => file.id))]);
      data.items = data.items.filter(item => fixtureId ? item.id !== fixtureId : item.title !== fixtureTitle);
      localStorage.setItem('em.local-todos.v1', JSON.stringify(data));
      if (ids.size) await new Promise((resolve, reject) => {
        const req = indexedDB.open('em-todo-attachments-v1', 1);
        req.onsuccess = () => { const db = req.result; const tx = db.transaction('files', 'readwrite'); ids.forEach(id => tx.objectStore('files').delete(id)); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = reject; };
        req.onerror = reject;
      });
    }, { fixtureId, fixtureTitle, fileIds }).catch(error => console.error('Fixture cleanup:', error.message));
    await page.reload();
    await page.getByLabel('待办事项内容', { exact: true }).waitFor();
    await page.evaluate(async () => {
      for (const command of ['plugin:window|unminimize', 'plugin:window|show', 'plugin:window|set_focus'])
        await window.__TAURI_INTERNALS__.invoke(command, { label: 'home' }).catch(() => {});
    });
    await page.screenshot({ path: path.join(output, 'desktop-todos-updated.png'), fullPage: true });
    await browser.close();
  }
})().catch(error => {
  if (Buffer.isBuffer(error.stdout)) console.error(new TextDecoder('gb18030').decode(error.stdout));
  console.error(error.message); process.exitCode = 1;
});
