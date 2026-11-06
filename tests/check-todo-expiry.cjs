const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({timezoneId:'Asia/Shanghai',viewport:{width:1440,height:1100}});
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  try{
    await page.clock.install({time:new Date('2026-11-03T10:00:00+08:00')});
    await page.addInitScript(()=>{
      if(localStorage.getItem('expiry-seed'))return;
      localStorage.setItem('expiry-seed','1');
      const base={createdAt:'2026-11-01T00:00:00Z',completed:false,scheduleVersion:1,reminderAt:null};
      localStorage.setItem('em.local-todos.v1',JSON.stringify({version:1,items:[
        {...base,id:'old',title:'已过截止未完成',dueAt:'2026-11-02T02:00:00Z',attachments:[{id:'fake-file',name:'历史附件.txt',size:1,type:'text/plain'}]},
        {...base,id:'future',title:'未来截止',dueAt:'2026-11-04T02:00:00Z'},
        {...base,id:'undated',title:'无截止且提醒已过',reminderAt:'2026-11-02T02:00:00Z'},
        {...base,id:'old-done',title:'已过截止已完成',completed:true,dueAt:'2026-11-01T02:00:00Z'},
        {...base,id:'edge',title:'打开编辑后到期',dueAt:'2026-11-03T02:05:00Z'},
        {...base,id:'reminder-edge',title:'打开提醒后到期',dueAt:'2026-11-03T02:10:00Z'}
      ]}));
    });
    await page.goto(`${process.env.TEST_ORIGIN||'http://127.0.0.1:1426'}/tests/todos-preview.html`);
    const rows=page.locator('.todos-page > article');
    await rows.first().waitFor();
    assert.equal(await page.getByRole('button',{name:'接收的待办',exact:true}).count(),0);
    assert.equal(await page.getByRole('button',{name:'我发布的',exact:true}).count(),0);
    const titles=()=>rows.locator('.content > strong').allTextContents();
    assert.deepEqual(await titles(),['打开编辑后到期','打开提醒后到期','未来截止','无截止且提醒已过','已过截止未完成']);
    const old=rows.filter({hasText:'已过截止未完成'});
    for(const control of await old.locator('button:not(.delete-todo),input').all())assert.equal(await control.isDisabled(),true);
    assert.equal(await old.getByRole('button',{name:'删除',exact:true}).isEnabled(),true);
    const active=rows.filter({hasText:'无截止且提醒已过'});
    assert.equal(await active.getByRole('button',{name:'编辑',exact:true}).isEnabled(),true);
    const guard=await page.evaluate(async()=>{
      const {updateTodo}=await import('/src/stores/localTodos.ts');
      const before=localStorage.getItem('em.local-todos.v1');
      const failures=[];
      for(const patch of [{completed:true},{dueAt:'2030-01-01T00:00:00Z'},{reminderAt:null},{title:'不允许修改'},{attachments:[]}]){
        try{updateTodo('old',patch);failures.push(false);}catch(e){failures.push(e.message.includes('仅供查看'));}
      }
      return {failures,unchanged:before===localStorage.getItem('em.local-todos.v1')};
    });
    assert.deepEqual(guard,{failures:[true,true,true,true,true],unchanged:true});
    await page.getByRole('button',{name:'全部',exact:true}).click();
    assert.deepEqual((await titles()).slice(-2),['已过截止已完成','已过截止未完成']);
    assert.equal(await rows.filter({hasText:'已过截止已完成'}).getByRole('checkbox').isDisabled(),true);
    await rows.filter({hasText:'打开编辑后到期'}).getByRole('button',{name:'编辑',exact:true}).click();
    await page.getByLabel('待办事项内容',{exact:true}).fill('不能保存的草稿');
    await page.clock.fastForward(6*60*1000);
    await page.locator('.todo-editor-dialog').waitFor({state:'detached'});
    await page.getByRole('alert').filter({hasText:'已切换为只读'}).waitFor();
    assert.equal(await rows.filter({hasText:'打开编辑后到期'}).getByRole('button',{name:'编辑',exact:true}).isDisabled(),true);
    await rows.filter({hasText:'打开提醒后到期'}).getByRole('button',{name:'设置提醒',exact:true}).click();
    await page.clock.fastForward(5*60*1000);
    await page.locator('.reminder-dialog').waitFor({state:'detached'});
    assert.deepEqual((await titles()).slice(0,2),['未来截止','无截止且提醒已过']);
    await page.reload();await rows.first().waitFor();
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-todos.v1')).items);
    assert.equal(stored.find(t=>t.id==='edge').title,'打开编辑后到期');
    assert.equal(stored.find(t=>t.id==='reminder-edge').reminderAt,null);
    assert.equal(stored.length,6);
    assert.deepEqual((await titles()).slice(0,2),['未来截止','无截止且提醒已过']);
    await page.screenshot({path:'D:/ai/NXY-AIClient/.preview/todo-expiry-verified.png',fullPage:true});
    assert.deepEqual(errors,[]);
    console.log('PASS: unified list; expired last including after reload; expired editing controls disabled, delete enabled; store rejects editing/completing/rescheduling/attachments; open dialogs lock at deadline; reminders alone do not lock; records preserved.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
