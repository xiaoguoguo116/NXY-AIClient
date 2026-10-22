// Real packaged UI/IPC/ACP/file operations, with an explicitly synthetic local model.
// No private files, credentials, file chooser, download/save dialogs or external model calls.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const python = process.env.OFFICE_TEST_PYTHON || 'C:/Users/94719/AppData/Local/chat.linyu/work-assistant/runtimes/office/Scripts/python.exe';
const output = path.resolve('.preview/office-verification', `desktop-${Date.now()}`);
const providerId = `office-test-${Date.now()}`;
const title = `[本机协议自测] Excel和Word文件处理 ${Date.now()}`;
let turns = 0;
const failures = [];
const toolCall = (name, args, index) => ({ id: `call-${turns}-${index}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const server = createServer(async (req, res) => {
  try {
    assert.equal(req.url, '/v1/chat/completions');
    let body = ''; for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    assert(request.tools.some(tool => tool.function.name === 'edit_sheet'));
    for (const item of request.messages.filter(item => item.role === 'tool')) assert(!JSON.parse(item.content).error, item.content);
    turns++;
    let calls;
    if (turns === 1) calls = [['read_sheet', { path: 'input.xlsx' }], ['read_file', { path: 'input.docx' }]];
    else if (turns === 2) calls = [
      ['edit_sheet', { path: 'input.xlsx', output: 'result.xlsx', operations: [{ type: 'trim' }, { type: 'deduplicate' }, { type: 'summary', group_column: 1, value_column: 2 }] }],
      ['write_document', { path: 'input.docx', output: 'result.docx', replacements: [{ find: '每月', replace: '每周' }, { find: '原业务部', replace: '合规部' }], paragraphs: [{ text: '本文件为修订草稿，需人工审核。' }] }]
    ];
    else if (turns === 3) calls = [['read_sheet', { path: 'result.xlsx', sheet: 'Summary' }], ['read_file', { path: 'result.docx' }]];
    else assert.equal(turns, 4);
    const message = calls ? { role: 'assistant', content: null, tool_calls: calls.map(([name, args], i) => toolCall(name, args, i)) }
      : { role: 'assistant', content: '本机协议自测完成（使用模拟模型，不代表真实模型验证）。已读取并生成 result.xlsx 和 result.docx，原件保留。Excel 去空格、去重后支付部门合计 301，风控部门合计 50；Word 已改为每周检查、责任部门合规部，并加入人工审核草稿说明。' };
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message }] }));
  } catch (error) { failures.push(error.message); res.writeHead(500); res.end('{}'); }
});
(async () => {
  fs.mkdirSync(output, { recursive: true });
  execFileSync(python, [path.resolve('tests/office_desktop_fixtures.py'), 'create', output], { windowsHide: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
  assert(page);
  const invoke = (command, args = {}) => page.evaluate(({ command, args }) => window.__TAURI_INTERNALS__.invoke(command, args), { command, args });
  const preferences = await invoke('work_preferences_get');
  const priorLocal = await page.evaluate(() => localStorage.getItem('workAssistant'));
  let providerCreated = false;
  try {
    assert.equal((await invoke('work_status')).activeSessions, 0, 'do not interrupt existing agent sessions');
    if (await page.locator('.workbench__composer textarea').count()) {
      assert.equal(await page.locator('.workbench__composer textarea').inputValue(), '', 'no existing draft');
    }
    providerCreated = true;
    await invoke('work_provider_save', { input: { id: providerId, name: '本机协议自测（模拟模型）', kind: 'openai', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, models: ['office-fixture'], defaultModel: 'office-fixture', apiKey: 'local-fixture-only', enabled: true } });
    await invoke('work_preferences_save', { input: { ...preferences, activeRuntimeId: 'office', activeProviderId: providerId, activeModel: 'office-fixture', approvalMode: 'ask' } });
    await page.evaluate(({ output, priorLocal }) => localStorage.setItem('workAssistant', JSON.stringify({ ...JSON.parse(priorLocal || '{}'), workspacePath: output, scopeMode: 'workspace' })), { output, priorLocal });
    await page.goto('http://tauri.localhost/home/ai?view=tasks');
    const composer = page.locator('.workbench__composer textarea');
    await composer.fill(title + '\n读取工作文件夹的 input.xlsx，去空格、去重，按部门求和，另存 result.xlsx。读取 input.docx，将每月改为每周、原业务部改为合规部，追加人工审核说明，另存 result.docx。核对结果并保留原件。');
    assert(await page.evaluate(() => Boolean(document.querySelector('.work-status__agent-mark--ready') || document.querySelector('.workbench__send')?.disabled)), 'send must stay disabled until initialization completes');
    await page.locator('.work-status__agent-mark--ready').waitFor();
    await page.locator('.work-status').getByText('本机协议自测（模拟模型） · office-fixture', { exact: true }).waitFor();
    await page.locator('.workbench__send').click();
    for (const filename of ['result.xlsx', 'result.docx']) {
      const dialog = page.locator('.work-permission');
      await dialog.locator('.work-permission__main > strong').filter({ hasText: filename }).waitFor({ timeout: 30000 });
      await dialog.locator('footer .n-button--primary-type').click();
      await page.waitForFunction(name => !document.querySelector('.work-permission')?.textContent.includes(name), filename);
    }
    await page.locator('.workbench__messages').getByText('本机协议自测完成', { exact: false }).waitFor({ timeout: 30000 });
    await page.locator('.workbench__stop').waitFor({ state: 'hidden' });
    assert.equal(turns, 4);
    assert.deepEqual(failures, []);
    for (const filename of ['result.xlsx', 'result.docx']) {
      assert(fs.existsSync(path.join(output, filename)));
      await page.locator('.work-attachments__info strong').filter({ hasText: filename }).waitFor();
    }
    console.log(execFileSync(python, [path.resolve('tests/office_desktop_fixtures.py'), 'verify', output], { windowsHide: true, encoding: 'utf8' }).trim());
    await page.screenshot({ path: path.join(output, 'desktop-office-result.png'), fullPage: true });
    await page.reload();
    await page.getByText(title.slice(0, 28), { exact: true }).first().click();
    for (const filename of ['result.xlsx', 'result.docx']) await page.locator('.work-attachments__info strong').filter({ hasText: filename }).waitFor();
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ mode: 'synthetic-model-real-client-and-files', turns, permissionApprovals: 2, artifactsPersistAfterReload: true, originalFilesUnchanged: true }, null, 2));
    console.log(`PASS: native UI -> Rust -> ACP -> tools -> files -> visible persisted attachments. Evidence: ${output}`);
  } catch (error) {
    console.error('Original test failure:', error.message);
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    const taskErrors = await page.locator('.workbench__error-card').allTextContents();
    if (taskErrors.length) console.error('Task errors:', taskErrors.join('; '));
    if (await page.locator('.workbench__stop').isVisible()) {
      await page.locator('.workbench__stop').click({ force: true }).catch(() => {});
      await page.locator('.workbench__stop').waitFor({ state: 'hidden' }).catch(() => {});
    }
    throw error;
  } finally {
    if (providerCreated) {
      const current = await invoke('work_preferences_get');
      if (current.activeProviderId === providerId) await invoke('work_preferences_save', { input: preferences }).catch(error => console.error('Restore preferences:', error.message));
      await invoke('work_provider_delete', { id: providerId }).catch(error => console.error('Remove temporary provider:', error.message));
    }
    await page.evaluate(prior => { if (prior === null) localStorage.removeItem('workAssistant'); else localStorage.setItem('workAssistant', prior); }, priorLocal);
    await page.goto('http://tauri.localhost/home/ai?view=tasks');
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.message); server.close(); process.exitCode = 1; });
