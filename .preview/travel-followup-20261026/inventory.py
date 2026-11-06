"""Read connected knowledge base documents; keep local credentials in memory."""
import json
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent
CONFIG = Path('D:/work/PythonProject/document_agent_data')
settings = json.loads((CONFIG / 'settings.json').read_text(encoding='utf-8-sig'))
private = json.loads((CONFIG / 'secrets.json').read_text(encoding='utf-8-sig'))
session = requests.Session()
session.trust_env = False
session.headers['Authorization'] = 'Bearer ' + private['api_key'].strip()
base = settings['base_url'].rstrip('/')
if not base.endswith('/api/v1'):
    base += '/api/v1'

def api(route, **params):
    response = session.get(base + route, params=params, timeout=60)
    response.raise_for_status()
    payload = response.json()
    if payload.get('code') != 0:
        raise RuntimeError(f'API error {payload.get("code")} at {route}')
    return payload['data']

def rows(data, field):
    return data if isinstance(data, list) else data.get(field, [])

chat_id = requests.get('http://127.0.0.1:8090/config', timeout=15).json()['chatId']
chats = rows(api('/chats', id=chat_id, page_size=100), 'chats')
chat = next(c for c in chats if c['id'] == chat_id)
report = {'chat_id': chat_id, 'chat_name': chat.get('name'), 'dataset_ids': chat.get('dataset_ids', []), 'documents': [], 'travel_documents': []}
for dataset_id in report['dataset_ids']:
    page = 1
    while True:
        docs = rows(api(f'/datasets/{dataset_id}/documents', page=page, page_size=100), 'docs')
        for doc in docs:
            record = {k: doc.get(k) for k in ['id', 'name', 'chunk_count', 'run', 'progress', 'status']}
            record['dataset_id'] = dataset_id
            report['documents'].append(record)
            if any(word in str(doc.get('name')) for word in ['出差', '差旅', '报销']):
                chunks = []
                chunk_page = 1
                while True:
                    batch = rows(api(f'/datasets/{dataset_id}/documents/{doc["id"]}/chunks', page=chunk_page, page_size=100), 'chunks')
                    chunks.extend({'id': c.get('id', c.get('chunk_id')), 'text': c.get('content', c.get('content_with_weight', ''))} for c in batch)
                    if len(batch) < 100:
                        break
                    chunk_page += 1
                report['travel_documents'].append({**record, 'chunks': chunks})
        if len(docs) < 100:
            break
        page += 1
(ROOT / 'inventory.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'chat_id': chat_id, 'dataset_count': len(report['dataset_ids']), 'document_count': len(report['documents']),
                  'travel_documents': [{k: v for k, v in d.items() if k != 'chunks'} | {'readable_chunks': len(d['chunks'])} for d in report['travel_documents']]}, ensure_ascii=False))
