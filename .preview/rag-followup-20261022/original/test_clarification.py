import asyncio
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('clarification', Path(__file__).parents[1] / 'api/db/services/clarification_service.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)


class ClarificationTests(unittest.TestCase):
    def test_literal_chinese_quotes_are_not_normalized_as_questions(self):
        chunks = [dict(c, content_with_weight=c['content_with_weight']+'，限额（含税）。') for c in self.chunks]
        options = [dict(o, evidence_quotes=[chunks[i]['content_with_weight']]) for i, o in enumerate(self.options)]
        result = s.validate_options({'action':'clarify','options':options}, chunks, 3)
        self.assertEqual(len(result), 2)
        self.assertIn('，', result[0]['evidence_quotes'][0])
        options[1]['evidence_quotes'] = ['招待限额200元，限额（不含税）。']
        self.assertEqual(s.validate_options({'action':'clarify','options':options}, chunks, 3), [])

    def test_insufficient_evidence_cannot_become_a_button(self):
        options = [self.options[0], dict(self.options[1], sufficient=False)]
        self.assertEqual(s.validate_options({'action': 'clarify', 'options': options}, self.chunks, 3), [])
        self.assertFalse(hasattr(s, 'input_clarification'))

    def test_coverage_failure_never_returns_unverified_options(self):
        test = self
        class Model:
            async def async_chat(inner, system, messages, config):
                return json.dumps({'checks': [dict(id=o['id'], supported=i == 0,
                    answer='住宿限额500元', evidence_quotes=o['evidence_quotes'])
                    for i, o in enumerate(test.options)]})
        diagnostic = {}
        result = asyncio.run(s.verify_option_answers(Model(), '报销标准', self.options,
                            self.chunks, s.DEFAULTS, diagnostic))
        self.assertEqual(result, [])
        self.assertFalse(diagnostic['answer_coverage'][1]['supported'])

    def test_coverage_timeout_and_fabricated_quote_fail_closed(self):
        test = self
        class Model:
            fail = False
            async def async_chat(inner, *args):
                if inner.fail:
                    raise TimeoutError()
                return json.dumps({'checks': [dict(id=o['id'], supported=True,
                    answer='有答案', evidence_quotes=['不存在的完整原文']) for o in test.options]})
        model = Model()
        for fail in (False, True):
            model.fail = fail
            self.assertEqual(asyncio.run(s.verify_option_answers(model, '报销标准', self.options,
                self.chunks, s.DEFAULTS, {})), [])

    def test_detected_ambiguity_must_not_silently_answer(self):
        prep = dict(status='success', ambiguity_score=.8, ambiguity_reasons=['含义不明确'])
        self.assertTrue(s.requires_clarification(prep, '加值班制度'))
        self.assertFalse(s.requires_clarification(prep, '分别介绍加班和值班制度'))
        self.assertFalse(s.requires_clarification(prep, '加班与值班制度的区别'))
        self.assertFalse(s.requires_clarification(dict(prep, ambiguity_score=.2), '加班工资何时发放'))
        self.assertFalse(s.requires_clarification(dict(prep, status='fallback'), '加值班制度'))

    def test_decision_receives_preprocessing_and_records_rejected_options(self):
        class Model:
            async def async_chat(inner, system, messages, config):
                payload = json.loads(messages[0]['content'])
                self.assertEqual(payload['preprocessing']['ambiguity_score'], .8)
                return json.dumps({'action': 'clarify', 'options': []})
        diagnostic = {}
        result = asyncio.run(s.decide_clarification(Model(), '加值班制度', self.chunks,
                            s.DEFAULTS, {'ambiguity_score': .8}, diagnostic))
        self.assertEqual(result, [])
        self.assertEqual(diagnostic['reason'], 'options_failed_validation')

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, RAGFLOW_OPTIMIZATION_DB=self.directory.name + '/test.sqlite3')
        self.env.start()
        self.chunks = [dict(chunk_id='a', doc_id='da', docnm_kwd='差旅制度', content_with_weight='住宿限额500元', similarity=.4),
                       dict(chunk_id='b', doc_id='db', docnm_kwd='招待制度', content_with_weight='招待限额200元', similarity=.3)]
        self.options = [dict(id='oa', question='出差住宿的报销标准是多少？', chunk_ids=['a'], sufficient=True,
                             evidence_quotes=['住宿限额500元']),
                        dict(id='ob', question='招待费的报销标准是多少？', chunk_ids=['b'], sufficient=True,
                             evidence_quotes=['招待限额200元'])]

    def tearDown(self):
        self.env.stop()
        self.directory.cleanup()

    def test_selection_is_bound_to_owner_session_and_exact_question(self):
        cache = s.cache_options('alice-session1', 'rev1', self.options, self.chunks, 600)
        hit = s.read_selection(cache, 'oa', self.options[0]['question'], 'alice-session1')
        self.assertEqual([c['chunk_id'] for c in hit['chunks']], ['a'])
        self.assertIsNone(s.read_selection(cache, 'oa', self.options[0]['question'], 'bob-session1'))
        self.assertIsNone(s.read_selection(cache, 'oa', '更改后的问题', 'alice-session1'))
        self.assertIsNone(s.read_selection(cache, 'unknown', self.options[0]['question'], 'alice-session1'))

    def test_expiry_does_not_reuse_old_evidence(self):
        cache = s.cache_options('scope', 'rev', self.options, self.chunks, -1)
        self.assertIsNone(s.read_selection(cache, 'oa', self.options[0]['question'], 'scope'))

    def test_audit_visibility_and_pagination(self):
        for index in range(23):
            s.save_record(dict(id=str(index), owner='alice', question='报销'+str(index), created=index,
                              status='answered', answer='内容', candidates=self.chunks))
        s.save_record(dict(id='private', owner='bob', question='人事', created=100, status='answered'))
        self.assertEqual(s.list_records('alice')['total'], 23)
        self.assertEqual(len(s.list_records('alice', page=2)['items']), 3)
        self.assertIsNone(s.get_record('private', 'alice'))
        self.assertEqual(s.list_records('admin', admin=True)['total'], 24)
        self.assertEqual(s.get_record('private', 'admin', True)['owner'], 'bob')

    def test_no_fabricated_or_duplicate_evidence_options(self):
        valid = {'action': 'clarify', 'options': self.options}
        self.assertEqual(len(s.validate_options(valid, self.chunks, 3)), 2)
        invalid = {'action': 'clarify', 'options': [self.options[0], dict(self.options[1], chunk_ids=['fake'])]}
        self.assertEqual(s.validate_options(invalid, self.chunks, 3), [])
        duplicate = {'action': 'clarify', 'options': [self.options[0], dict(self.options[1], chunk_ids=['a'])]}
        self.assertEqual(s.validate_options(duplicate, self.chunks, 3), [])
        self.assertEqual(s.validate_options({'action': 'answer', 'options': self.options}, self.chunks, 3), [])

    def test_exact_questions_and_comparisons_skip_widening(self):
        self.assertFalse(s.may_need_clarification('查询合同 HT-2026-001'))
        self.assertFalse(s.may_need_clarification('对比差旅和招待费制度'))
        self.assertTrue(s.may_need_clarification('报销标准是多少？'))

    def test_structural_ambiguity_is_topic_independent(self):
        self.assertIn('missing_specific_focus', s.ambiguity_signals('加值班制度'))
        self.assertIn('underspecified_action', s.ambiguity_signals('账号怎么处理？'))
        self.assertTrue(s.should_semantic_preprocess('出差住宿标准是多少？'))
        self.assertTrue(s.should_semantic_preprocess('加值班制度'))

    def test_preprocessor_preserves_numbers_and_question_constraints(self):
        class Model:
            async def async_chat(self, system, history, config):
                return json.dumps({'confidence': .95, 'corrected_question': '加班和值班制度',
                                   'intent_parts': ['加班', '值班'],
                                   'retrieval_queries': ['加班制度怎么规定', '值班制度怎么规定'],
                                   'ambiguity_score': .8, 'ambiguity_reasons': ['包含两个压缩事项']})
        result = asyncio.run(s.preprocess_question(Model(), '加值班制度', s.DEFAULTS))
        self.assertEqual(result['status'], 'success')
        self.assertIn('加班和值班制度', result['retrieval_queries'])
        self.assertEqual(result['retrieval_queries'][:3],
                         ['加值班制度', '加班制度怎么规定', '值班制度怎么规定'])
        self.assertEqual(result['intent_parts'], ['加班', '值班'])

        class UnsafeModel:
            async def async_chat(self, system, history, config):
                return json.dumps({'confidence': .95, 'corrected_question': '报销多久到账', 'retrieval_queries': ['报销多久到账']})
        result = asyncio.run(s.preprocess_question(UnsafeModel(), '2026年报销制度', s.DEFAULTS))
        self.assertEqual(result['normalized_question'], '2026年报销制度')

    def test_multiple_intents_must_all_have_verified_options(self):
        test = self
        class Model:
            cover_all = False
            async def async_chat(inner, system, messages, config):
                payload = json.loads(messages[0]['content'])
                test.assertEqual(payload['intent_parts'], ['差旅', '招待'])
                return json.dumps({'checks': [
                    dict(id=o['id'], supported=True, answer=o['evidence'][0]['content'],
                         evidence_quotes=[o['evidence'][0]['content']],
                         intent_indices=[i if inner.cover_all else 0])
                    for i, o in enumerate(payload['options'])]})
        model = Model()
        diagnostic = {}
        result = asyncio.run(s.verify_option_answers(model, '差旅和招待', self.options,
            self.chunks, s.DEFAULTS, diagnostic, ['差旅', '招待']))
        self.assertEqual(result, [])
        self.assertEqual(diagnostic['missing_intents'], ['招待'])
        model.cover_all = True
        result = asyncio.run(s.verify_option_answers(model, '差旅和招待', self.options,
            self.chunks, s.DEFAULTS, diagnostic, ['差旅', '招待']))
        self.assertEqual(len(result), 2)
        self.assertEqual(diagnostic['missing_intents'], [])

    def test_config_validation(self):
        with self.assertRaises(ValueError):
            s.save_config({'candidate_limit': 10000})
        with self.assertRaises(ValueError):
            s.save_config({'enabled': 'false'})
        self.assertEqual(s.save_config({'max_options': 5})['max_options'], 5)
        with self.assertRaises(ValueError):
            s.save_config({'max_options': 6})

    def test_fabricated_quotes_are_rejected(self):
        options = [self.options[0], dict(self.options[1], evidence_quotes=['未出现在原文中的规定'])]
        self.assertEqual(s.validate_options({'action': 'clarify', 'options': options}, self.chunks, 3), [])

    def test_preprocessing_timeout_falls_back_for_both_clear_and_broad_input(self):
        class Model:
            calls = 0
            async def async_chat(self, *args):
                self.calls += 1
                raise TimeoutError()
        model = Model()
        broad = asyncio.run(s.preprocess_question(model, '报销制度', s.DEFAULTS))
        self.assertEqual(broad['status'], 'fallback')
        self.assertEqual(broad['retrieval_queries'], ['报销制度'])
        clear = asyncio.run(s.preprocess_question(model, '住宿报销标准是多少？', s.DEFAULTS))
        self.assertEqual(clear['status'], 'fallback')
        self.assertEqual(model.calls, 2)

    def test_clear_typo_correction_and_uncertain_rewrite(self):
        class Model:
            confidence = .95
            async def async_chat(self, *args):
                return json.dumps({'confidence': self.confidence, 'corrected_question': '住宿报销标准是多少？',
                                   'retrieval_queries': ['住宿报销标准是多少？']})
        model = Model()
        result = asyncio.run(s.preprocess_question(model, '住宿报消标准是多少？', s.DEFAULTS))
        self.assertEqual(result['normalized_question'], '住宿报销标准是多少?')
        self.assertEqual(result['retrieval_queries'][0], '住宿报消标准是多少?')
        model.confidence = .5
        result = asyncio.run(s.preprocess_question(model, '住宿报消标准是多少？', s.DEFAULTS))
        self.assertEqual(result['retrieval_queries'], ['住宿报消标准是多少?'])

    def test_decision_parses_evidence_and_rejects_malformed(self):
        class Model:
            async def async_chat(self, system, history, config):
                if '证据审核器' in system:
                    options = json.loads(history[0]['content'])['options']
                    return json.dumps({'checks': [dict(id=o['id'], supported=True,
                        answer=o['evidence'][0]['content'], evidence_quotes=[o['evidence'][0]['content']])
                        for o in options]})
                return json.dumps({'action': 'clarify', 'options': self_options})
        self_options = self.options
        result = asyncio.run(s.decide_clarification(Model(), '报销标准', self.chunks, s.DEFAULTS))
        self.assertEqual(len(result), 2)
        self.assertTrue(all(o['answer_verified'] for o in result))

    def test_stream_final_event_contains_accumulated_diagnostics(self):
        async def implementation(dialog, messages, stream, **kwargs):
            state = kwargs['_optimization_state']
            state['candidates'] = self.chunks
            yield {'answer':'第一段', 'reference':{}, 'final':False}
            yield {'answer':'第二段', 'reference':{}, 'final':False}
            yield {'answer':'', 'reference':{}, 'final':True}
        async def run():
            with patch.object(s, 'authenticated_owner', return_value='alice'):
                return [item async for item in s.audit_chat(implementation, SimpleNamespace(tenant_id='alice'),
                    [{'role':'user','content':'问题'}], True, {'return_diagnostics':True})]
        items = asyncio.run(run())
        self.assertNotIn('diagnostics', items[0])
        self.assertEqual(items[-1]['diagnostics']['answer'], '第一段第二段')
        self.assertEqual(len(items[-1]['diagnostics']['retrieved_chunks']), 2)


if __name__ == '__main__':
    unittest.main()
