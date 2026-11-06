const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:19224',{timeout:10000});
 try {
  const p=b.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/home/message'));
  if(!p)throw Error('Chat window missing');
  const input=p.getByRole('textbox',{name:'消息输入框',exact:true});
  // LocalChat keeps drafts keyed by conversation; switching preserves the user's draft.
  await p.getByRole('button',{name:/新建/}).click();
  await input.waitFor({timeout:10000});
  if((await input.inputValue()).trim())throw Error('New conversation unexpectedly contains a draft');
  const id=await p.evaluate(()=>JSON.parse(localStorage.getItem('em.local-chat.v1')).selectedId);
  const question='@Ai rag 去香港出差，需要提前几个工作日申请？';
  await input.fill(question);
  await p.getByRole('button',{name:'发送',exact:true}).click();
  console.log('Sent a real @Ai rag request in a new local chat.');
  await p.waitForFunction(id=>{const c=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id);const m=c?.messages.at(-1);return m?.role==='assistant'&&m.status!=='pending'},id,{timeout:180000});
  const result=await p.evaluate(id=>{const c=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id);const m=c.messages.at(-1);return {conversationId:id,status:m.status,error:m.error,answer:m.text,assistant:m.assistant,references:m.rag?.references?.length,options:m.rag?.options?.length}},id);
  fs.writeFileSync('.preview/rag-chat-20261030/result.json',JSON.stringify(result,null,2));
  await p.screenshot({path:'.preview/rag-chat-20261030/chat-result.png'});
  await p.bringToFront();
  console.log(JSON.stringify(result));
  if(result.status!=='done')throw Error(result.error||'RAG reply failed');
  if(!result.references)throw Error('Reply did not return evidence');
 } finally {await b.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
