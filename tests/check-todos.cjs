const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http=require('node:http');
const assert=require('node:assert/strict');
(async()=>{
  let calls=0;
  const server=http.createServer((req,res)=>{
    let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
      const payload=JSON.parse(body);calls++;
      assert(!req.headers.authorization,'never send the real key to the fixture');
      assert(payload.messages.some(m=>m.content.includes('em-todos')));
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({choices:[{message:{content:'总结：张工补充接口文档，李工核对测试结果。\n```em-todos\n[{"title":"张工补充接口文档","dueAt":null},{"title":"李工核对测试结果","dueAt":null}]\n```'}}]}));
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const baseUrl=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'));
  const fixtureId=`todo-e2e-${Date.now()}`;
  let backup;
  try {
    backup=await page.evaluate(({baseUrl,fixtureId})=>{
      const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));
      const backup={config:localStorage.getItem('em.local-ai.v1'),key:localStorage.getItem('em.local-ai-key.v1'),selectedId:data.selectedId};
      data.conversations.push({id:fixtureId,name:fixtureId,members:[{id:'self',name:'我',color:'#2685ed',kind:'self'},{id:'test',name:'张工',color:'#2685ed',kind:'simulated'}],messages:[{id:fixtureId+'-source',role:'user',text:'张工负责补充接口文档；李工核对测试结果，均未完成。',createdAt:new Date().toISOString(),status:'done',senderId:'test'}]});
      data.selectedId=fixtureId;localStorage.setItem('em.local-chat.v1',JSON.stringify(data));
      localStorage.setItem('em.local-ai.v1',JSON.stringify({baseUrl,model:'fixture',contextCount:12}));localStorage.removeItem('em.local-ai-key.v1');return backup;
    },{baseUrl,fixtureId});
    await page.goto('http://tauri.localhost/home/message');
    const input=page.getByRole('textbox',{name:'消息输入框',exact:true});
    await input.fill('@ai将明天下午3点提交报告添加到待办事项');
    await page.getByRole('button',{name:'发送',exact:true}).click();
    await page.locator('.bubble').filter({hasText:'已添加到待办：'}).waitFor();
    assert.equal(calls,0,'explicit commands work offline');
    await input.fill('@AI @张工 @我 请总结群聊中的后续待办事项');
    await page.getByRole('button',{name:'发送',exact:true}).click();
    await page.locator('.todo-followups').waitFor();
    assert((await page.locator('.todo-followups').innerText()).includes('张工、我'));
    assert.equal(await page.getByLabel('待办分配范围',{exact:true}).count(),0);
    const count=()=>page.evaluate(fixtureId=>JSON.parse(localStorage.getItem('em.local-todos.v1')).items.filter(t=>t.sourceName===fixtureId).length,fixtureId);
    assert.equal(await count(),1,'summary must not auto-add');
    await page.getByRole('button',{name:'添加到待办',exact:true}).first().click();
    await page.getByRole('button',{name:'暂不添加',exact:true}).click();
    assert.equal(await count(),3);
    await page.reload();
    await page.locator('.todo-followups').waitFor();
    assert.equal(await page.getByRole('button',{name:'添加到待办',exact:true}).count(),0,'accepted/dismissed choices survive reload');
    assert.equal(await count(),3);
    await page.locator('.home__sider-nav [aria-label="待办事项"]').click();
    const row=page.locator('.todos-page article').filter({hasText:'张工补充接口文档'});
    await row.getByRole('button',{name:'编辑',exact:true}).click();
    const date=new Date(Date.now()-60000);const local=new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
    await page.getByLabel('待办提醒时间',{exact:true}).fill(local);
    await page.getByRole('button',{name:'保存修改',exact:true}).click();
    await page.getByRole('button',{name:'待办到期 · 查看',exact:true}).waitFor({timeout:22000});
    const reminded=await page.evaluate(fixtureId=>JSON.parse(localStorage.getItem('em.local-todos.v1')).items.find(t=>t.sourceName===fixtureId&&t.title==='张工补充接口文档'&&t.assigneeId==='self').remindedAt,fixtureId);
    assert(reminded);
    await row.getByRole('button',{name:'10 分钟后提醒',exact:true}).click();
    await row.getByRole('checkbox').click();
    await page.getByRole('button',{name:'已完成',exact:true}).click();
    await row.waitFor();
    await page.screenshot({path:'C:/Users/94719/.codex/visualizations/2026/10/12/01a12e05-f80d-7992-8795-27ce084b02ee/em-todos-test.png'});
    console.log('PASS: offline command, model summary confirmation, no auto-add, persisted choices, due reminder, snooze, complete');
  } finally {
    if(backup) await page.evaluate(({backup,fixtureId,baseUrl})=>{
      const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));data.conversations=data.conversations.filter(c=>c.id!==fixtureId);if(data.selectedId===fixtureId)data.selectedId=backup.selectedId;localStorage.setItem('em.local-chat.v1',JSON.stringify(data));
      const todos=JSON.parse(localStorage.getItem('em.local-todos.v1')||'{"version":1,"items":[]}');todos.items=todos.items.filter(t=>t.sourceName!==fixtureId);localStorage.setItem('em.local-todos.v1',JSON.stringify(todos));
      const config=JSON.parse(localStorage.getItem('em.local-ai.v1')||'{}');if(config.baseUrl===baseUrl){for(const [key,value] of [['em.local-ai.v1',backup.config],['em.local-ai-key.v1',backup.key]]){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}}
    },{backup,fixtureId,baseUrl});
    await page.reload();await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1});
