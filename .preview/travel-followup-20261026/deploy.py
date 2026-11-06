"""Install reviewed source patch and update only the Compose image value."""
from pathlib import Path

root = Path(__file__).resolve().parent
backend = Path('D:/work/PythonProject/deployment/ragflow-query-rewrite')
paths = ['api/db/services/clarification_service.py', 'api/db/services/dialog_service.py',
         'tests/test_clarification.py', 'tests/test_pipeline.py']
for relative in paths:
    if (backend / relative).read_bytes() != (root / 'before-v16' / Path(relative).name).read_bytes():
        raise RuntimeError(f'Source changed since inspection: {relative}')
env = Path('D:/work/PythonProject/deployment/docker-v0.27.1/.env')
before = env.read_bytes()
old = b'RAGFLOW_IMAGE=ragflow-custom:v0.27.1-travel-followup-15'
new = b'RAGFLOW_IMAGE=ragflow-custom:v0.27.1-travel-followup-16'
if before.count(old) != 1:
    raise RuntimeError('Unexpected current image; configuration not changed')
for relative in paths:
    (backend / relative).write_bytes((root / 'staged' / relative).read_bytes())
env.write_bytes(before.replace(old, new))
print('Installed two backend source files and their regression tests; image travel-followup-15 -> travel-followup-16.')
