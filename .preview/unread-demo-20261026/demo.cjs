const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root='.preview/unread-demo-20261026', id='unread-demo-release-20261026', other='unread-demo-ops-20261026';
const entries=[
 ['pm','本群消息均为功能演示样例。支付接口联调进入收尾，本次确认发布条件和责任人。'],
 ['qa','回归发现 PAY-217：请求超时后重试会重复生成订单，目前仍未解决。'],
 ['dev','PAY-217 由我负责，今天 16:00 前提交幂等键修复，完成后通知测试。'],
 ['qa','收到。李妍负责在今天 17:30 前完成重复请求和超时重试回归。'],
 ['ops','今晚生产变更窗口尚未批准，请不要把“今晚发布”写成已确认计划。'],
 ['pm','发布条件：PAY-217 回归通过、监控验证完成、变更窗口获批。三项全部满足后才能发布。'],
 ['ops','赵宁负责核对支付成功率和重复订单告警，今天 18:00 前反馈验证结果。'],
 ['dev','接口文档已经补充幂等键格式和错误码，此项文档更新已完成，无需再次列为待办。'],
 ['qa','验收数据需要业务方确认，当前没有明确负责人，也没有承诺时间。'],
 ['pm','我（当前客户端用户）请在明天 10:00 前整理联调纪要，并向业务方确认验收数据负责人。'],
 ['dev','更正：修复代码提交时间由今天 16:00 调整为 16:30，其他安排不变。'],
 ['pm','总结请保留最新时间 16:30；上线日期待变更审批后再定，不将候选计划写成确定结论。']
];
const ops=['本群为模拟值班交接。今日监控系统运行正常。','网关在 09:20 出现一次超时，现已恢复。','赵宁负责核对超时链路，今天 15:00 前提交排查结果。','周铭负责复核重试策略，今天 16:00 前给出建议。','今晚巡检安排尚未确认。','备用实例扩容需要申请，负责人尚未明确。','历史告警归档已完成。','需要在交接会上确认巡检时间及扩容负责人。'];
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 try{
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost/home/'));assert(page);
  const before=await page.evaluate(()=>{
   if([...document.querySelectorAll('textarea')].some(e=>e.value.trim())||document.querySelector('.workbench__composer--busy'))throw Error('当前有草稿或任务，暂不刷新');
   const raw=localStorage.getItem('em.local-chat.v1');const data=JSON.parse(raw);
   if(data.conversations.some(c=>c.messages.some(m=>m.status==='pending')))throw Error('有正在生成的回答');
   return {raw,config:localStorage.getItem('em.local-ai.v1'),key:localStorage.getItem('em.local-ai-key.v1'),rag:localStorage.getItem('em.ragflow-credential.v1')};
  });
  fs.writeFileSync(path.join(os.tmpdir(),'em-unread-demo-before-20261026.json'),JSON.stringify(before),{mode:0o600});
  await page.evaluate(({id,other,entries,ops})=>{
   const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));
   if(data.conversations.some(c=>c.id===id||c.id===other))throw Error('演示群已存在，避免重复添加');
   const members=[{id:'self',name:'我',kind:'self',color:'#347ad9'},...['项目负责人','周铭','李妍','赵宁'].map((name,i)=>({id:['pm','dev','qa','ops'][i],name,kind:'simulated',color:['#7865c4','#408978','#547dc0','#bd8752'][i]}))];
   const msg=(id,senderId,text,i)=>({id,role:'user',senderId,text,status:'done',createdAt:new Date(Date.now()-(20-i)*60000).toISOString()});
   data.conversations.push({id,name:'未读演示·支付联调（模拟）',pinned:true,members,readState:{seenIds:[id+'-old'],summaryIds:[]},messages:[msg(id+'-old','pm','已读历史：上周讨论过旧版登录页，与本次支付联调无关。',0),...entries.map(([sender,text],i)=>msg(id+'-'+i,sender,text,i+1))]});
   data.conversations.push({id:other,name:'未读演示·值班交接（模拟）',pinned:true,members,readState:{seenIds:[],summaryIds:[]},messages:ops.map((text,i)=>msg(other+'-'+i,['ops','dev'][i%2],text,i))});
   localStorage.setItem('em.local-chat.v1',JSON.stringify(data));
  },{id,other,entries,ops});
  await page.goto('http://tauri.localhost/home/message');await page.bringToFront();
  const button=page.getByRole('button',{name:/未读演示·支付联调（模拟）/});await button.waitFor();
  assert((await button.innerText()).includes('12'));
  await page.screenshot({path:`${root}/01-unread-badges.png`});
  await button.click();await page.getByRole('region',{name:'未读消息总结'}).waitFor();
  await page.screenshot({path:`${root}/02-consent-full.png`});
  await page.locator('.session').screenshot({path:`${root}/02-consent-detail.png`});
  const input=page.getByRole('textbox',{name:'消息输入框',exact:true});await input.fill('演示草稿：稍后补充验收意见。');
  await page.evaluate(()=>{window.unreadStarted=performance.now();window.unreadSamples=[];window.unreadObserver=new MutationObserver(()=>{const n=document.querySelector('.stream-cursor')?.closest('.bubble');if(n&&window.unreadSamples.at(-1)?.length!==n.innerText.length)window.unreadSamples.push({ms:Math.round(performance.now()-window.unreadStarted),length:n.innerText.length});});window.unreadObserver.observe(document.querySelector('.messages'),{subtree:true,childList:true,characterData:true});});
  await page.getByRole('button',{name:'总结未读',exact:true}).click();
  assert.equal(await input.inputValue(),'演示草稿：稍后补充验收意见。');
  await page.locator('.stream-cursor').waitFor({timeout:130000});
  await page.screenshot({path:`${root}/03-streaming.png`});
  // Switch away while generating: the result must still belong to the originating group.
  const originalSelected=JSON.parse(before.raw).selectedId;
  const originalName=JSON.parse(before.raw).conversations.find(c=>c.id===originalSelected).name;
  await page.locator('.conversation').filter({has:page.locator('strong',{hasText:originalName})}).first().click();
  await page.waitForFunction(id=>{const c=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id);return c.messages.at(-1).role==='assistant'&&c.messages.at(-1).status!=='pending';},id,{timeout:135000});
  await button.click();
  const result=await page.evaluate(({id,other})=>{
   window.unreadObserver.disconnect();const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));const c=data.conversations.find(c=>c.id===id);const answer=c.messages.at(-1),request=c.messages.find(m=>m.id===answer.replyTo);
   return {answer,request,samples:window.unreadSamples,elapsedMs:Math.round(performance.now()-window.unreadStarted),otherUnread:data.conversations.find(c=>c.id===other).messages.filter(m=>!data.conversations.find(c=>c.id===other).readState.seenIds.includes(m.id)).length};
  },{id,other});
  assert.equal(result.answer.status,'done',result.answer.error);assert.equal(result.request.summarySourceIds.length,12);assert(result.request.summarySourceIds.every(x=>x.startsWith(id+'-')&&!x.endsWith('-old')));assert.equal(result.otherUnread,8);
  assert(result.answer.text.includes('16:30')||result.answer.text.includes('16：30'));assert(result.answer.text.includes('PAY-217'));assert(result.answer.text.includes('未明确')||result.answer.text.includes('待确认'));
  await input.fill('');
  const answerNode=page.locator(`[data-message-id="${result.answer.id}"]`);await answerNode.locator('.bubble').screenshot({path:`${root}/04-summary-detail.png`});
  await page.screenshot({path:`${root}/04-summary-full.png`});
  const source=answerNode.locator('details').filter({hasText:'总结来源'});
  if(await source.count()){await source.locator('summary').click();await source.screenshot({path:`${root}/05-sources.png`});}
  await page.reload();await input.waitFor();
  const intact=await page.evaluate(({before,id,other})=>{
   const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));const old=JSON.parse(before.raw);
   return {settings:localStorage.getItem('em.local-ai.v1')===before.config&&localStorage.getItem('em.local-ai-key.v1')===before.key&&localStorage.getItem('em.ragflow-credential.v1')===before.rag,messages:old.conversations.every(c=>JSON.stringify(data.conversations.find(n=>n.id===c.id).messages)===JSON.stringify(c.messages)),summaryRestored:data.conversations.find(c=>c.id===id).messages.at(-1).status==='done',otherUnread:data.conversations.find(c=>c.id===other).readState.seenIds.length===0};
  },{before,id,other});assert.deepEqual(intact,{settings:true,messages:true,summaryRestored:true,otherUnread:true});
  fs.writeFileSync(`${root}/native-demo-result.json`,JSON.stringify({passed:true,groups:[id,other],generatedUnread:20,result,intact},null,2));
  console.log(JSON.stringify({passed:true,generatedUnread:20,summarized:12,remainingUnread:8,firstTextMs:result.samples[0]?.ms,elapsedMs:result.elapsedMs,intact}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
