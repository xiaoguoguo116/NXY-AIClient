const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 try {
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'));
  assert.equal(await page.locator('.home__sider-nav [aria-label="网盘"]').count(),0);
  assert.equal(await page.locator('.home__sider-nav [aria-label="过往"]').count(),0);
  await page.locator('.home__sider-nav [aria-label="应用"]').click();
  await page.getByRole('button',{name:'打开 RAGFlow',exact:true}).click();
  await page.waitForURL(/\/home\/ai\?view=knowledge/);
  await page.getByRole('button',{name:'知识问答',exact:true}).waitFor();
  await page.waitForTimeout(5000);
  let child=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://127.0.0.1:8090'));
  if(!child) await page.waitForTimeout(2000);
  child=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://127.0.0.1:8090'));
  assert(child,'8090 must be a native child WebView in EM');
  await child.locator('ragflow-chat').waitFor({timeout:15000});
  assert((await child.title()).includes('RAGFlow'));
  const access=await child.evaluate(async()=>{
   if(!window.__TAURI_INTERNALS__) return 'no-ipc';
   try { await window.__TAURI_INTERNALS__.invoke('plugin:fs|read_text_file',{path:'D:/ai/NXY-AIClient/README.md'});return 'allowed' } catch { return 'denied' }
  });
  assert.notEqual(access,'allowed','remote page must not inherit host filesystem permissions');
  await page.getByRole('button',{name:'任务助手',exact:true}).click();
  await page.locator('.workbench').waitFor({state:'visible'});
  await page.getByRole('button',{name:'知识问答',exact:true}).click();
  await page.locator('.embedded-host').waitFor({state:'visible'});
  assert.equal(browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url().startsWith('http://127.0.0.1:8090')).length,1);
  await page.locator('.home__sider-nav [aria-label="消息"]').click();
  await page.locator('.local-chat').waitFor({state:'visible'});
  await page.locator('.home__sider-nav [aria-label="AI Work"]').click();
  await page.getByRole('button',{name:'知识问答',exact:true}).click();
  await page.locator('.embedded-host').waitFor({state:'visible'});
  await child.screenshot({path:'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/em-knowledge-page.png'});
  console.log('PASS: app card routes to AI Work knowledge, live 8090 native WebView, remote filesystem denied, task/chat switching and one preserved child view');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
