import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from quart import g
from common import settings
# Loading the Quart app initializes doc engines; supply harmless local stubs.
with patch.object(settings, 'init_settings'), patch.object(settings, 'get_secret_key', return_value='isolated-test-secret'), patch.object(settings, 'decrypt_database_config', return_value={}):
    import api.apps as apps
from api.db.services import clarification_service as service


class ApiTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.env = patch.dict(os.environ, RAGFLOW_OPTIMIZATION_DB=self.directory.name + '/audit.sqlite3')
        self.env.start()
        self.client = apps.app.test_client()
        for owner in ['alice', 'bob']:
            service.save_record(dict(id=owner, owner=owner, question='test', created=1, status='answered', answer='test'))

    def tearDown(self):
        self.env.stop()
        self.directory.cleanup()

    async def test_unauthenticated_cannot_list_records(self):
        with patch.object(apps, '_load_user', return_value=None):
            response = await self.client.get('/api/v1/optimization/records')
            body = await response.get_json()
            self.assertTrue(response.status_code in (401,403) or body.get('code') in (401,403,100))

    async def test_owner_scope_and_admin_control(self):
        def alice(*args):
            g.user = SimpleNamespace(id='alice',is_superuser=False)
            return g.user
        with patch.object(apps, '_load_user', side_effect=alice):
            result = await (await self.client.get('/api/v1/optimization/records')).get_json()
            self.assertEqual(result['data']['total'], 1)
            result = await (await self.client.get('/api/v1/optimization/records/bob')).get_json()
            self.assertEqual(result['code'], 404)
            result = await (await self.client.put('/api/v1/optimization/config',json={'enabled':False})).get_json()
            self.assertEqual(result['code'], 403)
        def admin(*args):
            g.user = SimpleNamespace(id='admin',is_superuser=True)
            return g.user
        with patch.object(apps, '_load_user', side_effect=admin):
            result = await (await self.client.get('/api/v1/optimization/records')).get_json()
            self.assertEqual(result['data']['total'], 2)
            result = await (await self.client.put('/api/v1/optimization/config',json={'enabled':False})).get_json()
            self.assertEqual(result['code'],0)
            self.assertFalse(result['data']['config']['enabled'])


if __name__ == '__main__':
    unittest.main()
