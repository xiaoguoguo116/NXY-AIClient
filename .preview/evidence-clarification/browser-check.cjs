const {chromium}=require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const results=[];
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.setDefaultTimeout(180000);
  await page.goto('http://127.0.0.1:8090');
  const idle=()=>page.waitForFunction(()=>document.querySelector('ragflow-chat')?.ready && !document.querySelector('ragflow-chat').busy);
  await idle();
  await page.evaluate(()=>document.querySelector('ragflow-chat').addEventListener('ragflow-answer',e=>{window.lastAnswer=e.detail.response;}));
  await page.getByRole('textbox',{name:'输入问题'}).fill('加值班制度');
  await page.getByRole('button',{name:'发送 ↑'}).click();
  await idle();
  const initial=await page.evaluate(()=>({response:window.lastAnswer,sessionId:document.querySelector('ragflow-chat').sessionId}));
  assert.ok(initial.response.clarification?.cache_id);
  const options=initial.response.clarification.options;
  assert.equal(await page.locator('.option').count(),options.length);
  await page.screenshot({path:__dirname+'/verified-options.png',fullPage:true});
  for(let i=0;i<options.length;i++){
    // Restore the actual first response to exercise each original button independently.
    await page.evaluate(initial=>{
      const chat=document.querySelector('ragflow-chat');
      chat.sessionId=initial.sessionId;
      chat.messages=[{role:'user',content:'加值班制度',complete:true},
        {role:'assistant',content:initial.response.answer,complete:true,...initial.response}];
      chat.renderMessages(); window.lastAnswer=null;
    },initial);
    const requestPromise=page.waitForRequest(r=>r.url().endsWith('/chat/completions') && r.method()==='POST');
    await page.locator('.option').nth(i).click();
    const request=await requestPromise;
    assert.deepEqual(request.postDataJSON().clarification_selection,{cache_id:initial.response.clarification.cache_id,option_id:options[i].id});
    await idle();
    const answer=await page.evaluate(()=>window.lastAnswer);
    assert.equal(answer?.diagnostics?.cache_status,'hit');
    assert.ok(answer.diagnostics.context_chunks.length);
    const answerText=answer.diagnostics.answer || answer.answer;
    assert.ok(answerText.length>10);
    const displayed=await page.locator('.message.assistant .body').last().textContent();
    assert.equal(displayed,answerText);
    results.push({question:options[i].question,answer:answerText,cache_status:answer.diagnostics.cache_status,
      context:answer.diagnostics.context_chunks});
    console.log('PASS button: '+options[i].question+' / evidence cache hit');
    await page.screenshot({path:__dirname+`/verified-answer-${i+1}.png`,fullPage:true});
  }
  await page.evaluate(()=>{
    const chat=document.querySelector('ragflow-chat');
    chat.messages=[{role:'assistant',content:'旧的无证据选项',complete:true,
      clarification:{mode:'intent',options:[{id:'legacy',question:'无证据模板问题'}]}}];
    chat.renderMessages();
  });
  assert.equal(await page.locator('.option').count(),0);
  fs.writeFileSync(__dirname+'/browser-result.json',JSON.stringify({initial,results,legacyHidden:true},null,2));
  console.log('PASS: actual UI options, all clicks, evidence reuse, and legacy intent buttons hidden');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
