"""Deploy the opt-in draft preview; final evidence guard and storage stay intact."""
from pathlib import Path
import hashlib
import json
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parent
SOURCE = Path('D:/ai/ragflow/custom-v0.27.3/api/db/services/dialog_service.py')
DEPLOY = Path('D:/work/PythonProject/deployment/docker-v0.27.1')
OLD = 'ragflow-custom:v0.27.3-local-followup16'
NEW = 'ragflow-custom:v0.27.3-stream-preview'
CONTAINER = 'ragflow-ragflow-cpu-1'

def run(args):
    result = subprocess.run(args, capture_output=True)
    if result.returncode:
        raise RuntimeError(f'{args[0]} {args[1]} failed: {result.stderr.decode(errors="replace")[-1200:]}')
    return result.stdout

assert run(['docker', 'inspect', '--format', '{{.Config.Image}}', CONTAINER]).decode().strip() == OLD
original = SOURCE.read_bytes()
live = run(['docker', 'exec', CONTAINER, 'cat', '/ragflow/api/db/services/dialog_service.py'])
assert original.replace(b'\r\n', b'\n') == live.replace(b'\r\n', b'\n'), 'Source and running code differ'
(ROOT / 'dialog_service.before.py').write_bytes(original)
text = original.decode('utf-8')
before = '            if check_answer:\n                continue\n            if kind == "marker":'
after = '''            if check_answer:
                # A consenting client can display an explicitly provisional preview.
                # Keep it outside "answer": structure_answer must only persist the
                # subsequently verified answer, never the unreviewed draft.
                if kwargs.get("stream_preview") is True and kind == "text" and not state.in_think:
                    yield {"answer": "", "preview_answer": value, "reference": {},
                           "audio_binary": None, "final": False}
                continue
            if kind == "marker":'''
text = text.replace('\r\n', '\n')
assert text.count(before) == 1
patched = text.replace(before, after)
compile(patched, str(SOURCE), 'exec')
build = ROOT / 'backend-image'
build.mkdir(exist_ok=True)
(build / 'dialog_service.py').write_text(patched, encoding='utf-8')
(build / 'Dockerfile').write_text(f'FROM {OLD}\nCOPY dialog_service.py /ragflow/api/db/services/dialog_service.py\n', encoding='utf-8')
run(['docker', 'build', '-t', NEW, str(build)])
envpath = DEPLOY / '.env'
envbefore = envpath.read_bytes()
assert envbefore.count(('RAGFLOW_IMAGE=' + OLD).encode()) == 1
compose = ['docker', 'compose', '-p', 'ragflow', '--profile', 'cpu', '-f', str(DEPLOY / 'docker-compose.yml'),
           'up', '-d', '--no-deps', '--force-recreate', 'ragflow-cpu']
try:
    SOURCE.write_text(patched, encoding='utf-8')
    envpath.write_bytes(envbefore.replace(('RAGFLOW_IMAGE=' + OLD).encode(), ('RAGFLOW_IMAGE=' + NEW).encode()))
    run(compose)
    deadline = time.monotonic() + 180
    while True:
        try:
            with urllib.request.urlopen('http://127.0.0.1:9380/api/v1/language', timeout=3) as response:
                assert json.load(response).get('code') == 0
            break
        except Exception:
            if time.monotonic() > deadline: raise RuntimeError('API health timeout')
            time.sleep(2)
except Exception:
    SOURCE.write_bytes(original)
    envpath.write_bytes(envbefore)
    run(compose)
    raise
report = {'image': NEW, 'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(), 'healthy': True}
(ROOT / 'backend-deploy.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
