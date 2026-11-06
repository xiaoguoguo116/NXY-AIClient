const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const before=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'em-unread-demo-before-20261026.json'),'utf8'));
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 try{
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost/home/'));assert(page);
  const state=await page.evaluate(before=>{
   const data=JSON.parse(localStorage.getItem('em.local-chat.v1')),old=JSON.parse(before.raw);
   const summary=data.conversations.find(c=>c.id==='unread-demo-release-20261026'),pending=data.conversations.find(c=>c.id==='unread-demo-ops-20261026');
   return {originalMessagesPreserved:old.conversations.every(c=>JSON.stringify(c.messages)===JSON.stringify(data.conversations.find(n=>n.id===c.id)?.messages)),settingsPreserved:localStorage.getItem('em.local-ai.v1')===before.config&&localStorage.getItem('em.local-ai-key.v1')===before.key&&localStorage.getItem('em.ragflow-credential.v1')===before.rag,summaryDone:summary.messages.at(-1).status==='done',summarySources:summary.messages.at(-1).summarySourceIds.length,remainingUnread:pending.messages.filter(m=>!pending.readState.seenIds.includes(m.id)).length,formalNative:typeof window.__TAURI_INTERNALS__?.invoke==='function'};
  },before);
  assert.deepEqual(state,{originalMessagesPreserved:true,settingsPreserved:true,summaryDone:true,summarySources:12,remainingUnread:8,formalNative:true});
  fs.writeFileSync('.preview/unread-demo-20261026/final-audit.json',JSON.stringify(state,null,2));console.log(JSON.stringify(state));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
