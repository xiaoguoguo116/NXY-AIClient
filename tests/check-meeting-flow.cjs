// Isolated local meeting workflow; no invitations are sent to real people.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ timezoneId: 'Asia/Shanghai', viewport: { width: 1360, height: 960 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.setDefaultTimeout(12000);
  await page.addInitScript(() => {
    window.__TAURI_INTERNALS__ = { invoke: async command => command === 'plugin:notification|is_permission_granted' ? false : null };
  });
  try {
    await page.clock.setFixedTime(new Date('2026-10-23T10:00:00+08:00'));
    await page.goto('http://127.0.0.1:1420/tests/todo-flow-preview.html');
    await page.getByRole('button', { name: '＋ 建群', exact: true }).click();
    await page.getByLabel('本地群名称', { exact: true }).fill('会议功能隔离测试');
    await page.getByLabel('初始成员', { exact: true }).fill('张三，李四');
    await page.getByRole('button', { name: '创建本地群', exact: true }).click();
    await page.getByTitle('向全体或指定成员发布会议').click();
    await page.getByLabel('会议主题', { exact: true }).fill('隔离功能评审');
    await page.getByLabel('会议开始日期', { exact: true }).fill('2026-10-24');
    await page.getByLabel('会议开始时刻', { exact: true }).selectOption('10:15');
    await page.getByRole('button', { name: '确认开始时间', exact: true }).click();
    await page.getByRole('button', { name: '✓ 开始时间已确认', exact: true }).waitFor();
    await page.getByLabel('会议地点', { exact: true }).fill('测试会议室');
    await page.getByRole('button', { name: '确认发布会议', exact: true }).click();
    await page.getByText(/会议“隔离功能评审”已发布/).waitFor();
    await page.getByRole('button', { name: '关闭 AI 会议助手', exact: true }).click();
    await page.locator('.bubble').filter({ hasText: '会议已发布：隔离功能评审' }).waitFor();
    await page.getByRole('button', { name: '测试切换到待办', exact: true }).click();
    await page.locator('.section-switch').getByRole('button', { name: /会议提醒/ }).click();
    const meeting = page.locator('.meeting-card').filter({ hasText: '隔离功能评审' });
    await meeting.waitFor();
    assert.equal(await meeting.locator('.participant-row').count(), 3);
    await meeting.getByLabel('设为不参加：张三').click();
    assert.match(await meeting.innerText(), /1 人不参加/);
    await page.getByRole('button', { name: '日程', exact: true }).click();
    await page.locator('.schedule-item').filter({ hasText: '隔离功能评审' }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: '测试切换到待办', exact: true }).click();
    await page.locator('.section-switch').getByRole('button', { name: /会议提醒/ }).click();
    await meeting.waitFor();
    assert.match(await meeting.innerText(), /1 人不参加/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('em.local-meetings.v1')).items);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].startAt, '2026-10-24T02:15:00.000Z');
    assert.deepEqual(errors, []);
    const output = path.resolve('.preview/full-function-20261023');
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, 'meeting-flow.png') });
    console.log('PASS: local group, meeting time confirmation, publication, attendance feedback, schedule and reload persistence. No real invitations sent.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
