import json
from pathlib import Path
import time
import requests

base = 'http://127.0.0.1:8090'
question = '出差前如何提交出差申请，需要提前多久，以及不同预算金额由谁审批？'
config = requests.get(base + '/config', timeout=5).json()
session = requests.post(base + '/ragflow-api/chats/' + config['chatId'] + '/sessions',
                        json={'name': '连接恢复验证：出差申请流程'}, timeout=10).json()['data']
started = time.monotonic()
with requests.post(base + '/ragflow-api/chat/completions', json={
    'chat_id': config['chatId'], 'session_id': session['id'],
    'messages': [{'role': 'user', 'content': question}],
    'stream': True, 'stream_preview': True, 'reasoning': 0,
    'clarification_mode': True, 'return_diagnostics': True,
    'store_history_messages': True, 'pass_all_history_messages': False,
}, stream=True, timeout=(10, 120)) as response:
    response.raise_for_status()
    print('Question accepted:', response.status_code, flush=True)
    first = True
    final = None
    for line in response.iter_lines(chunk_size=1):
        if not line.startswith(b'data:'):
            continue
        payload = line[5:].strip()
        if payload == b'[DONE]':
            continue
        event = json.loads(payload)
        if str(event.get('code')) != '0':
            raise RuntimeError('RAG response code: ' + str(event.get('code')))
        data = event.get('data')
        if not isinstance(data, dict):
            continue
        if first:
            print('First event seconds:', round(time.monotonic() - started, 1), flush=True)
            first = False
        if data.get('final'):
            final = data
    if not final:
        raise RuntimeError('No final answer received')
    elapsed = round(time.monotonic() - started, 1)
    Path(__file__).with_name('travel-answer.json').write_text(json.dumps({'seconds': elapsed, 'data': final}, ensure_ascii=False, indent=2), encoding='utf-8')
    diagnostics = final.get('diagnostics') or {}
    answer = diagnostics.get('answer') or final.get('answer') or ''
    refs = (final.get('reference') or {}).get('chunks') or diagnostics.get('context_chunks') or []
    print(json.dumps({'seconds': elapsed, 'answer': answer, 'references': len(refs)}, ensure_ascii=False), flush=True)
