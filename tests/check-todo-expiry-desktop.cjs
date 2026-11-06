// Formal-client acceptance, no mocked APIs or settings changes; remove only owned test records.
const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'));
  assert(page);
  const prefix=`【到期只读验收 ${Date.now()}】`;
  const names=['过期','未到期','无截止'].map(s=>prefix+s);
  const before=await page.evaluate(()=>({todos:JSON.parse(localStorage.getItem('em.local-todos.v1')||'{"items":[]}').items,protected:Object.fromEntries(['em.local-chat.v1','em.local-ai.v1','em.local-ai-key.v1','em.local-meetings.v1'].map(k=>[k,localStorage.getItem(k)]))}));
  try{
    await page.goto('http://tauri.localhost/home/todos');
    await page.evaluate(async()=>{for(const c of ['plugin:window|unminimize','plugin:window|show','plugin:window|set_focus'])await window.__TAURI_INTERNALS__.invoke(c,{label:'home'});});
    await page.getByRole('button',{name:'新建待办',exact:true}).waitFor();
    for(const name of ['我发布的','接收的待办'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
    for(let i=0;i<3;i++){
      await page.getByRole('button',{name:'新建待办',exact:true}).click();
      const title=page.getByLabel('待办事项内容',{exact:true});await title.click();await page.keyboard.insertText(names[i]);
      if(i<2){await page.getByLabel('待办结束时间日期').fill(i===0?'2000-01-01':'2099-01-01');await page.getByLabel('待办结束时间时刻').selectOption('17:00');}
      await page.getByLabel('待办提醒方式').selectOption('off');
      await page.getByRole('button',{name:'添加待办',exact:true}).click();
      await page.locator('.todo-editor-dialog').waitFor({state:'detached'});
    }
    const rows=page.locator('.todos-page > article');
    const row=(i)=>rows.filter({hasText:names[i]});
    const verify=async()=>{
      await row(0).waitFor();
      for(const c of await row(0).locator('button:not(.delete-todo),input').all())assert.equal(await c.isDisabled(),true);
      assert.equal(await row(0).getByRole('button',{name:'删除',exact:true}).isEnabled(),true);
      await row(0).getByText('已过截止时间 · 不可修改',{exact:true}).waitFor();
      const flags=await rows.evaluateAll(els=>els.map(el=>el.classList.contains('expired')));
      const firstExpired=flags.indexOf(true); assert(firstExpired>=0);
      assert(flags.slice(firstExpired).every(Boolean),'all expired entries are at the end');
      for(const i of [1,2]){
        assert.equal(await row(i).getByRole('button',{name:'编辑',exact:true}).isEnabled(),true);
        assert.equal(await row(i).getByRole('button',{name:'设置提醒',exact:true}).isEnabled(),true);
      }
    };
    await verify();
    await row(1).getByRole('button',{name:'编辑',exact:true}).click();
    await page.getByLabel('待办事项内容',{exact:true}).waitFor();
    await page.getByRole('button',{name:'关闭待办编辑',exact:true}).click();
    await row(2).getByRole('button',{name:'设置提醒',exact:true}).click();
    await page.getByRole('dialog',{name:'设置提醒',exact:true}).waitFor();
    await page.getByRole('button',{name:'关闭提醒设置',exact:true}).click();
    await page.reload();await verify();
    await page.screenshot({path:'D:/ai/NXY-AIClient/.preview/formal-todo-expiry.png',fullPage:true});
    console.log('PASS: formal client has no received/published categories; expired records at bottom, editing disabled and delete enabled; unexpired/undated edit and reminder work; reload preserves result.');
  }finally{
    const kept=await page.evaluate(({names,before})=>{
      const data=JSON.parse(localStorage.getItem('em.local-todos.v1')||'{"version":1,"items":[]}');
      data.items=data.items.filter(t=>!names.includes(t.title));
      localStorage.setItem('em.local-todos.v1',JSON.stringify(data));
      return before.todos.every(old=>data.items.some(t=>t.id===old.id&&JSON.stringify(t)===JSON.stringify(old)))&&Object.entries(before.protected).every(([k,v])=>localStorage.getItem(k)===v);
    },{names,before});
    await page.reload();await page.getByRole('button',{name:'新建待办',exact:true}).waitFor();
    await browser.close();assert(kept,'original records and config unchanged');
    console.log('Only test records removed; original todos, chat, meetings and AI settings preserved.');
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
