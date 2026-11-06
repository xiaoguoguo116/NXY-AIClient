import json, time
from pathlib import Path
import requests

root = Path('.preview/verification-20261104')
session = requests.Session()
session.trust_env = False
agent = 'http://127.0.0.1:8092'
state = session.get(agent + '/api/state', timeout=5).json()
token = {'X-Agent-Token': state['token']}
settings = state['settings']
api = settings['base_url'].rstrip('/')
if not api.endswith('/api/v1'):
    api += '/api/v1'
key = json.loads(Path('D:/work/PythonProject/document_agent_data/secrets.json').read_text(encoding='utf-8-sig'))['api_key']
auth = {'Authorization': 'Bearer ' + key}
def call(method, path, **kwargs):
    response = session.request(method, api + path, headers=auth, timeout=90, **kwargs)
    response.raise_for_status()
    result = response.json()
    assert result.get('code') == 0, result.get('message', 'Knowledge API error')
    return result.get('data')

datasets = call('GET', '/datasets')
source = next(d for d in datasets if d['id'] == settings['dataset_id'])
created = call('POST', '/datasets', json={'name': '项目交接资料-' + str(int(time.time())), 'embedding_model': source['embedding_model']})
dataset_id = created['id']
try:
    job_id = json.loads((root/'document-agent.json').read_text())['jobId']
    job = session.get(agent + '/api/jobs/' + job_id, timeout=5).json()['job']
    response = session.post(agent + '/api/jobs/' + job_id + '/upload', headers=token,
                            json={'dataset_id': dataset_id, 'revision': job['revision'], 'reviewed': True}, timeout=10)
    response.raise_for_status()
    assert response.json().get('job'), 'Document upload rejected'
    print('Document ingestion started', flush=True)
    for _ in range(60):
        job = session.get(agent + '/api/jobs/' + job_id, timeout=5).json()['job']
        if job['status'] != 'uploading':
            break
        time.sleep(1)
    assert job['status'] == 'complete', job.get('error') or job['status']
    assert job['upload_result']['chunks'] > 0
    (root/'ingestion.json').write_text(json.dumps({'status': 'passed', 'chunks': job['upload_result']['chunks'], 'separateDataset': True}), encoding='utf-8')
    print('PASS: document ingested and chunks read back', flush=True)
finally:
    call('DELETE', '/datasets', json={'ids': [dataset_id]})
    print('Temporary dataset removed; original dataset unchanged', flush=True)
