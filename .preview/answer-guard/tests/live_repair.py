"""Replay the actual stale draft through the production guard and model."""
import asyncio
import json
import sqlite3
from api.db.services.dialog_service import DialogService, get_models
from api.db.services.answer_guard import ensure_consistent_answer
from rag.prompts.generator import kb_prompt
from common import settings

with open('/ragflow/conf/llm_factories.json') as model_catalog:
    settings.FACTORY_LLM_INFOS = json.load(model_catalog)['factory_llm_infos']

db = sqlite3.connect('/ragflow/logs/optimization.sqlite3')
record = json.loads(db.execute('SELECT payload FROM records WHERE id=?',
    ('425b11cbfef945a9bc1de165a84cd737',)).fetchone()[0])
found, dialog = DialogService.get_by_id(record['chat_id'])
assert found
_, _, _, model, _ = get_models(dialog)
knowledge = kb_prompt({'chunks':record['context']}, 16000)
diagnostic = {}
answer = asyncio.run(ensure_consistent_answer(model, record['question'], record['answer'], knowledge, diagnostic))
print(json.dumps({'answer':answer,'validation':diagnostic},ensure_ascii=False))
assert diagnostic['status'] == 'repaired'
assert diagnostic['reviews'][0]['consistent'] is False
assert diagnostic['reviews'][1]['consistent'] is True
assert '24' in answer and '3' in answer and '工作日' in answer
assert '医疗期' in answer and ('超额' in answer or '超过' in answer)
assert 'not found in the dataset' not in answer
print('PASS: real stale denial rejected, regenerated and reverified')
