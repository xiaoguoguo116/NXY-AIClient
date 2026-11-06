const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const root='.preview/unread-demo-20261026',id='unread-demo-release-20261026';
(async()=>{
 const browser=await chromium.connectOverCDP('http://127.0.0.1:19224');
 try{
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().startsWith('http://tauri.localhost/home/'));assert(page);
  const old=JSON.parse(fs.readFileSync(`${root}/native-demo-result.json`,'utf8'));
  await page.evaluate(({id,answerId,requestId})=>{
   if([...document.querySelectorAll('textarea')].some(e=>e.value.trim()))throw Error('User draft present');
   const data=JSON.parse(localStorage.getItem('em.local-chat.v1'));const c=data.conversations.find(c=>c.id===id);
   if(!c||c.messages.some(m=>m.status==='pending'))throw Error('Demo not ready');
   c.messages=c.messages.filter(m=>m.id!==answerId&&m.id!==requestId);c.readState={seenIds:[id+'-old'],summaryIds:[]};data.selectedId=id;
   localStorage.setItem('em.local-chat.v1',JSON.stringify(data));
  },{id,answerId:old.result.answer.id,requestId:old.result.request.id});
  await page.reload();await page.bringToFront();await page.getByRole('button',{name:'总结未读',exact:true}).waitFor();
  await page.evaluate(()=>{window.demoStart=performance.now();window.demoUpdates=[];window.demoObserver=new MutationObserver(()=>{const n=document.querySelector('.stream-cursor')?.closest('.bubble');if(n&&window.demoUpdates.at(-1)?.length!==n.innerText.length)window.demoUpdates.push({ms:Math.round(performance.now()-window.demoStart),length:n.innerText.length});});window.demoObserver.observe(document.querySelector('.messages'),{subtree:true,childList:true,characterData:true});});
  await page.getByRole('button',{name:'总结未读',exact:true}).click();
  await page.waitForFunction(id=>{const m=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id).messages.at(-1);return m.role==='assistant'&&m.status!=='pending'},id,{timeout:135000});
  const result=await page.evaluate(id=>{window.demoObserver.disconnect();const c=JSON.parse(localStorage.getItem('em.local-chat.v1')).conversations.find(c=>c.id===id);return {answer:c.messages.at(-1),request:c.messages.find(m=>m.id===c.messages.at(-1).replyTo),samples:window.demoUpdates,elapsedMs:Math.round(performance.now()-window.demoStart)}},id);
  assert.equal(result.answer.status,'done',result.answer.error);assert.equal(result.request.summarySourceIds.length,12);
  fs.writeFileSync(`${root}/native-retest-result.json`,JSON.stringify(result,null,2));
  const bubble=page.locator(`[data-message-id="${result.answer.id}"] .bubble`);
  await bubble.evaluate(n=>{const area=document.querySelector('.messages');area.scrollTop+=n.getBoundingClientRect().top-area.getBoundingClientRect().top-12;});
  const box=await bubble.boundingBox(),area=await page.locator('.messages').boundingBox();
  await page.screenshot({path:`${root}/06-summary-excerpt.png`,clip:{x:box.x,y:Math.max(area.y,box.y),width:box.width,height:Math.min(600,area.y+area.height-Math.max(area.y,box.y)-4)}});
  await page.screenshot({path:`${root}/06-summary-full.png`});
  assert(result.answer.text.includes('16:30')||result.answer.text.includes('16：30'));
  assert(result.answer.text.split('\n').some(line=>line.includes('赵宁')&&/18[:：]00/.test(line)),'Known monitoring owner or deadline missing');
  console.log(JSON.stringify({passed:true,sourceCount:12,updates:result.samples.length,firstTextMs:result.samples[0]?.ms,elapsedMs:result.elapsedMs}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
