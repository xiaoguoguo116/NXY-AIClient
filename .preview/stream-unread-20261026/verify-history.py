import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parent
result = json.loads((root / 'native-result.json').read_text(encoding='utf-8'))['rag']
script = '''import json, hashlib, sys
from pathlib import Path
import pymysql, yaml
db = yaml.safe_load(Path('/ragflow/conf/service_conf.yaml').read_text())['mysql']
connection = pymysql.connect(host=db['host'], port=int(db.get('port', 3306)), user=db['user'], password=db['password'], database=db['name'])
with connection.cursor() as cursor:
    cursor.execute('SELECT message FROM conversation WHERE id=%s', (sys.argv[1],))
    row = cursor.fetchone()
connection.close()
messages = json.loads(row[0])
answer = messages[-1]['content']
print(json.dumps({'answer_sha256': hashlib.sha256(answer.encode()).hexdigest(), 'last_role': messages[-1]['role'], 'message_count':len(messages), 'preview_fields_persisted':any('preview_answer' in m for m in messages)}))
'''
process = subprocess.run(['docker', 'exec', '-i', 'ragflow-ragflow-cpu-1', '/ragflow/.venv/bin/python', '-', result['rag']['sessionId']], input=script.encode(), capture_output=True, check=True)
report = json.loads(process.stdout)
assert report['answer_sha256'] == hashlib.sha256(result['text'].encode()).hexdigest(), 'Persisted answer differs from final UI answer'
assert report['last_role'] == 'assistant' and not report['preview_fields_persisted']
report['passed'] = True
(root / 'backend-history-result.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
