import {readSSE} from 'file:///D:/work/PythonProject/ragflow-chat-module/api.js';
const base='http://127.0.0.1:8090';
const config=await (await fetch(base+'/config')).json();
const {data:session}=await (await fetch(base+`/ragflow-api/chats/${config.chatId}/sessions/30400162c87011f1a1c8c14112e11015`)).json();
const original=session.messages.slice(1,-1).map(({role,content})=>({role,content}));
for(const [label,messages] of [['actual_history',original],['user_history_only',original.filter(m=>m.role==='user')]]) {
  const response=await fetch(base+'/ragflow-api/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:config.chatId,messages,stream:true,reasoning:0,clarification_mode:true,
      return_diagnostics:true,store_history_messages:false,pass_all_history_messages:true}),signal:AbortSignal.timeout(180000)});
  let text='',final;
  for await(const item of readSSE(response)) {if(item.final) final=item;else text+=item.answer||'';}
  console.log(JSON.stringify({label,answer:final?.diagnostics?.answer||text,context:final?.diagnostics?.context_chunks?.map(c=>c.chunk_id),record:final?.diagnostics?.record_id}));
}
