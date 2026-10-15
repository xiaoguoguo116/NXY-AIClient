import {readSSE} from 'file:///D:/work/PythonProject/ragflow-chat-module/api.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8090';
for(let i=0;i<30;i++) {
  try {if((await fetch('http://localhost/api/v1/system/ping')).ok) break;} catch {}
  await new Promise(r=>setTimeout(r,2000));
}
const config=await (await fetch(base+'/config')).json();
const {data:old}=await (await fetch(base+'/ragflow-api/optimization/records/425b11cbfef945a9bc1de165a84cd737')).json();
const results=[];
for(const [label,stream,history] of [['new_session',false,[]],['old_answer_session',true,
  [{role:'user',content:'一年可以请多少病假'},{role:'assistant',content:old.answer}]]]) {
  const response=await fetch(base+'/ragflow-api/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:config.chatId,messages:[...history,{role:'user',content:'一年可以请多少病假'}],
      stream,reasoning:0,clarification_mode:true,return_diagnostics:true,store_history_messages:true,
      pass_all_history_messages:true}),signal:AbortSignal.timeout(180000)});
  let text='',final;
  for await(const item of readSSE(response)) {if(item.final) final=item;else text+=item.answer||'';}
  const answer=final?.diagnostics?.answer||final?.answer||text;
  results.push({label,stream,answer,response:final,visibleStream:text});
  fs.writeFileSync(new URL('./live-result.json',import.meta.url),JSON.stringify(results,null,2));
  console.log(JSON.stringify({label,answer,validation:final?.diagnostics?.answer_validation,
    session:final?.session_id,record:final?.diagnostics?.record_id}));
  assert.match(answer,/24\s*个?工作日/);
  assert.match(answer,/3\s*个?工作日/);
  assert.match(answer,/超[过额]/);
  assert.match(answer,/长期病假|医疗期/);
  assert.match(answer,/不[是等意]|并非|并不/);
  assert.doesNotMatch(answer,/找不到|not found in the dataset|未通过证据核验/);
  assert.ok(['passed','repaired'].includes(final?.diagnostics?.answer_validation?.status));
  assert.ok(final.diagnostics.context_chunks.some(c=>(c.content_with_weight||'').includes('每年累计不超过24')));
  if(stream) assert.equal(text,answer);
}
console.log('PASS: fresh and old-answer sessions explain 24 working days, monthly condition and excess review');
