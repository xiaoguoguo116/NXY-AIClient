// Isolated UI and virtual-clock scheduler test. No real records or native notifications.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const page = await browser.newPage({timezoneId:'Asia/Shanghai',viewport:{width:1280,height:960}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  try {
    await page.clock.install({time:new Date('2026-10-23T10:10:00+08:00')});
    await page.addInitScript(()=>{
      window.reminderNotifications=[];
      window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
        if(command==='plugin:notification|is_permission_granted') return true;
        if(command==='show_app_notification') {window.reminderNotifications.push(args.input);return null;}
        throw Error('Unexpected native command: '+command);
      }};
      if(localStorage.getItem('reminder-test-seeded')) return;
      localStorage.setItem('reminder-test-seeded','1');
      localStorage.setItem('em.local-todos.v1',JSON.stringify({version:1,items:[{
        id:'reminder-check',title:'自选提醒验证',createdAt:'2026-10-22T00:00:00Z',completed:false,scheduleVersion:1,
        dueAt:'2026-11-02T07:15:00.000Z',reminderAt:null,assigneeId:'self',attachments:[]
      }]}));
    });
    await page.goto(`${process.env.TEST_ORIGIN || 'http://127.0.0.1:1425'}/tests/todos-preview.html`);
    const row=page.locator('.todos-page > article').filter({hasText:'自选提醒验证'});
    const open=()=>row.getByRole('button',{name:'设置提醒',exact:true}).click();
    const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-todos.v1')).items[0]);
    await open();
    const date=page.getByLabel('待办提醒时间日期',{exact:true});
    const time=page.getByLabel('待办提醒时间时刻',{exact:true});
    const choices=await time.locator('option').evaluateAll(options=>options.map(o=>o.value).filter(Boolean));
    assert.equal(choices.length,24); assert(choices.every(t=>t.endsWith(':00')));
    await date.click(); assert.equal(await date.evaluate(el=>document.activeElement===el),true);
    await page.getByRole('button',{name:'保存提醒',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'晚于当前时间'}).waitFor();
    await date.fill('2026-10-22'); await time.selectOption('17:00');
    await page.getByRole('button',{name:'保存提醒',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'晚于当前时间'}).waitFor();
    assert.equal((await read()).reminderAt,null);
    await page.getByRole('button',{name:'下周五 17:00',exact:true}).click();
    assert.equal(await date.inputValue(),'2026-10-30'); assert.equal(await time.inputValue(),'17:00');
    await page.getByRole('button',{name:'取消',exact:true}).click();
    assert.equal((await read()).reminderAt,null,'cancel does not save');
    await open();
    await page.getByRole('button',{name:'下周五 17:00',exact:true}).click();
    await page.screenshot({path:'D:/ai/NXY-AIClient/.preview/reminder-hourly-dialog.png',fullPage:true});
    await page.evaluate(()=>{window.originalReminderSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='em.local-todos.v1')throw Error('测试存储失败');return window.originalReminderSetItem.call(this,k,v);};});
    await page.getByRole('button',{name:'保存提醒',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'测试存储失败'}).waitFor();
    assert.equal((await read()).reminderAt,null);
    await page.evaluate(()=>{Storage.prototype.setItem=window.originalReminderSetItem;});
    await page.getByRole('button',{name:'保存提醒',exact:true}).click();
    await page.locator('.reminder-dialog').waitFor({state:'detached'});
    await page.getByRole('status').filter({hasText:'提醒已保存'}).waitFor();
    assert.equal((await read()).reminderAt,'2026-10-30T09:00:00.000Z');
    assert.equal((await read()).dueAt,'2026-11-02T07:15:00.000Z');
    await page.reload(); await open();
    assert.equal(await date.inputValue(),'2026-10-30'); assert.equal(await time.inputValue(),'17:00');
    await page.getByRole('button',{name:'取消提醒',exact:true}).click();
    assert.equal((await read()).reminderAt,null);
    // Existing non-hour values are not silently rounded or lost just by editing.
    await page.evaluate(async()=>{const {updateTodo}=await import('/src/stores/localTodos.ts');updateTodo('reminder-check',{reminderAt:'2026-10-30T09:45:00.000Z'});});
    await page.reload(); // Reload injected legacy storage through the same store instance as the UI.
    await open(); assert.equal(await time.inputValue(),'17:45');
    await page.getByRole('button',{name:'取消',exact:true}).click();
    assert.equal((await read()).reminderAt,'2026-10-30T09:45:00.000Z');
    await open(); await time.selectOption('17:00');
    await page.getByRole('button',{name:'保存提醒',exact:true}).click();
    // Exercise the real scheduler without waiting a week or changing the operating-system clock.
    await page.evaluate(async()=>{const {startTodoReminders}=await import('/src/stores/localTodos.ts');window.stopReminderTest=startTodoReminders();});
    await page.clock.fastForward(new Date('2026-10-30T16:59:30+08:00').getTime()-await page.evaluate(()=>Date.now()));
    assert.equal(await page.evaluate(()=>window.reminderNotifications.length),0);
    await page.clock.fastForward(45000);
    await page.waitForFunction(()=>window.reminderNotifications.length===1);
    assert((await read()).remindedAt);
    await page.clock.fastForward(30000);
    assert.equal(await page.evaluate(()=>window.reminderNotifications.length),1,'fires once');
    await page.evaluate(()=>window.stopReminderTest());
    assert.deepEqual(errors,[]);
    console.log('PASS: clickable hourly reminder dialog; next Friday 17:00; future validation; cancel/save/disable/reload; storage failure retry; original-minute preservation; unchanged deadline; scheduler triggers once at configured time (mock notification bridge).');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
