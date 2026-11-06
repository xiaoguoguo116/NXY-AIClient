// Actual packaged UI + configured model, synthetic materials only.
// Capture only test DOCX download blobs to avoid native Save As dialogs.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { Document, Packer, Paragraph } = require('docx');
const { extractRawText } = require('mammoth');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const stamp = process.env.COMPLIANCE_TEST_STAMP || Date.now();
const mark = `自测-${stamp}`;
const output = path.resolve('.preview/office-verification', `compliance-live-${stamp}`);
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('tauri.localhost/home'));
  assert(page);
  const report = { mode: 'real-client-real-model-synthetic-documents', marker: mark, checks: [] };
  const record = async mode => page.evaluate(async ({ mark, mode }) => {
    const db = await new Promise((resolve, reject) => { const req = indexedDB.open('em-compliance-v1'); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    try { return await new Promise((resolve, reject) => {
      const req = db.transaction('results').objectStore('results').getAll();
      req.onsuccess = () => resolve(req.result.filter(r => r.mode === mode && r.question.includes(mark)).sort((a,b) => b.createdAt.localeCompare(a.createdAt))[0]);
      req.onerror = () => reject(req.error);
    }); } finally { db.close(); }
  }, { mark, mode });
  async function library() {
    if (!await page.getByRole('textbox', { name: '资料名称', exact: true }).isVisible()) await page.getByRole('button', { name: /管理资料库/ }).click();
  }
  async function add(name, kind, text, word = false) {
    await library();
    await page.getByLabel('类型', { exact: true }).selectOption(kind);
    await page.getByLabel('资料名称', { exact: true }).fill(name);
    await page.getByLabel('文号', { exact: true }).fill('自测〔2026〕1号');
    await page.getByLabel('发布机构', { exact: true }).fill('合成功能测试机构');
    await page.getByLabel('版本', { exact: true }).fill('自测版');
    await page.getByLabel('生效日期', { exact: true }).fill('2026-01-01');
    await page.getByLabel('适用对象 / 范围', { exact: true }).fill('仅用于功能自测，非真实监管规定');
    if (word) {
      const buffer = await Packer.toBuffer(new Document({ sections: [{ children: text.split('\n\n').map(t => new Paragraph(t)) }] }));
      await page.locator('input[type=file]').setInputFiles({ name: `${name}.docx`, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer });
    } else await page.getByLabel('资料全文', { exact: true }).fill(text);
    await page.getByRole('button', { name: '保存资料到本机', exact: true }).click();
    await page.locator('.cw-library-item').filter({ hasText: name }).waitFor();
    assert.deepEqual(await page.getByRole('alert').allTextContents(), []);
  }
  async function select(names) {
    for (const checkbox of await page.locator('.cw-input fieldset input[type=checkbox]').all()) {
      const label = await checkbox.locator('..').innerText();
      await checkbox.setChecked(names.some(name => label.includes(name)));
    }
  }
  async function run(mode) {
    await page.locator('.cw-consent input').check();
    await page.getByRole('button', { name: '开始分析', exact: true }).click();
    await page.getByRole('button', { name: '正在分析…', exact: true }).waitFor({ state: 'hidden', timeout: 150000 });
    assert.deepEqual(await page.getByRole('alert').allTextContents(), []);
    const saved = await record(mode);
    assert(saved && saved.model !== '本地模板填充', `${mode}: real model result was not saved`);
    return saved;
  }
  async function exportDocx(filename, patterns) {
    await page.evaluate(() => {
      window.__regressionExport = null;
      window.__regressionAnchorClick = HTMLAnchorElement.prototype.click;
      window.__regressionCreateUrl = URL.createObjectURL;
      const blobs = new Map();
      URL.createObjectURL = function (blob) { const url = window.__regressionCreateUrl.call(URL, blob); blobs.set(url, blob); return url; };
      HTMLAnchorElement.prototype.click = function () {
        if (this.href.startsWith('blob:') && this.download.endsWith('.docx')) {
          const reader = new FileReader(); reader.onload = () => { window.__regressionExport = reader.result; }; reader.readAsDataURL(blobs.get(this.href));
        } else window.__regressionAnchorClick.call(this);
      };
    });
    try {
      await page.getByRole('button', { name: '导出 Word', exact: true }).click();
      await page.waitForFunction(() => !!window.__regressionExport, null, { timeout: 20000, polling: 100 });
      const data = await page.evaluate(() => window.__regressionExport);
      const target = path.join(output, filename);
      fs.writeFileSync(target, Buffer.from(data.split(',')[1], 'base64'));
      const text = (await extractRawText({ path: target })).value;
      for (const pattern of patterns) assert.match(text, pattern);
    } finally { await page.evaluate(() => { HTMLAnchorElement.prototype.click = window.__regressionAnchorClick; URL.createObjectURL = window.__regressionCreateUrl; delete window.__regressionCreateUrl; delete window.__regressionAnchorClick; delete window.__regressionExport; }); }
  }
  try {
    await page.evaluate(async () => { for (const action of ['unminimize', 'show', 'set_focus']) await window.__TAURI_INTERNALS__.invoke(`plugin:window|${action}`, { label: 'home' }); });
    assert(!await page.locator('.workbench__stop').isVisible(), 'existing task is running');
    await page.goto('http://tauri.localhost/home/ai?view=compare');
    await page.locator('.cw-heading h2').filter({ hasText: '制度比对' }).waitFor();
    await page.getByLabel('适用日期', { exact: true }).fill('2026-11-02');
    const oldName = `${mark}-旧制度`, newName = `${mark}-新要求`, template = `${mark}-报送模板`;
    const existingComparison = process.env.COMPLIANCE_TEST_STAMP ? await record('compare') : undefined;
    if (existingComparison) {
      await page.locator('.cw-history').filter({ hasText: mark }).first().click();
    } else {
    await add(oldName, '内部制度', '本文件为合成功能测试材料，非真实监管规定。\n\n第一条 交易记录至少保存3年。\n\n第二条 每季度开展一次检查。', true);
    await add(newName, '监管文件', '本文件为合成功能测试材料，非真实监管规定。\n\n第一条 交易记录至少保存5年。\n\n第二条 每月开展一次检查。\n\n第三条 应按月记录整改措施。');
    await select([oldName, newName]);
    await page.getByRole('button', { name: /收起资料库/ }).click();
    await page.getByLabel('合规任务说明').fill(`[${mark}] 请对比旧制度与新要求，逐项列出保存年限、检查频率及新增整改记录要求，引用双方原文，给出待人工审核的修订草稿。仅使用所选合成材料。`);
    }
    const comparison = existingComparison || await run('compare');
    const comparedText = JSON.stringify([comparison.summary, comparison.findings, comparison.draft]);
    assert.match(comparedText, /3年|三年/); assert.match(comparedText, /5年|五年/);
    assert.match(comparedText, /季度/); assert.match(comparedText, /每月|按月/); assert.match(comparedText, /整改/);
    assert(comparison.findings.length > 0 && comparison.draft.trim());
    assert(comparison.findings.every(f => f.refs.length && f.refs.every(r => r.valid)), 'comparison has invalid/missing references');
    for (const doc of comparison.documents) assert(comparison.findings.some(f => f.refs.some(r => doc.paragraphs.some(p => p.id === r.id))), 'each source must be cited');
    await page.locator('.cw-evidence button').first().click();
    await page.getByRole('dialog', { name: '原文溯源' }).waitFor();
    assert((await page.locator('.cw-source-text .cited').innerText()).trim());
    await page.getByRole('button', { name: '关闭原文', exact: true }).click();
    await page.getByLabel('人工处理', { exact: true }).first().selectOption('已接受');
    await page.getByLabel('合规草稿').fill(comparison.draft + '\n【自测人工复核标记】');
    await page.getByRole('button', { name: '保存审核与草稿' }).click();
    await page.getByRole('status').filter({ hasText: '人工处理状态和草稿已保存' }).waitFor();
    const persisted = await record('compare');
    assert.equal(persisted.findings[0].state, '已接受'); assert.match(persisted.draft, /自测人工复核标记/);
    await exportDocx('comparison.docx', [/待人工审核/, /自测人工复核标记/, /已校验原文/]);
    report.checks.push('real comparison: changed retention/frequency/new requirement, valid citations from both inputs, source navigation, edits saved and DOCX exported');

    await page.getByRole('radio', { name: '报送助手', exact: true }).check();
    await add(template, '报送模板', '# 自测季度报告\n\n报告期：{{报告期}}\n\n交易金额：{{交易金额}}\n\n数据来源：{{数据来源}}\n\n整改情况：{{整改情况}}');
    await select([template]);
    await page.getByRole('button', { name: /收起资料库/ }).click();
    await page.getByLabel('合规任务说明').fill(`[${mark}] 精确填充模板，自测材料。`);
    await page.getByLabel('报送指标').fill('{"报告期":"2026年第三季度","交易金额":"123.4500 万元","数据来源":"合成自测数据"}');
    await page.getByRole('button', { name: '仅填充模板（不调用模型）' }).click();
    await page.getByLabel('合规草稿').waitFor();
    const exact = await page.getByLabel('合规草稿').inputValue();
    assert.match(exact, /123\.4500 万元/); assert.match(exact, /【待补充：整改情况】/);
    await exportDocx('report-template.docx', [/123\.4500 万元/, /【待补充：整改情况】/, /待人工审核/]);
    await page.getByLabel('合规任务说明').fill(`[${mark}] 请生成报告草稿，保留模板章节及本期指标原值123.4500 万元；未提供整改情况，必须明确标记【待补充：整改情况】，不得编造整改结论。`);
    const generated = await run('report');
    assert.match(generated.draft, /123\.4500/); assert.match(generated.draft, /待补充/);
    assert.equal(generated.metrics['交易金额'], '123.4500 万元');
    assert.deepEqual(generated.documents.map(d => d.name), [template]);
    await exportDocx('report-model.docx', [/123\.4500/, /待补充/, /待人工审核/]);
    report.checks.push('report: exact template decimals/missing markers, real model draft, original metrics and DOCX exports');
    await page.reload();
    await page.locator('.cw-history').filter({ hasText: mark }).first().click();
    assert.match(await page.getByLabel('合规草稿').inputValue(), /123\.4500/);
    await page.getByRole('radio', { name: '制度比对', exact: true }).check();
    await page.locator('.cw-history').filter({ hasText: mark }).first().click();
    assert.equal(await page.getByLabel('人工处理', { exact: true }).first().inputValue(), '已接受');
    assert.match(await page.getByLabel('合规草稿').inputValue(), /自测人工复核标记/);
    report.checks.push('both histories reopen after reload; manual review state and edited draft retained');
    report.model = comparison.model;
    await page.screenshot({ path: path.join(output, 'desktop-comparison.png') });
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify(report, null, 2));
    console.log(`PASS: actual comparison/report with ${report.model}; read-back and exports verified. Evidence: ${output}`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
    const cancel = page.getByRole('button', { name: '取消', exact: true });
    if (await cancel.isVisible()) await cancel.click().catch(() => {});
    console.error('Evidence:', output);
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
