const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home'));
 const id=`lock-test-${Date.now()}`;
 const oldSelected=await page.evaluate(id=>{
  const chat=JSON.parse(localStorage.getItem('em.local-chat.v1'));
  const old=chat.selectedId;chat.conversations.push({id,name:id,messages:[]});chat.selectedId=id;
  localStorage.setItem('em.local-chat.v1',JSON.stringify(chat));
  const meetings=JSON.parse(localStorage.getItem('em.local-meetings.v1')||'{"version":1,"items":[]}');
  const now=new Date().toISOString();
  meetings.items.push({id,title:id,startAt:new Date(Date.now()-86400000).toISOString(),createdAt:now,creatorId:'self',remindedAt:now,participants:[{id:'self',name:'测试本人',kind:'self',response:'accepted'}]});
  localStorage.setItem('em.local-meetings.v1',JSON.stringify(meetings));return old;
 },id);
 try{
  await page.goto('http://tauri.localhost/home/message');
  assert.equal(await page.getByRole('button',{name:'配置 AI 接口',exact:true}).count(),0);
  assert.equal(await page.locator('form.settings').count(),0);
  const hasConfig=await page.evaluate(()=>!!JSON.parse(localStorage.getItem('em.local-ai.v1')||'{}').model);
  if(hasConfig) await page.getByText(/已使用全局模型：/).waitFor();
  await page.goto('http://tauri.localhost/home/todos?view=meetings');
  await page.locator('.meeting-filters button').count();
  const buttons=page.getByRole('button',{name:'全部',exact:true});await buttons.last().click();
  const card=page.locator('.meeting-card').filter({hasText:id});await card.waitFor();
  assert(await card.getByRole('button',{name:'已开始或已结束 · 不可修改'}).isDisabled());
  assert.equal(await card.locator('.response-actions button').count(),0);
  console.log('PASS: configured empty chat uses global settings, no duplicate form; past meeting is read-only.');
 }finally{
  await page.evaluate(({id,oldSelected})=>{
   const c=JSON.parse(localStorage.getItem('em.local-chat.v1'));c.conversations=c.conversations.filter(x=>x.id!==id);if(c.selectedId===id)c.selectedId=oldSelected;localStorage.setItem('em.local-chat.v1',JSON.stringify(c));
   const m=JSON.parse(localStorage.getItem('em.local-meetings.v1'));m.items=m.items.filter(x=>x.id!==id);localStorage.setItem('em.local-meetings.v1',JSON.stringify(m));
  },{id,oldSelected});await page.reload();await browser.close();
 }
})().catch(e=>{console.error(e);process.exitCode=1});
