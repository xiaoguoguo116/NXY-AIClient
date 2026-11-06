import concurrent.futures
import json
from pathlib import Path
import subprocess

secret = json.loads(Path('D:/work/PythonProject/document_agent_data/secrets.json').read_text(encoding='utf-8-sig'))['model_api_key']
code = '''import json,sys,time,requests
p=json.load(sys.stdin)
started=time.monotonic()
try:
 r=requests.post('https://api.deepseek.com/chat/completions',headers={'Authorization':'Bearer '+p['key'],'Accept-Encoding':p['encoding']},json={'model':'deepseek-chat','messages':[{'role':'user','content':'Reply OK.'}],'max_tokens':16,'stream':False},timeout=35)
 try: data=r.json()
 except ValueError: data={}
 print(json.dumps({'encoding':p['encoding'],'status':r.status_code,'content_encoding':r.headers.get('Content-Encoding'),'seconds':round(time.monotonic()-started,1),'text':str(data.get('choices',[{}])[0].get('message',{}).get('content',''))[:80],'error_type':data.get('error',{}).get('type')}))
except Exception as e:
 print(json.dumps({'encoding':p['encoding'],'error':type(e).__name__,'seconds':round(time.monotonic()-started,1)}))
'''


def check(encoding):
    result = subprocess.run(['docker', 'exec', '-i', 'ragflow-ragflow-cpu-1', '/ragflow/.venv/bin/python', '-c', code],
                            input=json.dumps({'key': secret, 'encoding': encoding}), text=True,
                            capture_output=True, timeout=45)
    print(result.stdout.strip(), flush=True)


with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(check, ['identity', 'gzip, deflate, br, zstd']))
