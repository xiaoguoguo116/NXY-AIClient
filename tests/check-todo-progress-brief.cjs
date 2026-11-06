const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert=require('node:assert/strict')
;(async()=>{
  const desktop=process.env.EM_DESKTOP==='1'
  const browser=desktop?await chromium.connectOverCDP('http://127.0.0.1:19224'):await chromium.launch({channel:'msedge',headless:true})
  const page=desktop?browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home')):await browser.newPage({timezoneId:'Asia/Shanghai',viewport:{width:1440,height:1100}})
  assert(page)
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  const prefix=`progress-brief-${Date.now()}`
  const url=desktop?'http://tauri.localhost/home/todos':`${process.env.TEST_ORIGIN||'http://127.0.0.1:1426'}/tests/todos-preview.html`
  if(!desktop){
    await page.clock.install({time:new Date('2030-01-02T12:00:00+08:00')})
    await page.addInitScript(()=>{window.__copied='';window.__TAURI_INTERNALS__={invoke:async(command,args)=>{if(command==='plugin:clipboard-manager|write_text')window.__copied=args.text;return null}}})
    await page.goto(url)
  }
  const before=await page.evaluate(()=>({
    todos:JSON.parse(localStorage.getItem('em.local-todos.v1')||'{"items":[]}').items,
    meetings:JSON.parse(localStorage.getItem('em.local-meetings.v1')||'{"items":[]}').items,
    protected:Object.fromEntries(['em.local-chat.v1','em.local-ai.v1','em.local-ai-key.v1'].map(k=>[k,localStorage.getItem(k)])),
    safe:!document.querySelector('[role=dialog]')&&![...document.querySelectorAll('textarea')].some(e=>e.value.trim())
  }))
  assert(before.safe)
  const fixture=await page.evaluate(prefix=>{
    const now=Date.now(), date=new Date(now), iso=t=>new Date(t).toISOString()
    const todayEnd=new Date(date.getFullYear(),date.getMonth(),date.getDate(),23,59).getTime()
    const future=Math.min(now+7200000,todayEnd), past=now-7200000
    const base={createdAt:iso(now),completed:false,scheduleVersion:1,reminderAt:null}
    const own=(key,title,extra={})=>({...base,id:`${prefix}:${key}`,title:`${prefix} ${title}`,assigneeId:'self',...extra})
    const assigned=(suffix,name,done,key='shared',due=future)=>({...own(suffix,key==='shared'?'共同核对方案':'过期协作事项'),assignmentKey:`${prefix}:${key}`,groupId:prefix,publisherId:'self',assigneeId:`${prefix}:${name}`,assigneeName:name,completed:done,...(done?{completedAt:iso(now)}:{}),dueAt:iso(due)})
    const items=[assigned('a','周铭',true),assigned('b','李妍',false),assigned('old-a','周铭',false,'expired',past),assigned('old-b','李妍',true,'expired',past),
      own('live','有效个人待办',{dueAt:iso(future)}),own('expired','过期个人待办',{dueAt:iso(past)}),own('done','今日成果',{completed:true,completedAt:iso(now)}),own('old-done','历史成果',{completed:true,completedAt:iso(now-86400000)}),
      {...assigned('foreign','其他同事',false,'foreign'),publisherId:'other',title:`prefix不应显示的他人发布`}
    ]
    const meeting=(id,title,start,end)=>({id:`${prefix}:${id}`,title:`${prefix} ${title}`,createdAt:iso(now),creatorId:'self',startAt:iso(start),...(end?{endAt:iso(end)}:{}),participants:[{id:'self',name:'我',kind:'self',response:'accepted'}],remindedAt:iso(now)})
    const meetings=[meeting('ended','已结束会议',past,past+1800000),meeting('ongoing','进行中会议',now-3600000,Math.min(now+300000,todayEnd)),meeting('upcoming','待开始会议',future),meeting('old-meeting','昨日会议',now-86400000,now-82800000)]
    const todos=JSON.parse(localStorage.getItem('em.local-todos.v1')||'{"version":1,"items":[]}');todos.items.push(...items);localStorage.setItem('em.local-todos.v1',JSON.stringify(todos))
    const stored=JSON.parse(localStorage.getItem('em.local-meetings.v1')||'{"version":1,"items":[]}');stored.items.push(...meetings);localStorage.setItem('em.local-meetings.v1',JSON.stringify(stored))
    return {key:`${prefix}:shared`,prefix}
  },prefix)
  try{
    await page.goto(url)
    await page.getByRole('button',{name:'查看成员进度',exact:true}).waitFor()
    const rows=page.locator('.todos-page > article')
    assert.equal(await rows.filter({hasText:`${prefix} 共同核对方案`}).count(),0,'other-only assignment stays out of default self list')
    await page.getByRole('button',{name:'查看成员进度',exact:true}).click()
    const panel=page.getByRole('region',{name:'成员完成进度',exact:true})
    const group=panel.locator('.assignment-progress').filter({hasText:`${prefix} 共同核对方案`})
    await group.waitFor();assert.match(await group.innerText(),/已完成 1\/2 人/)
    assert.match(await group.locator('.member-status').filter({hasText:'周铭'}).innerText(),/已完成/)
    assert.match(await group.locator('.member-status').filter({hasText:'李妍'}).innerText(),/未完成/)
    assert.equal(await panel.getByText('prefix不应显示的他人发布',{exact:true}).count(),0)
    const flags=await panel.locator('.assignment-progress').evaluateAll(els=>els.map(e=>e.classList.contains('expired')))
    assert(flags.slice(flags.indexOf(true)).every(Boolean),'expired groups last')
    const brief=page.locator('.daily-brief pre');await page.getByText('预览简报内容',{exact:true}).click()
    let text=await brief.innerText()
    for(const name of ['有效个人待办','今日成果','进行中会议','待开始会议'])assert(text.includes(`${prefix} ${name}`))
    for(const name of ['共同核对方案','过期个人待办','历史成果','已结束会议','昨日会议'])assert(!text.includes(`${prefix} ${name}`))
    if(!desktop){
      await page.getByRole('button',{name:'复制简报',exact:true}).click()
      assert.equal(await page.evaluate(()=>window.__copied),text)
      await page.clock.fastForward(6*60*1000)
      assert(!(await brief.innerText()).includes(`${prefix} 进行中会议`),'ended meeting disappears automatically')
    }
    await page.goto(`${url}?view=todos&assignment=${encodeURIComponent(fixture.key)}`)
    await rows.filter({hasText:`${prefix} 共同核对方案`}).first().waitFor()
    assert.equal(await rows.filter({hasText:`${prefix} 共同核对方案`}).count(),2)
    await rows.filter({hasText:`${prefix} 共同核对方案`}).filter({hasText:'接收人：李妍'}).getByRole('checkbox').evaluate(el=>el.click())
    assert.match(await group.innerText(),/已完成 2\/2 人/)
    await page.reload();await group.waitFor();assert.match(await group.innerText(),/已完成 2\/2 人/)
    await page.screenshot({path:`D:/ai/NXY-AIClient/.preview/${desktop?'formal':'isolated'}-todo-progress-brief.png`,fullPage:true})
    assert.deepEqual(errors,[])
    console.log(`PASS ${desktop?'release client':'isolated UI'}: other-member progress, default self scope, direct assignment link, 1/2 -> 2/2, reload, expired read-only groups last, brief excludes expired/old/ended entries${desktop?'':', copied brief matches preview and ongoing meeting expires on clock'}.`)
  } finally {
    if(desktop){
      const preserved=await page.evaluate(({prefix,before})=>{
        for(const key of ['em.local-todos.v1','em.local-meetings.v1']){const data=JSON.parse(localStorage.getItem(key));data.items=data.items.filter(t=>!t.id.startsWith(prefix+':'));localStorage.setItem(key,JSON.stringify(data))}
        return Object.entries(before.protected).every(([k,v])=>localStorage.getItem(k)===v)&&['todos','meetings'].every(type=>{const items=JSON.parse(localStorage.getItem(`em.local-${type}.v1`)).items;return before[type].every(old=>items.some(t=>JSON.stringify(t)===JSON.stringify(old)))})
      },{prefix,before});await page.goto(url);assert(preserved,'original records/settings preserved');console.log('Owned test records removed; original data preserved.')
    }
    await browser.close()
  }
})().catch(e=>{console.error(e);process.exitCode=1})
