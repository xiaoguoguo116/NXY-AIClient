// Formal client, original user settings, real clicks; only the uniquely created fixture is removed.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async()=>{
  const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'));
  assert(page);
  const title=`【提醒设置验收】${Date.now()}`;
  let fixtureId;
  const before=await page.evaluate(()=>({
    todos:JSON.parse(localStorage.getItem('em.local-todos.v1')||'{"items":[]}').items,
    protected:Object.fromEntries(['em.local-chat.v1','em.local-ai.v1','em.local-ai-key.v1','em.local-meetings.v1'].map(k=>[k,localStorage.getItem(k)]))
  }));
  try{
    await page.goto('http://tauri.localhost/home/todos');
    await page.evaluate(async()=>{for(const command of ['plugin:window|unminimize','plugin:window|show','plugin:window|set_focus'])await window.__TAURI_INTERNALS__.invoke(command,{label:'home'});});
    await page.getByRole('button',{name:'新建待办',exact:true}).click();
    const titleInput=page.getByLabel('待办事项内容',{exact:true});
    await titleInput.click(); await page.keyboard.insertText(title);
    assert.equal(await titleInput.inputValue(),title);
    await page.getByLabel('待办结束时间日期').fill('2030-12-31');
    await page.getByLabel('待办结束时间时刻').selectOption('23:45');
    await page.getByLabel('待办提醒方式').selectOption('off');
    await page.getByRole('button',{name:'添加待办',exact:true}).click();
    await page.locator('.todo-editor-dialog').waitFor({state:'detached'});
    const read=()=>page.evaluate(title=>JSON.parse(localStorage.getItem('em.local-todos.v1')).items.find(t=>t.title===title),title);
    const created=await read(); assert(created); fixtureId=created.id;
    const row=page.locator('.todos-page > article').filter({hasText:title});
    await row.getByRole('button',{name:'设置提醒',exact:true}).click();
    await page.getByRole('dialog',{name:'设置提醒',exact:true}).waitFor();
    const date=page.getByLabel('待办提醒时间日期',{exact:true});
    const time=page.getByLabel('待办提醒时间时刻',{exact:true});
    await date.click(); assert.equal(await date.evaluate(el=>document.activeElement===el),true);
    const choices=await time.locator('option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
    assert.equal(choices.length,24); assert(choices.every(t=>t.endsWith(':00')));
    await page.getByRole('button',{name:'下周五 17:00',exact:true}).click();
    const selectedDay=await date.inputValue();
    assert.equal(await time.inputValue(),'17:00');
    await page.screenshot({path:'D:/ai/NXY-AIClient/.preview/formal-hourly-reminder.png',fullPage:true});
    await page.getByRole('button',{name:'保存提醒',exact:true}).click();
    await page.locator('.reminder-dialog').waitFor({state:'detached'});
    await page.getByRole('status').filter({hasText:'提醒已保存'}).waitFor();
    const saved=await read();
    const expected=await page.evaluate(day=>new Date(day+'T17:00').toISOString(),selectedDay);
    assert.equal(saved.reminderAt,expected); assert.equal(saved.dueAt,created.dueAt);
    await page.reload();
    await row.getByRole('button',{name:'设置提醒',exact:true}).click();
    assert.equal(await date.inputValue(),selectedDay); assert.equal(await time.inputValue(),'17:00');
    await date.fill('2031-01-03'); await time.selectOption('18:00');
    await page.getByRole('button',{name:'取消',exact:true}).click();
    assert.equal((await read()).reminderAt,expected);
    await row.getByRole('button',{name:'设置提醒',exact:true}).click();
    await page.getByRole('button',{name:'取消提醒',exact:true}).click();
    assert.equal((await read()).reminderAt,null);
    assert.equal((await read()).dueAt,created.dueAt);
    console.log(`PASS: formal client reminder button opens; input retains focus; 24 hourly choices; ${selectedDay} 17:00 saved; reload retains time; cancelling changes does not save; disabling reminder preserves deadline.`);
  }finally{
    const preserved=await page.evaluate(({id,title,before})=>{
      const data=JSON.parse(localStorage.getItem('em.local-todos.v1')||'{"version":1,"items":[]}');
      data.items=data.items.filter(t=>!(t.title===title&&(!id||t.id===id)));
      localStorage.setItem('em.local-todos.v1',JSON.stringify(data));
      return before.todos.every(old=>data.items.some(t=>t.id===old.id&&JSON.stringify(t)===JSON.stringify(old)))&&Object.entries(before.protected).every(([key,value])=>localStorage.getItem(key)===value);
    },{id:fixtureId,title,before});
    await page.reload(); await page.getByRole('button',{name:'新建待办',exact:true}).waitFor();
    await browser.close();
    assert.equal(preserved,true,'original records and configuration preserved');
    console.log('Test task removed; original todos, chats, meetings and AI configuration unchanged.');
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
