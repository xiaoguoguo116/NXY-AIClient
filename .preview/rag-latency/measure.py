import json,time,urllib.request
from pathlib import Path
base='http://127.0.0.1:8090'
t=time.perf_counter(); marks={}
def mark(name): marks[name]=round((time.perf_counter()-t)*1000,1)
def req(path,body=None):
 return urllib.request.urlopen(urllib.request.Request(base+'/'+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'}),timeout=150)
c=json.load(req('config'));mark('config_ready')
s=json.load(req('ragflow-api/chats/'+c['chatId']+'/sessions',{'name':'首字耗时诊断'}))['data'];mark('session_ready')
body=dict(chat_id=c['chatId'],session_id=s['id'],messages=[dict(role='user',content='加班需要满足什么条件、由谁审批？')],stream=True,stream_preview=True,reasoning=0,clarification_mode=True,return_diagnostics=True,store_history_messages=True,pass_all_history_messages=False)
r=req('ragflow-api/chat/completions',body);mark('headers')
final=None;events=0
for line in r:
 if not line.startswith(b'data:'):continue
 data=json.loads(line[5:]).get('data');events+=1
 if not isinstance(data,dict):continue
 if 'first_text' not in marks and (data.get('preview_answer') or data.get('answer')):mark('first_text');marks['first_text_chars']=len(data.get('preview_answer') or data.get('answer'));print(json.dumps(marks),flush=True)
 if data.get('final'):final=data
mark('complete')
Path('.preview/rag-latency/measurement.json').write_text(json.dumps({'marks':marks,'events':events,'final':final},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'marks':marks,'final_keys':list((final or {}).keys()),'diagnostic_keys':list((final or {}).get('diagnostics',{}).keys())},ensure_ascii=False))
