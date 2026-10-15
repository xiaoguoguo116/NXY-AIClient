const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  try {
    const page = await browser.newPage();
    let submitted, mode = 'intent';
    await page.route('http://clarification.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/config') return route.fulfill({json:{chatId:'chat1',localDemo:true}});
      if (url.pathname.startsWith('/ragflow-api/')) {
        if (url.pathname.endsWith('/chat/completions')) {
          submitted = route.request().postDataJSON();
          const clarification = {mode, needs_input:true, options:[{id:'o1',question:'加班制度如何规定？',sources:[]},{id:'o2',question:'值班制度如何规定？',sources:[]}]};
          if (mode === 'evidence') clarification.cache_id = 'validated-cache';
          return route.fulfill({contentType:'text/event-stream',body:'data:'+JSON.stringify({code:0,data:{final:true,answer:'请选择方向',clarification}})+'\n\ndata:'+JSON.stringify({code:0,data:true})+'\n\n'});
        }
        return route.fulfill({json:{code:0,data:route.request().method()==='POST'?{id:'s1'}:[]}});
      }
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['index.html','demo.js','api.js','ragflow-chat.js','chat.css'].includes(file)) return route.abort();
      return route.fulfill({body:fs.readFileSync('D:/work/PythonProject/ragflow-chat-module/'+file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
    });
    await page.goto('http://clarification.test/');
    const idle = () => page.waitForFunction(() => document.querySelector('ragflow-chat')?.client && !document.querySelector('ragflow-chat').busy);
    await idle();
    await page.getByRole('textbox').fill('加值班制度');
    await page.getByRole('button',{name:'发送 ↑'}).click();
    await idle();
    assert.equal(await page.locator('.option').count(), 2);
    await page.locator('.option').first().click();
    await idle();
    assert.equal(submitted.clarification_selection, undefined);
    assert.ok(JSON.stringify(submitted).includes('加班制度如何规定？'));
    mode = 'evidence';
    await page.getByRole('textbox').fill('报销制度');
    await page.getByRole('button',{name:'发送 ↑'}).click();
    await idle();
    await page.locator('.option').last().click();
    await idle();
    assert.deepEqual(submitted.clarification_selection,{cache_id:'validated-cache',option_id:'o2'});
    console.log('PASS: intent options render and submit without cache; validated options retain evidence selection');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
