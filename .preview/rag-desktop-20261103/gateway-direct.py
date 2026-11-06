import importlib.util,json
from pathlib import Path
source=Path('D:/work/PythonProject/ragflow-chat-module/server.py')
spec=importlib.util.spec_from_file_location('em_rag_gateway',source);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
config=Path('D:/work/PythonProject/document_agent_data')
key=json.loads((config/'secrets.json').read_text(encoding='utf-8-sig'))['api_key'].strip()
server=module.create_server('127.0.0.1',8090,'http://172.23.123.118/api/v1','1f8d4354c38711f193a109fdac79609a',demo_key=key)
print('RAG gateway uses the verified local Docker endpoint.',flush=True)
server.serve_forever()
