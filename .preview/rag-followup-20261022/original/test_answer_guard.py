import asyncio
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('guard', Path(__file__).parents[1] / 'api/db/services/answer_guard.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)
SOURCE = '普通短期病假每月不超过3个工作日、每年不超过24个工作日。超过任一额度转长期病假/医疗期核定，不是全年绝对上限。'
GOOD = SOURCE + '[ID:0]'


def verdict(consistent, answerable=True):
    return json.dumps(dict(consistent=consistent, answerable=answerable, reason='核对额度和例外',
        support=[dict(source_id=0, quote=SOURCE)] if answerable else []), ensure_ascii=False)


class Model:
    def __init__(self, responses):
        self.responses = iter(responses)
        self.calls = []

    async def async_chat(self, system, messages, config):
        self.calls.append((system, messages))
        value = next(self.responses)
        if isinstance(value, Exception):
            raise value
        return value


class GuardTests(unittest.TestCase):
    def run_guard(self, responses, draft='找不到病假天数规定'):
        model, diagnostic = Model(responses), {}
        result = asyncio.run(g.ensure_consistent_answer(model, '一年可以请多少病假', draft,
                            [SOURCE], diagnostic))
        return result, diagnostic, model

    def test_false_denial_is_regenerated_and_checked(self):
        result, diagnostic, model = self.run_guard([verdict(False), GOOD, verdict(True)])
        self.assertEqual(result, GOOD)
        self.assertEqual(diagnostic['status'], 'repaired')
        self.assertEqual(len(model.calls), 3)
        repair_payload = json.loads(model.calls[1][1][0]['content'])
        self.assertNotIn('draft', repair_payload)
        self.assertNotIn('history', repair_payload)

    def test_missing_exception_and_absolute_limit_require_repair(self):
        for draft in ['全年最多只能请24天病假', '每年36天病假', '每年24天，超额视为旷工']:
            result, diagnostic, _ = self.run_guard([verdict(False), GOOD, verdict(True)], draft)
            self.assertEqual(result, GOOD)
            self.assertTrue(diagnostic['regenerated'])

    def test_correct_answer_is_preserved(self):
        result, diagnostic, model = self.run_guard([verdict(True)], GOOD)
        self.assertEqual(result, GOOD)
        self.assertEqual(len(model.calls), 1)
        self.assertEqual(diagnostic['status'], 'passed')

    def test_genuine_missing_evidence_can_be_reported(self):
        result, diagnostic, _ = self.run_guard([verdict(True, False)], '本次资料没有说明所问的规定。')
        self.assertEqual(diagnostic['status'], 'passed')
        self.assertIn('没有说明', result)

    def test_failed_second_review_never_publishes_repair(self):
        result, diagnostic, _ = self.run_guard([verdict(False), '全年上限24天', verdict(False)])
        self.assertEqual(result, g.UNVERIFIED)
        self.assertEqual(diagnostic['status'], 'rejected')

    def test_timeout_bad_json_and_fake_quotes_fail_closed(self):
        fake = json.dumps(dict(consistent=True, answerable=True, support=[dict(source_id=0,quote='不存在的病假规定')]))
        for response in [TimeoutError(), 'not json', fake, json.dumps(dict(consistent=True,answerable=True,support=[]))]:
            result, diagnostic, _ = self.run_guard([response])
            self.assertEqual(result, g.UNVERIFIED)
            self.assertEqual(diagnostic['status'], 'unavailable')


if __name__ == '__main__':
    unittest.main()
