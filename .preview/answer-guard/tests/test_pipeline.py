"""Exercise the real async chat branch with deterministic retrieval/model doubles."""
import asyncio
import json
import os
import tempfile
import unittest
from contextlib import ExitStack
from types import SimpleNamespace
from unittest.mock import patch
from api.db.services import dialog_service as d
from api.db.services import clarification_service as c


class PipelineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.stack = ExitStack()
        self.stack.enter_context(patch.dict(os.environ, RAGFLOW_OPTIMIZATION_DB=self.directory.name + '/audit.sqlite3'))
        self.chunks = [dict(chunk_id='a', kb_id='kb', doc_id='da', docnm_kwd='差旅制度', content_with_weight='住宿限额500元。', content_ltks='住宿 限额', similarity=.4),
                       dict(chunk_id='b', kb_id='kb', doc_id='db', docnm_kwd='招待制度', content_with_weight='招待限额200元。', content_ltks='招待 限额', similarity=.3)]
        self.calls = 0
        self.model_calls = 0
        self.action = 'clarify'
        self.coverage_supported = True
        self.revision = 'revision1'
        test = self

        class Model:
            max_length = 8192
            async def async_chat_streamly_delta(self, *args, **kwargs):
                yield '找不到相关规定'

            async def async_chat(self, system, history, gen_conf, **kwargs):
                test.model_calls += 1
                if '答案与证据一致性审核器' in system:
                    data = json.loads(history[0]['content'])
                    return json.dumps({'answerable': True, 'consistent': '找不到' not in data['draft'],
                        'reason': '有明确限额', 'support':[{'source_id':0,'quote':'住宿限额500元。'}]})
                if '问题预处理器' in system:
                    data = json.loads(history[0]['content'])
                    question = data['question']
                    previous = data['previous_user_messages']
                    corrected = '住宿报销怎么申请?' if previous and question == '怎么申请?' else question
                    return json.dumps({'corrected_question': corrected, 'confidence': .95,
                                       'context_used': bool(previous),
                                       'missing_topic': question == '怎么申请?' and not previous,
                                       'retrieval_queries': ['报销费用规定'] if question == '报销制度' else [corrected],
                                       'ambiguity_score': .8 if test.action == 'clarify' else .2,
                                       'ambiguity_reasons': ['事项不明确'] if test.action == 'clarify' else []})
                if '证据审核器' in system:
                    options = json.loads(history[0]['content'])['options']
                    return json.dumps({'checks': [dict(id=o['id'], supported=test.coverage_supported,
                        answer=o['evidence'][0]['content'], evidence_quotes=[o['evidence'][0]['content']])
                        for o in options]})
                if '意图澄清判定器' in system:
                    return json.dumps({'action': test.action, 'options': [
                        {'question': '出差住宿的报销标准是多少？', 'chunk_ids': ['a'], 'sufficient': True,
                         'evidence_quotes': ['住宿限额500元。']},
                        {'question': '招待费的报销标准是多少？', 'chunk_ids': ['b'], 'sufficient': True,
                         'evidence_quotes': ['招待限额200元。']}]})
                return '根据制度，住宿限额500元。'

        class Retriever:
            dataStore = SimpleNamespace(get=lambda cid, *args: next((x for x in test.chunks if x['chunk_id'] == cid), None))
            async def retrieval(self, *args, **kwargs):
                test.calls += 1
                return c.result_from_chunks(test.chunks)
            def retrieval_by_children(self, chunks, tenant_ids):
                return chunks

        self.dialog = SimpleNamespace(id='chat', tenant_id='owner', name='fixture', llm_id='mock', tenant_llm_id=None,
                                     kb_ids=['kb'], meta_data_filter={}, top_n=6, top_k=128, similarity_threshold=.2,
                                     vector_similarity_weight=.3, rerank_candidates_count=64, llm_setting={},
                                     prompt_config={'system': '根据资料回答：{knowledge}', 'parameters': [{'key':'knowledge','optional':False}], 'quote':False})
        config = {'model_type':'chat','max_tokens':8192,'llm_factory':'mock'}
        for target, value in [
            ('resolve_model_config', lambda *a: config), ('resolve_model_type', lambda *a: ['chat']),
            ('get_models', lambda *a, **kw: ([SimpleNamespace(id='kb', tenant_id='owner')], object(), None, Model(), None)),
            ('get_files_content', lambda *a: ('', [], [])), ('label_question', lambda *a: {}),
            ('kb_prompt', lambda info, *a: [x['content_with_weight'] for x in info['chunks']])]:
            self.stack.enter_context(patch.object(d, target, value))
        self.stack.enter_context(patch.object(d.TenantLangfuseService, 'filter_by_tenant', return_value=None))
        self.stack.enter_context(patch.object(d.KnowledgebaseService, 'get_field_map', return_value={}))
        self.stack.enter_context(patch.object(d.settings, 'retriever', Retriever(), create=True))
        self.stack.enter_context(patch.object(c, 'corpus_revision', side_effect=lambda *args: self.revision))

    def tearDown(self):
        self.stack.close()
        self.directory.cleanup()

    async def ask(self, question, selection=None, history=None):
        audit = {'owner':'owner','cache_status':'not_requested','timings':{}}
        messages = (history or []) + [{'role':'user','content':question}]
        output = [a async for a in d._async_chat_impl(self.dialog, messages, False, session_id='session',
                  clarification_selection=selection, _optimization_state=audit)]
        return output[-1], audit

    async def test_click_reuses_evidence_without_a_second_retrieval(self):
        first, _ = await self.ask('报销标准是多少？')
        self.assertEqual(self.calls, 1)
        choice = first['clarification']['options'][0]
        second, audit = await self.ask(choice['question'], {'cache_id':first['clarification']['cache_id'], 'option_id':choice['id']})
        self.assertEqual(self.calls, 1, 'cache hit must skip retrieval')
        self.assertEqual(audit['cache_status'], 'hit')
        self.assertIn('500', second['answer'])
        self.assertEqual([x['chunk_id'] for x in audit['context']], ['a'])

    async def test_stream_buffers_false_denial_and_persists_only_repair(self):
        self.action = 'answer'
        with patch.object(c, 'authenticated_owner', return_value='owner'):
            answers = [answer async for answer in d.async_chat(self.dialog,
                [{'role':'user','content':'住宿报销标准是多少？'}], True, session_id='session',
                clarification_mode=True, return_diagnostics=True)]
        visible = ''.join(a.get('answer','') for a in answers)
        self.assertNotIn('找不到', visible)
        self.assertIn('500', visible)
        final = answers[-1]['diagnostics']
        self.assertEqual(final['answer_validation']['status'], 'repaired')
        self.assertNotIn('找不到', final['answer'])
        self.assertEqual(c.get_record(final['record_id'], 'owner')['answer'], final['answer'])

    async def test_incomplete_evidence_and_changed_corpus_retrieve_again(self):
        first, _ = await self.ask('报销标准是多少？')
        choice = first['clarification']['options'][1]
        original_read = c.read_selection
        def legacy_selection(*args):
            selection = original_read(*args)
            selection['option'].pop('answer_verified', None)
            return selection
        with patch.object(c, 'read_selection', side_effect=legacy_selection):
            _, audit = await self.ask(choice['question'], {'cache_id':first['clarification']['cache_id'], 'option_id':choice['id']})
        self.assertEqual(self.calls, 2)
        self.assertEqual(audit['cache_status'], 'insufficient_evidence')
        self.revision = 'revision2'
        choice = first['clarification']['options'][0]
        _, audit = await self.ask(choice['question'], {'cache_id':first['clarification']['cache_id'], 'option_id':choice['id']})
        self.assertEqual(self.calls, 3)
        self.assertEqual(audit['cache_status'], 'corpus_changed')

    async def test_clear_question_does_not_emit_options(self):
        self.action = 'answer'
        result, _ = await self.ask('出差住宿的报销标准是多少？')
        self.assertNotIn('clarification', result)
        self.assertIn('500', result['answer'])

    async def test_missing_topic_requests_input_without_retrieval(self):
        result, audit = await self.ask('怎么申请？')
        self.assertTrue(result['clarification']['needs_input'])
        self.assertEqual(self.calls, 0)
        self.assertEqual(audit['queries'], [])

    async def test_context_resolves_incomplete_question(self):
        self.action = 'answer'
        result, audit = await self.ask('怎么申请？', history=[{'role': 'user', 'content': '住宿报销'}])
        self.assertEqual(audit['preprocessing']['normalized_question'], '住宿报销怎么申请?')
        self.assertTrue(audit['preprocessing']['context_used'])
        self.assertNotIn('clarification', result)

    async def test_broad_question_prepares_queries_and_click_skips_preprocessing(self):
        first, audit = await self.ask('报销制度')
        self.assertEqual(audit['preprocessing']['status'], 'success')
        self.assertEqual(audit['queries'], ['报销制度', '报销费用规定'])
        self.assertEqual(self.calls, 2)
        choice = first['clarification']['options'][0]
        _, second_audit = await self.ask(choice['question'], {
            'cache_id': first['clarification']['cache_id'], 'option_id': choice['id']})
        self.assertEqual(self.calls, 2)
        self.assertNotIn('preprocessing', second_audit)
        self.assertEqual(second_audit['cache_status'], 'hit')

    async def test_public_agent_entry_returns_requested_diagnostics(self):
        self.action = 'answer'
        with patch.object(c, 'authenticated_owner', return_value='owner'):
            answers = [answer async for answer in d.rag_agent(self.dialog, [{'role':'user','content':'报销标准是多少？'}],
                False, session_id='session', reasoning=1, clarification_mode=True, return_diagnostics=True)]
        result = answers[-1]
        diagnostics = result['diagnostics']
        self.assertEqual(diagnostics['answer'], result['answer'])
        self.assertEqual(diagnostics['question'], '报销标准是多少？')
        self.assertEqual(len(diagnostics['retrieved_chunks']), 2)
        self.assertEqual(len(diagnostics['context_chunks']), 2)
        self.assertGreater(diagnostics['timings_ms']['total_ms'], 0)
        self.assertEqual(c.get_record(diagnostics['record_id'], 'owner')['status'], 'answered')
        self.assertNotIn('owner', diagnostics)

    async def test_decision_failure_preserves_normal_answer_threshold(self):
        self.chunks[1]['similarity'] = .15
        with patch.object(c, 'decide_clarification', side_effect=TimeoutError):
            result, audit = await self.ask('报销标准是多少？')
        self.assertEqual(result['clarification']['options'], [])
        self.assertTrue(result['clarification']['needs_input'])

    async def test_failed_coverage_never_exposes_intent_buttons(self):
        self.coverage_supported = False
        result, audit = await self.ask('加值班制度')
        self.assertEqual(result['clarification']['options'], [])
        self.assertNotIn('cache_id', result['clarification'])
        self.assertEqual(audit['clarification_decision']['valid_option_count'], 0)


if __name__ == '__main__':
    unittest.main()
