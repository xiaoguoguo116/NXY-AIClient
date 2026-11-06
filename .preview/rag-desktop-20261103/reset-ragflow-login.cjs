const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const email = '947191670@qq.com';
  const password = 'Rg!' + crypto.randomBytes(12).toString('base64url');
  const code = `import base64,json,sys,logging
logging.disable(logging.CRITICAL)
sys.path.insert(0, '/ragflow')
request=json.load(sys.stdin)
assert request['email']=='947191670@qq.com'
from common import settings
settings.init_settings()
from api.db.services.user_service import UserService
users=UserService.query_user_by_email(request['email'])
assert len(users)==1, 'Expected exactly one existing user'
user=users[0]
assert not user.is_superuser, 'Unexpected administrator account'
encoded=base64.b64encode(request['password'].encode('utf-8')).decode('ascii')
UserService.update_user_password(user.id,encoded)
assert UserService.query_user(request['email'],encoded), 'Password verification failed'
print(json.dumps({'updated':True,'email':request['email']}))
`;
  const reset = spawnSync('docker', ['exec', '-i', 'ragflow-ragflow-cpu-1', '/ragflow/.venv/bin/python', '-c', code], {
    input: JSON.stringify({ email, password }), encoding: 'utf8', timeout: 90000, windowsHide: true
  });
  if (reset.status !== 0) throw new Error('Password update failed: ' + (reset.stderr || reset.error?.message || '').slice(-1200));
  console.log(JSON.stringify({ email, newPassword: password, reset: 'verified' }));
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19226', { timeout: 15000 });
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('172.23.123.118'));
    if (!page) throw new Error('Prepared RAGFlow login page unavailable');
    page.setDefaultTimeout(20000);
    if (!page.url().includes('/login')) await page.goto('http://172.23.123.118/login');
    await page.locator('input[name=email]:visible').first().fill(email);
    await page.locator('input[name=password]:visible').first().fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).filter({ visible: true }).first().click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30000 });
    await page.waitForLoadState('domcontentloaded');
    await page.bringToFront();
    console.log(JSON.stringify({ login: 'success', url: page.url(), title: await page.title() }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
