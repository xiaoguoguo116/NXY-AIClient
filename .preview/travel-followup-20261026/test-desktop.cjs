const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  const report = { checks: [] };
  const pages = () => browser.contexts().flatMap(c => c.pages());
  try {
    const home = pages().find(p => p.url().includes('tauri.localhost/home'));
    assert(home, 'formal client exists');
    await home.evaluate(async () => {
      for (const action of ['unminimize', 'show', 'set_focus'])
        await window.__TAURI_INTERNALS__.invoke('plugin:window|' + action, { label: 'home' });
    });
    await home.locator('.home__sider-nav [aria-label="AI Work"]').click();
    await home.getByRole('button', { name: '知识问答', exact: true }).click();
    let child;
    for (let i = 0; i < 30; i++) {
      child = pages().find(p => p.url().startsWith('http://127.0.0.1:8090'));
      if (child) break;
      await home.waitForTimeout(500);
    }
    assert(child, 'embedded knowledge view exists');
    child.setDefaultTimeout(20000);
    await child.waitForFunction(() => document.querySelector('ragflow-chat')?.ready, { timeout: 30000 });
    const input = child.getByRole('textbox', { name: '输入问题', exact: true });
    assert.equal(await input.inputValue(), '', 'preserve any existing user draft');
    async function result(label) {
      await child.waitForFunction(() => {
        const c = document.querySelector('ragflow-chat');
        return !c.busy && c.messages.at(-1)?.role === 'assistant';
      }, undefined, { timeout: 150000 });
      const r = await child.evaluate(() => {
        const c = document.querySelector('ragflow-chat'), m = c.messages.at(-1);
        return { session: c.sessionId, answer: m.content, complete: m.complete,
          options: m.clarification?.options || [], record: m.optimization?.record_id,
          cache: m.optimization?.cache_status, candidates: m.diagnostics?.retrieved_chunks?.length,
          visibleOptions: [...c.shadowRoot.querySelectorAll('.message.assistant')].at(-1)?.querySelectorAll('.option').length || 0,
          error: c.shadowRoot.querySelector('.error').textContent };
      });
      report.checks.push({ label, ...r });
      fs.writeFileSync(path.join(__dirname, 'desktop.json'), JSON.stringify(report, null, 2));
      assert(r.complete && !r.error, 'request completed without errors');
      assert.equal(r.visibleOptions, r.options.length, 'every generated option rendered');
      console.log(JSON.stringify({ label, ...r }));
      return r;
    }
    await child.getByRole('button', { name: '＋ 新建对话', exact: true }).click();
    await input.fill('出差流程');
    await child.getByRole('button', { name: '发送 ↑', exact: true }).click();
    const initial = await result('workflow');
    assert(initial.options.length >= 2, 'travel workflow has selectable followups');
    await child.locator('.message.assistant').last().scrollIntoViewIfNeeded();
    await child.screenshot({ path: path.join(__dirname, 'desktop-options.png') });
    await child.locator('.session.active').click();
    const restored = await result('history-restored');
    assert.deepEqual(restored.options, initial.options);
    await child.locator('.message.assistant').last().locator('.option').first().click();
    const selected = await result('selected');
    assert.equal(selected.session, initial.session);
    assert.equal(selected.cache, 'hit');
    assert.match(selected.answer, /\[ID:\d+\]/);
    await child.getByRole('button', { name: '▤ 查看召回块', exact: true }).last().click();
    await child.locator('.inspector').waitFor();
    await child.screenshot({ path: path.join(__dirname, 'desktop-evidence.png') });
    await child.getByRole('button', { name: '关闭召回依据', exact: true }).click();
    await input.fill('如果我这次出差预算为6000元，需要哪些人审批？');
    await child.getByRole('button', { name: '发送 ↑', exact: true }).click();
    const followup = await result('typed-followup');
    assert.equal(followup.session, initial.session);
    assert.match(followup.answer, /分管负责人/);
    await child.screenshot({ path: path.join(__dirname, 'desktop-followup.png') });
    await input.fill('如果是紧急出差，来不及提前申请呢？');
    await child.getByRole('button', { name: '发送 ↑', exact: true }).click();
    const emergency = await result('emergency-followup');
    assert.equal(emergency.session, initial.session);
    assert.equal(emergency.options.length, 0);
    for (const pattern of [/口头/, /返程/, /两|2|二/, /工作日/]) assert.match(emergency.answer, pattern);
    await child.screenshot({ path: path.join(__dirname, 'desktop-emergency.png') });
    report.passed = true;
    fs.writeFileSync(path.join(__dirname, 'desktop.json'), JSON.stringify(report, null, 2));
    console.log('PASS: formal desktop travel options, history, option selection, evidence, typed followup and emergency application.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
