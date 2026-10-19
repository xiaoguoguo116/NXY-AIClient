// Read-only desktop smoke test; no model call or user-data changes.
const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 try {
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'));
  assert(page,'home window');
  await page.evaluate(async()=>{for(const command of ['plugin:window|unminimize','plugin:window|show','plugin:window|set_focus'])try{await window.__TAURI_INTERNALS__.invoke(command,{label:'home'})}catch{}});
  await page.locator('.home__sider-nav [aria-label="AI Work"]').click();
  assert.equal(await page.getByRole('button',{name:'制度问答',exact:true}).count(),0);
  for(const label of ['制度比对','合规初审','报送助手']) {
   await page.getByRole('button',{name:label,exact:true}).click();
   await page.locator('.cw-heading h2').filter({hasText:label}).waitFor();
   assert(await page.locator('.compliance-workbench').isVisible());
   assert.equal(await page.locator('.workbench').isVisible(),false);
   assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false);
  }
  await page.getByRole('button',{name:'制度比对',exact:true}).click();
  await page.screenshot({path:'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/compliance-desktop.png'});
  console.log('PASS: duplicate policy tab absent; three compliance tabs render, task panel hidden, no horizontal page overflow. No real model call.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
