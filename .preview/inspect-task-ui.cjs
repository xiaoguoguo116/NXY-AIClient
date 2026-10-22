const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
 const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
 const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home/'));
 if (!page.url().includes('/home/ai')) await page.locator('[title="AI Work"]').evaluate(e => e.click());
 await page.getByRole('button', { name: '任务助手', exact: true }).click();
 await page.screenshot({ path: 'D:/ai/NXY-AIClient/.preview/task-ui-before.png' });
 console.log(await page.locator('.workbench button, .workbench .n-base-selection').evaluateAll(els => els.filter(e => e.getBoundingClientRect().width).map(e => ({text:e.textContent.trim(),cls:e.className,bg:getComputedStyle(e).backgroundColor}))));
 await browser.close();
})();
