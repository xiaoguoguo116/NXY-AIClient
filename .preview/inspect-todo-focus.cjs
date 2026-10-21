const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:19224');
  try {
    const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'));
    await page.goto('http://tauri.localhost/home/todos');
    await page.getByRole('button', { name: '新建待办', exact: true }).click();
    const input = page.getByLabel('待办事项内容', { exact: true });
    await input.waitFor();
    await page.evaluate(() => {
      window.focusTrace = [];
      for (const name of ['focusin','focusout','pointerdown','keydown','input']) document.addEventListener(name, e => {
        window.focusTrace.push({event:name, target:e.target.tagName, label:e.target.getAttribute('aria-label'), cls:e.target.className, prevented:e.defaultPrevented});
      }, true);
    });
    await input.click();
    await page.keyboard.type('keyboard-todo-test');
    console.log(JSON.stringify(await input.evaluate(el => ({
      value:el.value, disabled:el.matches(':disabled'), focus:document.activeElement?.outerHTML.slice(0,600),
      elementAtPoint:(() => {const r=el.getBoundingClientRect(); return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,500)})(), trace:window.focusTrace
    })),null,2));
    if (await input.inputValue() === 'keyboard-todo-test') await input.fill('');
  } finally { await browser.close(); }
})().catch(e => {console.error(e.message);process.exitCode=1;});
