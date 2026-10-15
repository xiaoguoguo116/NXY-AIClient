const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:8090';
const report = {question:'加值班制度', selections:[]};
const save = () => fs.writeFileSync(__dirname+'/live-result.json',JSON.stringify(report,null,2));
async function json(path, body) {
  const response = await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});
  assert.ok(response.ok, `HTTP ${response.status}`);
  const data = await response.json();
  if (path === '/config') return data;
  assert.equal(data.code,0, data.message);
  return data.data;
}
(async()=>{
  for(let i=0;i<30;i++) {
    try {if((await fetch('http://localhost/api/v1/system/ping')).ok) break;} catch {}
    await new Promise(r=>setTimeout(r,2000));
  }
  const config = await json('/config');
  const request = {chat_id:config.chatId, messages:[{role:'user',content:report.question}],stream:false,clarification_mode:true,return_diagnostics:true};
  report.initial = await json('/ragflow-api/chat/completions',request);
  save();
  console.log(JSON.stringify({answer:report.initial.answer,clarification:report.initial.clarification,decision:report.initial.diagnostics?.clarification_decision}));
  assert.ok(report.initial.clarification?.cache_id,'Expected evidence-backed clarification cache');
  for(const option of report.initial.clarification.options) {
    const answer = await json('/ragflow-api/chat/completions',{...request,session_id:report.initial.session_id,
      messages:[{role:'user',content:option.question}],clarification_selection:{cache_id:report.initial.clarification.cache_id,option_id:option.id}});
    report.selections.push({option,answer}); save();
    console.log(JSON.stringify({question:option.question,answer:answer.answer,cache_status:answer.diagnostics?.cache_status,
      context:answer.diagnostics?.context_chunks?.map(c=>({id:c.chunk_id,content:c.content_with_weight||c.content}))}));
    assert.equal(answer.diagnostics?.cache_status,'hit');
    assert.ok(answer.answer?.length > 10);
    assert.ok(answer.diagnostics?.context_chunks?.length);
    assert.ok(!answer.clarification);
  }
  console.log('PASS: every option answered using its cached evidence');
})().catch(error=>{save(); console.error(error); process.exitCode=1;});
