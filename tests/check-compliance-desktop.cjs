// Desktop navigation smoke test; no model calls, saves or file dialogs.
const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 try {
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'));
  assert(page,'home window');
  await page.evaluate(async()=>{for(const command of ['plugin:window|unminimize','plugin:window|show','plugin:window|set_focus'])try{await window.__TAURI_INTERNALS__.invoke(command,{label:'home'})}catch{}});
  await page.locator('.home__sider-nav [aria-label="AI Work"]').click();
  await page.locator('.ai-sections').waitFor();
  assert.deepEqual(await page.locator('.ai-sections button').allTextContents(), ['知识问答','合规助手','任务助手']);
  await page.getByRole('button',{name:'知识问答',exact:true}).click();
  await page.locator('.knowledge-slot').waitFor({state:'visible'});
  assert.equal(await page.locator('.assistant-options').count(),0);
  assert.equal(await page.locator('.workbench').isVisible(),false);
  await page.getByRole('button',{name:'合规助手',exact:true}).click();
  await page.locator('.assistant-options').waitFor();
  assert.equal(await page.getByRole('radio').count(),3);
  assert.deepEqual((await page.locator('.assistant-options label').allTextContents()).map(text=>text.trim()), ['制度比对','报送助手','合规初审']);
  const originals = {};
  try {
   for(const label of ['制度比对','报送助手','合规初审']) {
    await page.getByRole('radio',{name:label,exact:true}).check();
    await page.locator('.cw-heading h2').filter({hasText:label}).waitFor();
    originals[label] = await page.getByRole('textbox',{name:'合规任务说明',exact:true}).inputValue();
    await page.getByRole('textbox',{name:'合规任务说明',exact:true}).fill(`界面自测：${label}独立草稿`);
    assert.equal(await page.getByRole('textbox',{name:'报送指标',exact:true}).count(),label==='报送助手'?1:0);
    assert.equal(await page.getByRole('combobox',{name:'待审业务材料',exact:true}).count(),label==='合规初审'?1:0);
    assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth>innerWidth),false);
   }
   await page.getByRole('button',{name:'知识问答',exact:true}).click();
   await page.locator('.knowledge-slot').waitFor({state:'visible'});
   assert.equal(await page.locator('.assistant-options').count(),0);
   await page.getByRole('button',{name:'任务助手',exact:true}).click();
   assert(await page.locator('.workbench').isVisible());
   await page.getByRole('button',{name:'合规助手',exact:true}).click();
   assert(await page.getByRole('radio',{name:'合规初审',exact:true}).isChecked());
   for(const label of ['合规初审','报送助手','制度比对']) {
    await page.getByRole('radio',{name:label,exact:true}).check();
    assert.equal(await page.getByRole('textbox',{name:'合规任务说明',exact:true}).inputValue(),`界面自测：${label}独立草稿`);
   }
  } finally {
   for(const [label,value] of Object.entries(originals)) {
    await page.getByRole('radio',{name:label,exact:true}).check();
    await page.getByRole('textbox',{name:'合规任务说明',exact:true}).fill(value);
   }
  }
  await page.goto('http://tauri.localhost/home/ai?view=policy');
  await page.locator('.knowledge-slot').waitFor({state:'visible'});
  assert.equal(await page.locator('.assistant-options').count(),0);
  assert.equal(await page.locator('.ai-sections button.selected').innerText(),'知识问答');
  await page.getByRole('button',{name:'合规助手',exact:true}).click();
  await page.locator('.cw-heading h2').filter({hasText:'制度比对'}).waitFor();
  await page.screenshot({path:'.preview/office-verification/combined-compliance.png'});
  console.log('PASS: independent knowledge tab; grouped compare/report/review; RAGFlow container; mode-specific fields; independent drafts; return to last option; legacy policy link; no horizontal overflow. No model calls or saved data.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
