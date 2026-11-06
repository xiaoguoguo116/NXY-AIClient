const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const root='.preview/stream-unread-20261026';
const testId='stream-unread-native-validation-20261026';
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 let page, original;
 try {
  page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost/home/'));
  assert(page,'Formal EM window missing'); page.setDefaultTimeout(20000);
  await page.goto('http://tauri.localhost/home/message');
  await page.getByRole('textbox',{name:'消息输入框',exact:true}).waitFor();
  original=await page.evaluate(()=>{
   if([...document.querySelectorAll('textarea')].some(n=>n.value.trim()))throw Error('Draft in progress');
   const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));
   if(data.conversations.some(c=>c.messages.some(m=>m.status==='pending')))throw Error('AI task in progress');
   const config=JSON.parse(localStorage.getItem('em.local-ai.v1'));
   if(!config?.baseUrl || !config?.model)throw Error('Global model not configured');
   return {selectedId:data.selectedId, chats:data.conversations.map(c=>({id:c.id,messages:JSON.stringify(c.messages)})), config:localStorage.getItem('em.local-ai.v1'), key:localStorage.getItem('em.local-ai-key.v1'), ragKey:localStorage.getItem('em.ragflow-credential.v1')};
  });
  await page.evaluate(id=>{
   const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));
   if(data.conversations.some(c=>c.id===id))throw Error('Test conversation already exists');
   const message=(id,text)=>({id,text,role:'user',senderId:'peer',status:'done',createdAt:new Date().toISOString()});
   data.conversations.push({id,name:'功能验证（模拟消息）',members:[{id:'self',name:'我',kind:'self',color:'#347ad9'},{id:'peer',name:'王工',kind:'simulated',color:'#408978'}],readState:{seenIds:['native-old'],summaryIds:[]},messages:[message('native-old','旧消息：讨论其他项目。'),message('native-unread-1','模拟项目：本周完成登录联调，由王工负责修复会话过期错误。'),message('native-unread-2','模拟项目：周五提交联调报告；上线日期尚未确定，需要负责人确认。')]});
   data.selectedId=id;localStorage.setItem('em.local-chat.v1',JSON.stringify(data));
  },testId);
  await page.reload();await page.bringToFront();
  await page.getByRole('region',{name:'未读消息总结'}).waitFor();
  await page.screenshot({path:`${root}/native-consent.png`});
  async function record(start) {
   await page.evaluate(()=>{
    window.streamSamples=[];window.streamStart=performance.now();
    window.streamObserver?.disconnect();
    window.streamObserver=new MutationObserver(()=>{
     const node=document.querySelector('.stream-cursor')?.closest('.bubble');
     if(node){const length=node.innerText.length; const last=window.streamSamples.at(-1); if(!last||last.length!==length)window.streamSamples.push({ms:Math.round(performance.now()-window.streamStart),length});}
    });window.streamObserver.observe(document.querySelector('.messages'),{subtree:true,childList:true,characterData:true});
   });
   await start();
   await page.locator('.stream-cursor').waitFor({timeout:130000});
   await page.screenshot({path:`${root}/native-stream-${Date.now()}.png`});
   await page.waitForFunction(id=>{
    const chat=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id);
    return chat.messages.at(-1).role==='assistant'&&chat.messages.at(-1).status!=='pending';
   },testId,{timeout:135000});
   const result=await page.evaluate(id=>{
    window.streamObserver.disconnect();
    const answer=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id).messages.at(-1);
    return {status:answer.status,error:answer.error,text:answer.text,summarySourceIds:answer.summarySourceIds,rag:answer.rag,samples:window.streamSamples,completeMs:Math.round(performance.now()-window.streamStart)};
   },testId);
   assert.equal(result.status,'done',result.error);
   assert(result.samples.length>1,'No progressive rendering observed');
   assert(result.samples[0].ms<result.completeMs,'First text only appeared after completion');
   return result;
  }
  const summary=await record(()=>page.getByRole('button',{name:'总结未读',exact:true}).click());
  assert.deepEqual(summary.summarySourceIds,['native-unread-1','native-unread-2']);
  assert(summary.text.includes('王工'));assert(summary.text.includes('周五'));
  console.log(JSON.stringify({summary:{firstTextMs:summary.samples[0].ms,completeMs:summary.completeMs,updates:summary.samples.length}}));
  const rag=await record(async()=>{
   await page.getByRole('textbox',{name:'消息输入框',exact:true}).fill('@ ai rag助手 查制度：国内出差申请需要提前几个工作日提交，审批流程是什么？');
   await page.getByRole('button',{name:'发送',exact:true}).click();
  });
  await page.screenshot({path:`${root}/native-complete.png`});
  assert(rag.rag.references.length>0,'No RAG references returned');
  fs.writeFileSync(`${root}/native-result.json`,JSON.stringify({passed:true,summary,rag},null,2));
  console.log(JSON.stringify({rag:{firstTextMs:rag.samples[0].ms,completeMs:rag.completeMs,updates:rag.samples.length,references:rag.rag.references.length,sessionId:rag.rag.sessionId}}));
 }finally{
  if(page&&original){
   await page.evaluate(({id,selectedId})=>{
    const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));
    const test=data.conversations.find(c=>c.id===id);
    if(test?.messages.some(m=>m.status==='pending'))return;
    data.conversations=data.conversations.filter(c=>c.id!==id);data.selectedId=selectedId;
    localStorage.setItem('em.local-chat.v1',JSON.stringify(data));
   },{id:testId,selectedId:original.selectedId});
   await page.reload();
   const intact=await page.evaluate(original=>{
    const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));
    return {settings:localStorage.getItem('em.local-ai.v1')===original.config&&localStorage.getItem('em.local-ai-key.v1')===original.key&&localStorage.getItem('em.ragflow-credential.v1')===original.ragKey,messages:original.chats.every(old=>JSON.stringify(data.conversations.find(c=>c.id===old.id)?.messages)===old.messages)};
   },original);
   assert.deepEqual(intact,{settings:true,messages:true});
   console.log('Original settings and all pre-existing messages preserved.');
  }
  await browser.close();
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
