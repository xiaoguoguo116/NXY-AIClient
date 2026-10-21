const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  const report = { checks: [] };
  const pages = () => browser.contexts().flatMap(c => c.pages());
  try {
    const home = pages().find(p => p.url().includes('tauri.localhost/home'));
    assert(home, 'formal client home exists');
    report.nativeClient = await home.evaluate(() => typeof window.__TAURI_INTERNALS__?.invoke === 'function');
    assert(report.nativeClient);
    if (!process.env.RAG_REUSE_CURRENT) {
      await home.locator('.home__sider-nav [aria-label="AI Work"]').click();
      await home.getByRole('button', { name: '知识问答', exact: true }).click();
    }
    let child;
    for (let i = 0; i < 30; i++) {
      child = pages().find(p => p.url().startsWith('http://127.0.0.1:8090'));
      if (child) break;
      await home.waitForTimeout(500);
    }
    assert(child, 'native knowledge WebView exists');
    child.setDefaultTimeout(20000);
    assert(await child.evaluate(() => document.querySelector('ragflow-chat')?.ready), 'knowledge page ready');
    console.log('READY: formal client and embedded knowledge page');

    async function result(label) {
      const deadline = Date.now() + 150000;
      while (true) {
        const done = await child.evaluate(() => {
          const c = document.querySelector('ragflow-chat');
          return !c.busy && c.messages.at(-1)?.role === 'assistant';
        });
        if (done) break;
        if (Date.now() >= deadline) throw new Error(`${label}: response timeout`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const state = await child.evaluate(() => {
        const c = document.querySelector('ragflow-chat'), m = c.messages.at(-1);
        return { sessionId: c.sessionId, complete: m.complete, answer: m.content,
          options: m.clarification?.options || [], recordId: m.optimization?.record_id,
          decision: m.diagnostics?.clarification_decision,
          candidateCount: m.diagnostics?.retrieved_chunks?.length,
          contextCount: m.diagnostics?.context_chunks?.length,
          cacheStatus: m.optimization?.cache_status,
          timings: m.diagnostics?.timings_ms,
          error: c.shadowRoot.querySelector('.error').textContent,
          visibleOptions: [...c.shadowRoot.querySelectorAll('.message.assistant')].at(-1)?.querySelectorAll('.option').length || 0 };
      });
      // Persist diagnostics only; do not export credentials or retrieved source documents.
      report.checks.push({ label, ...state });
      console.log(JSON.stringify({ label, ...state }));
      await child.screenshot({ path: path.join(__dirname, `rag-startup-${label}.png`), timeout: 10000 }).catch(e => console.log('Screenshot unavailable:', e.message.split('\n')[0]));
      fs.writeFileSync(path.join(__dirname, 'rag-startup-result.json'), JSON.stringify(report, null, 2));
      assert(state.complete && !state.error, `${label}: request did not complete`);
      assert.equal(state.options.length, state.visibleOptions, 'all returned options rendered');
      assert(state.options.length <= 5, 'option limit');
      return state;
    }
    if (!process.env.RAG_REUSE_CURRENT) {
      await child.getByRole('button', { name: '＋ 新建对话', exact: true }).click();
      await child.getByRole('textbox', { name: '输入问题', exact: true }).fill('加值班制度');
      await child.getByRole('button', { name: '发送 ↑', exact: true }).click();
    }
    const first = await result('clarification');
    if (first.options.length) {
      await child.locator('.option').first().evaluate(button => button.click());
      const second = await result('selection');
      assert.equal(second.sessionId, first.sessionId, 'selection continues same session');
      assert(second.answer.trim().length > 0);
    } else {
      await child.getByRole('button', { name: '＋ 新建对话', exact: true }).click();
      await child.getByRole('textbox', { name: '输入问题', exact: true }).fill('加班与调休管理制度的适用范围是什么？');
      await child.getByRole('button', { name: '发送 ↑', exact: true }).click();
      await result('direct-question');
    }
    await child.getByRole('button', { name: '▤ 查看召回块', exact: true }).last().evaluate(button => button.click());
    assert(await child.locator('.inspector').isVisible());
    report.evidencePanelVisible = true;
    await child.getByRole('button', { name: '关闭召回依据', exact: true }).evaluate(button => button.click());
    fs.writeFileSync(path.join(__dirname, 'rag-startup-result.json'), JSON.stringify(report, null, 2));
    console.log('DONE: real backend round trips and evidence panel checked');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
