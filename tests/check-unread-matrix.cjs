const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const results=[];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 async function scenario(name,count,run,{configured=true,storageFailure=false}={}){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
  try{
   await page.route('**/@vite/client',r=>r.fulfill({contentType:'text/javascript',body:'export function createHotContext(){return {data:{},on(){},accept(){},prune(){},dispose(){},invalidate(){}}};export function injectQuery(url){return url};export function updateStyle(){};export function removeStyle(){}'}));
   await page.route('**/src/utils/desktop/notification.ts',r=>r.fulfill({contentType:'text/javascript',body:'export async function showNotification(){return true}'}));
   await page.route('**/__unread-matrix.html',r=>r.fulfill({contentType:'text/html',body:'<div id="app"></div><script type="module" src="/tests/rag-preview.ts"></script>'}));
   await page.route('**/*plugin-http*',r=>r.fulfill({contentType:'text/javascript',body:`export async function fetch(url,init){window.calls ||= [];window.calls.push(JSON.parse(init.body));if(window.failModel)return new Response('',{status:503});const enc=new TextEncoder();let timer;return new Response(new ReadableStream({start(c){let i=0;const push=()=>{if(init.signal.aborted){c.close();return;}if(i++<5){c.enqueue(enc.encode('data: '+JSON.stringify({choices:[{delta:{content:'模拟总结内容。'}}]})+'\\n\\n'));timer=setTimeout(push,150);}else{c.enqueue(enc.encode('data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\\n\\n'));c.close();}};timer=setTimeout(push,30);},cancel(){clearTimeout(timer)}}),{headers:{'content-type':'text/event-stream'}});}` }));
   await page.addInitScript(({count,configured,storageFailure})=>{
    if(!localStorage.getItem('em.local-chat.v1')){
     const msg=(id,role='user',senderId='peer',status='done')=>({id,role,senderId,status,text:id,createdAt:new Date().toISOString()});
     localStorage.setItem('em.local-chat.v1',JSON.stringify({version:1,exampleGroupsVersion:2,selectedId:'target',conversations:[{id:'target',name:'目标群',members:[{id:'peer',name:'同事',kind:'simulated',color:''}],readState:{seenIds:['old'],summaryIds:[]},messages:[msg('old'),msg('self','user','self'),...Array.from({length:count},(_,i)=>msg('unread-'+i))]},{id:'other',name:'隔离群',readState:{seenIds:[],summaryIds:[]},messages:[]}]}));
     if(configured)localStorage.setItem('em.local-ai.v1',JSON.stringify({baseUrl:'http://localhost:8899/v1',model:'test',contextCount:30}));
    }
    if(storageFailure){const native=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='em.local-chat.v1')throw new DOMException('quota','QuotaExceededError');return native.call(this,k,v);};}
   },{count,configured,storageFailure});
   await page.goto((process.env.CHAT_TEST_ORIGIN||'http://127.0.0.1:1428')+'/__unread-matrix.html');await page.bringToFront();await page.getByRole('textbox',{name:'消息输入框',exact:true}).waitFor();
   const prompt=page.getByRole('region',{name:'未读消息总结'}),button=page.getByRole('button',{name:'总结未读',exact:true});
   const calls=()=>page.evaluate(()=>window.calls||[]);
   const done=()=>page.waitForFunction(()=>JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id==='target').messages.at(-1).role==='assistant'&&JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id==='target').messages.at(-1).status==='done');
   await run({page,prompt,button,calls,done});assert.deepEqual(errors,[]);results.push({name,passed:true});console.log('PASS '+name);
  }catch(e){results.push({name,passed:false,error:e.message});throw e;}finally{await page.close();fs.writeFileSync('.preview/unread-demo-20261026/matrix-result.json',JSON.stringify(results,null,2));}
 }
 try{
  await scenario('无未读和自己的消息不触发总结',0,async({prompt,calls})=>{assert.equal(await prompt.count(),0);assert.equal((await calls()).length,0)});
  await scenario('未配置模型时保留未读，不发送请求',3,async({page,prompt,button,calls})=>{await button.click();await page.getByText('请先在总设置 → AI 模型中配置模型，未读消息仍保留，尚未发送给 AI。',{exact:false}).waitFor();assert(await prompt.isVisible());assert.equal((await calls()).length,0)},{configured:false});
  await scenario('存储失败禁用总结，防止未保存就发送',3,async({button,calls})=>{assert(await button.isDisabled());assert.equal((await calls()).length,0)},{storageFailure:true});
  await scenario('101条分两批确认，第二批不自动发送',101,async({page,prompt,button,calls,done})=>{
   assert((await prompt.innerText()).includes('前 100 条'));await button.click();await done();assert.equal((await calls()).length,1);
   let requests=await page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations[0].messages.filter(m=>m.role==='user'&&m.summarySourceIds));assert.equal(requests[0].summarySourceIds.length,100);assert((await prompt.innerText()).includes('1 条'));
   await button.click();await done();assert.equal((await calls()).length,2);requests=await page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations[0].messages.filter(m=>m.role==='user'&&m.summarySourceIds));assert.deepEqual(requests[1].summarySourceIds,['unread-100']);assert.equal(await prompt.count(),0);
  });
  await scenario('双击只请求一次，来源排除已读及自身消息',3,async({page,button,calls,done})=>{await button.evaluate(n=>{n.click();n.click()});await done();assert.equal((await calls()).length,1);const body=JSON.stringify((await calls())[0].messages);assert(!body.includes('"text":"old"'));assert(!body.includes('"text":"self"'));const ids=await page.evaluate(()=>JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations[0].messages.at(-1).summarySourceIds);assert.deepEqual(ids,['unread-0','unread-1','unread-2']);});
  await scenario('模型失败可重试，重试保持原批次',3,async({page,button,calls,done})=>{await page.evaluate(()=>window.failModel=true);await button.click();await page.locator('.message-error').waitFor();await page.evaluate(()=>window.failModel=false);await page.getByRole('button',{name:'重试',exact:true}).click();await done();const requests=await calls();assert.equal(requests.length,2);assert.equal(requests[0].messages[1].content,requests[1].messages[1].content);});
  await scenario('切换会话不串消息，返回后来源可展开',4,async({page,button,calls,done})=>{await button.click();await page.locator('.stream-cursor').waitFor();await page.getByRole('button',{name:/隔离群/}).click();await done();assert.equal(await page.locator('.message').count(),0);await page.getByRole('button',{name:/目标群/}).click();await page.locator('.message').last().locator('details summary').click();assert((await page.locator('.message').last().innerText()).includes('unread-3'));assert.equal((await calls()).length,1);});
  await scenario('拒绝后刷新及再次进入均不重复询问',3,async({page,prompt,calls})=>{await page.getByRole('button',{name:'暂不',exact:true}).click();await page.reload();await page.getByRole('textbox',{name:'消息输入框',exact:true}).waitFor();assert.equal(await prompt.count(),0);await page.getByRole('button',{name:/隔离群/}).click();await page.getByRole('button',{name:/目标群/}).click();assert.equal(await prompt.count(),0);assert.equal((await calls()).length,0);});
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
