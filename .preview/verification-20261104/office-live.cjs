// Opt-in real-provider test. Uses the user's already configured model, synthetic files only.
// No provider credentials are read into Node, logged, or written to the report.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const python = process.env.OFFICE_TEST_PYTHON || 'C:/Users/94719/AppData/Local/chat.linyu/work-assistant/runtimes/office/Scripts/python.exe';
const output = path.resolve('.preview/office-verification', `live-${Date.now()}`);
const title = `[办公资料整理] Excel与Word ${Date.now()}`;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  execFileSync(python, [path.resolve('tests/office_desktop_fixtures.py'), 'create', output], { windowsHide: true });
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
  assert(page);
  const priorLocal = await page.evaluate(() => localStorage.getItem('workAssistant'));
  let approvals = 0;
  try {
    await page.evaluate(async () => {
      for (const action of ['unminimize', 'show', 'set_focus'])
        await window.__TAURI_INTERNALS__.invoke(`plugin:window|${action}`, { label: 'home' });
    });
    const status = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('work_status'));
    assert(status.runtime.installed && status.runtime.id === 'office');
    const globalModel = await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('em.local-ai.v1') || '{}');
      return { model: config.model, configured: !!config.model && !!config.baseUrl };
    });
    assert(globalModel.configured, 'global model must be configured');
    assert.equal(status.activeSessions, 0, 'do not interrupt an existing agent session');
    if (await page.locator('.workbench__composer textarea').count()) {
      assert.equal(await page.locator('.workbench__composer textarea').inputValue(), '');
    }
    await page.evaluate(({ output, priorLocal }) => localStorage.setItem('workAssistant', JSON.stringify({ ...JSON.parse(priorLocal || '{}'), workspacePath: output, scopeMode: 'workspace' })), { output, priorLocal });
    await page.goto('http://tauri.localhost/home/ai?view=tasks');
    await page.locator('.work-status').getByText(`全局模型 · ${globalModel.model}`, { exact: true }).waitFor();
    await page.locator('.workbench__composer textarea').fill(title + '\n请实际处理工作文件夹中两个输入文件，完成后读回核对。1. input.xlsx 的明细表：去除文本首尾空格，按整行去重；按部门汇总金额，Summary 工作表两列表头为“部门”和“sum”，按部门首次出现顺序排列；保留清洗后的明细，另存 result.xlsx。2. input.docx：保留原文件和文字格式，把正文中的“每月”替换为“每周”、表格中的“原业务部”替换为“合规部”，末尾追加一段“本文件为修订草稿，需人工审核。”，另存 result.docx。只生成这两个结果文件，不覆盖原件；不要仅提供做法。');
    await page.locator('.workbench__send').click();
    await page.locator('.workbench__stop').waitFor({ timeout: 15000 });
    const deadline = Date.now() + 240000;
    while (Date.now() < deadline) {
      const dialog = page.locator('.work-permission');
      if (await dialog.isVisible() && await dialog.locator('.work-permission__main > strong').count()) {
        const heading = await dialog.locator('.work-permission__main > strong').innerText();
        assert(/result\.(xlsx|docx)$/.test(heading), `Unexpected output approval: ${heading}`);
        await dialog.locator('footer .n-button--primary-type').click();
        approvals++;
        await page.waitForFunction(title => document.querySelector('.work-permission__main > strong')?.textContent !== title, heading, { polling: 100 });
      }
      if (!await page.locator('.workbench__stop').isVisible()) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(!await page.locator('.workbench__stop').isVisible(), 'real model task timed out');
    const errors = await page.locator('.workbench__error-card').allTextContents();
    assert.deepEqual(errors, []);
    console.log(execFileSync(python, [path.resolve('tests/office_desktop_fixtures.py'), 'verify', output], { windowsHide: true, encoding: 'utf8' }).trim());
    for (const name of ['result.xlsx', 'result.docx']) await page.locator('.work-attachments__info strong').filter({ hasText: name }).waitFor();
    const copyText = '文件整理记录：保留原文与原文件。\n金额 123.4500 万元。\n';
    fs.writeFileSync(path.join(output, 'notes.txt'), copyText);
    await page.locator('.workbench__composer textarea').fill('继续进行文件整理：在工作文件夹中查找 notes.txt，读取确认后，原样复制为 archive-notes.txt。只新增这一个文件，不改动、删除或覆盖任何已有文件，完成后读回核对。');
    await page.locator('.workbench__send').click();
    await page.locator('.workbench__stop').waitFor({ timeout: 15000 });
    const copyDeadline = Date.now() + 180000;
    while (Date.now() < copyDeadline) {
      const dialog = page.locator('.work-permission');
      if (await dialog.isVisible() && await dialog.locator('.work-permission__main > strong').count()) {
        const heading = await dialog.locator('.work-permission__main > strong').innerText();
        assert(heading.endsWith('archive-notes.txt'), `Unexpected copy output: ${heading}`);
        await dialog.locator('footer .n-button--primary-type').click();
        approvals++;
        await page.waitForFunction(title => document.querySelector('.work-permission__main > strong')?.textContent !== title, heading, { polling: 100 });
      }
      if (!await page.locator('.workbench__stop').isVisible()) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(!await page.locator('.workbench__stop').isVisible(), 'file copy timed out');
    assert.deepEqual(await page.locator('.workbench__error-card').allTextContents(), []);
    assert.equal(fs.readFileSync(path.join(output, 'notes.txt'), 'utf8'), copyText);
    assert.equal(fs.readFileSync(path.join(output, 'archive-notes.txt'), 'utf8'), copyText);
    await page.locator('.work-attachments__info strong').filter({ hasText: 'archive-notes.txt' }).waitFor();
    await page.screenshot({ path: path.join(output, 'desktop-live-office.png'), fullPage: true });
    await page.reload();
    await page.getByText(title.slice(0, 28), { exact: true }).first().click();
    for (const name of ['result.xlsx', 'result.docx', 'archive-notes.txt']) await page.locator('.work-attachments__info strong').filter({ hasText: name }).waitFor();
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ mode: 'real-model-real-client-real-files', model: globalModel.model, permissionApprovals: approvals, artifactsPersistAfterReload: true, originalsUnchanged: true, excelDepartmentTotals: [301, 50], wordBodyAndTableChanged: true, fileFindReadCopyVerified: true }, null, 2));
    console.log(`PASS: real model ${globalModel.model}, packaged client, Office results, approvals and persistent attachments. Evidence: ${output}`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    const reject = page.locator('.work-permission footer button').first();
    if (await reject.isVisible()) await reject.click().catch(() => {});
    if (await page.locator('.workbench__stop').isVisible()) {
      await page.locator('.workbench__stop').evaluate(button => button.click()).catch(() => {});
      await page.locator('.workbench__stop').waitFor({ state: 'hidden' }).catch(() => {});
    }
    throw error;
  } finally {
    const composer = page.locator('.workbench__composer textarea');
    if (await composer.count() && (await composer.inputValue()).startsWith(title)) await composer.fill('');
    // Restore only the test's workspace selection; retain the user's actual provider.
    await page.evaluate(prior => { if (prior === null) localStorage.removeItem('workAssistant'); else localStorage.setItem('workAssistant', prior); }, priorLocal);
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
