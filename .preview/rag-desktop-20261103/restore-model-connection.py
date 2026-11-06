"""Restore the local RAGFlow DeepSeek connection after a Docker restart.

Run on Windows with Python 3.10+. Does not change VPN settings or model keys.
"""
import ipaddress
import json
from pathlib import Path
import re
import socket
import subprocess
import time

ROOT = Path(__file__).resolve().parent
CONTAINER = 'ragflow-ragflow-cpu-1'


def run(args, **kwargs):
    return subprocess.run(args, check=True, capture_output=True, text=True,
                          encoding='utf-8', errors='replace', timeout=30, **kwargs).stdout.strip()


def container_python(code):
    return run(['docker', 'exec', CONTAINER, '/ragflow/.venv/bin/python', '-c', code])


networks = json.loads(run(['docker', 'inspect', CONTAINER, '--format', '{{json .NetworkSettings.Networks}}']))
network = networks.get('ragflow_ragflow')
if not network:
    raise RuntimeError('Expected existing RAGFlow network is unavailable')
gateway = str(ipaddress.IPv4Address(network['Gateway']))


def relay_ready():
    result = subprocess.run(['docker', 'exec', CONTAINER, 'curl', '-sS', '--max-time', '5',
                             '--resolve', f'api.deepseek.com:443:{gateway}', '-o', '/dev/null',
                             '-w', '%{http_code}', 'https://api.deepseek.com'],
                            capture_output=True, text=True, timeout=8)
    return result.returncode == 0 and result.stdout.strip() == '401'


if not relay_ready():
    rows = run(['wsl.exe', '-d', 'docker-desktop', '--', 'ps']).splitlines()

    def process_id(pattern):
        matches = [int(line.split()[0]) for line in rows if re.search(pattern, line)]
        if len(matches) != 1:
            raise RuntimeError('Cannot identify the running Docker/RAG API process; wait for startup and retry')
        return matches[0]

    daemon_pid = process_id(r'\s/usr/local/bin/dockerd --')
    api_pid = process_id(r'\spython3 api/ragflow_server\.py(?:\s|$)')
    upstream = str(ipaddress.IPv4Address(socket.getaddrinfo('api.deepseek.com', 443, socket.AF_INET)[0][4][0]))
    run(['docker', 'cp', str(ROOT / 'model-tls-relay.py'), CONTAINER + ':/tmp/em-model-tls-relay.py'])
    command = (f'exec 8</proc/1/ns/net; exec 9</proc/{daemon_pid}/ns/net; '
               f'exec nsenter -t {api_pid} -m -r -w -- /ragflow/.venv/bin/python '
               f'/tmp/em-model-tls-relay.py {upstream} {gateway}')
    with (ROOT / 'model-relay.stdout.log').open('ab') as stdout, (ROOT / 'model-relay.stderr.log').open('ab') as stderr:
        process = subprocess.Popen(['wsl.exe', '-d', 'docker-desktop', '--', 'sh', '-c', command],
                                   stdout=stdout, stderr=stderr,
                                   creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP)
    (ROOT / 'model-relay.pid').write_text(str(process.pid), encoding='ascii')
    time.sleep(1)
    if not relay_ready():
        raise RuntimeError('TLS relay is not ready; existing hosts and model code were not changed')

print(container_python(f'''from pathlib import Path
p=Path('/etc/hosts')
s=p.read_text()
tag='# em-wsl-deepseek-tls-relay'
lines=[line for line in s.splitlines() if tag not in line]
assert not any('api.deepseek.com' in line and not line.lstrip().startswith('#') for line in lines), 'Unmanaged model host override exists'
backup=Path('/tmp/em-hosts-before-model-relay-20261103')
if not backup.exists(): backup.write_text(s)
p.write_text('\\n'.join(lines).rstrip()+'\\n{gateway} api.deepseek.com '+tag+'\\n')
print('DeepSeek TLS route ready')
'''))

print(container_python('''from pathlib import Path
import os,signal
p=Path('/ragflow/rag/llm/chat_model.py')
s=p.read_text()
marker='# DeepSeek compressed streams can arrive with incomplete zstd frames.'
if marker not in s:
 needle='        extra_headers = deepcopy(completion_args.get("extra_headers") or {})\\n'
 assert s.count(needle)==1, 'Model source changed; patch needs review'
 addition='        '+marker+'\\n        if self.provider == SupportedLiteLLMProvider.DeepSeek:\\n            extra_headers = {{k: v for k, v in extra_headers.items() if k.lower() != "accept-encoding"}}\\n            extra_headers["Accept-Encoding"] = "identity"\\n'
 addition=addition.replace('{{','{').replace('}}','}')
 updated=s.replace(needle,needle+addition)
 compile(updated,str(p),'exec')
 Path('/tmp/chat_model.before-encoding-fix-20261103.py').write_text(s)
 p.write_text(updated)
 for proc in Path('/proc').iterdir():
  if proc.name.isdigit():
   try: args=(proc/'cmdline').read_bytes().split(b'\\0')
   except OSError: continue
   if len(args)>1 and args[1]==b'api/ragflow_server.py': os.kill(int(proc.name),signal.SIGTERM)
 print('Encoding fix applied; API supervisor is reloading it')
else: print('DeepSeek encoding fix already installed')
'''))
print('Restored. Retry the RAG assistant after the API is ready.')
