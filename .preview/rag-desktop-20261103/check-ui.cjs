const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const dir='.preview/rag-desktop-20261103';
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224',{timeout:15000});
 try {
  const p=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('tauri.localhost/home'));
  assert(p,'Native client home missing');
  if(!p.url().includes('/home/message'))await p.goto('http://tauri.localhost/home/message');
  await p.getByRole('textbox',{name:'消息输入框',exact:true}).waitFor({timeout:30000});
  await p.getByRole('button',{name:/新建/}).click();
  const input=p.getByRole('textbox',{name:'消息输入框',exact:true});
  assert.equal(await input.inputValue(),'');
  const id=await p.evaluate(()=>JSON.parse(localStorage.getItem('em.local-chat.v1')).selectedId);
  await p.evaluate(()=>{
   const existing=new Set([...document.querySelectorAll('article.message')].map(e=>e.dataset.messageId));
   const trace=window.__ragUiTrace={start:0,logs:[],updates:[]};
   const original=console.info;
   console.info=function(...args){if(args[0]==='[RAG timing]')trace.logs.push({at:performance.now(),...args[1]});original.apply(this,args)};
   trace.restore=()=>{console.info=original;observer.disconnect()};
   let previous='';
   const observer=new MutationObserver(()=>{
    const article=[...document.querySelectorAll('article.message.other')].find(e=>!existing.has(e.dataset.messageId));
    const bubble=article?.querySelector('.bubble');
    if(!bubble)return;
    const text=[...bubble.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
    if(!text||text==='正在检索知识库并核对依据…'||text===previous)return;
    previous=text;
    trace.updates.push({at:performance.now(),chars:Array.from(text).length,text:text.slice(0,80),streaming:!!article.querySelector('.stream-cursor')});
   });
   observer.observe(document.body,{subtree:true,childList:true,characterData:true});
  });
  await input.fill('@AI RAG助手 查制度：加班需要满足什么条件、由谁审批？');
  await p.evaluate(()=>window.__ragUiTrace.start=performance.now());
  await p.getByRole('button',{name:'发送',exact:true}).click();
  await p.waitForFunction(()=>window.__ragUiTrace.updates.length>0,null,{timeout:150000});
  console.log('First visible text:',await p.evaluate(()=>window.__ragUiTrace.updates[0]));
  await p.screenshot({path:dir+'/streaming.png'});
  await p.waitForFunction(id=>{const c=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id);return c?.messages.at(-1)?.role==='assistant'&&c.messages.at(-1).status!=='pending'},id,{timeout:150000});
  const result=await p.evaluate(id=>{
   const trace=window.__ragUiTrace;trace.restore();
   const c=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id),m=c.messages.at(-1);
   const first=trace.logs.find(x=>x.stage==='first_text');
   return {conversationId:id,status:m.status,error:m.error,answerChars:Array.from(m.text||'').length,references:m.rag?.references.length,
    firstVisibleMs:trace.updates[0]?.at-trace.start,receivedToVisibleMs:trace.updates[0]?.at-first?.at,
    logs:trace.logs.map(x=>({...x,relativeMs:x.at-trace.start})),updates:trace.updates.map(x=>({...x,relativeMs:x.at-trace.start}))};
  },id);
  fs.writeFileSync(dir+'/ui-result.json',JSON.stringify(result,null,2));
  await p.screenshot({path:dir+'/complete.png'});await p.bringToFront();
  console.log(JSON.stringify({status:result.status,firstVisibleMs:result.firstVisibleMs,receivedToVisibleMs:result.receivedToVisibleMs,updates:result.updates.length,first:result.updates[0],references:result.references,logs:result.logs}));
  assert.equal(result.status,'done');assert(result.references>0);assert(result.updates.filter(x=>x.streaming).length>1,'No incremental preview');assert(result.logs.some(x=>x.stage==='server_timings'),'New client logs missing');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
