// Real packaged application + configured model; synthetic documents only.
const { chromium } = require('C:/Users/94719/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const stamp = Date.now(), marker = `任务整合自测-${stamp}`
const output = path.resolve('.preview/office-verification', marker)
fs.mkdirSync(output, { recursive: true })
;(async () => {
  const browser = await chromium.connectOverCDP(process.env.TASK_TEST_CDP_URL || 'http://127.0.0.1:19224')
  const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url().includes('/home'))
  assert(page)
  let priorLocal, workspace
  const fileName = `task-workspace-test-${stamp}.txt`, content = `合成自测 ${stamp}：默认工作目录可用。`
  try {
    await page.evaluate(async () => { for (const action of ['unminimize', 'show', 'set_focus']) await window.__TAURI_INTERNALS__.invoke(`plugin:window|${action}`, { label: 'home' }) })
    assert(await page.locator('.workbench__stop').count() === 0, 'existing run must not be interrupted')
    if (await page.locator('.workbench__composer textarea').count()) assert.equal(await page.locator('.workbench__composer textarea').inputValue(), '')
    priorLocal = await page.evaluate(() => localStorage.getItem('workAssistant'))
    await page.evaluate(() => {
      const prior = JSON.parse(localStorage.getItem('workAssistant') || '{}')
      localStorage.setItem('workAssistant', JSON.stringify({ ...prior, scopeMode: 'chat', workspacePath: '' }))
    })
    await page.goto('http://tauri.localhost/home/ai?view=tasks')
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('workAssistant') || '{}').workspacePath, null, { polling: 100 })
    workspace = await page.locator('.workbench__workspace').getAttribute('title')
    assert.match(workspace, /work-assistant[\\/]workspace$/)
    assert(fs.statSync(workspace).isDirectory())
    assert.equal(await page.locator('.workbench__scope-switch').count(), 0)
    assert.equal(await page.locator('.workbench__quick-grid > button').count(), 4)
    assert.doesNotMatch(await page.locator('.ai-sections').innerText(), /知识问答|合规助手/)
    for (const oldView of ['knowledge', 'policy', 'report', 'review']) {
      await page.goto(`http://tauri.localhost/home/ai?view=${oldView}`)
      await page.waitForURL('**/home/ai?view=tasks')
      assert.equal(await page.locator('.compliance-workbench').count(), 0)
    }
    await page.locator('.workbench__composer textarea').fill('保留草稿自测')
    await page.locator('.workbench__nav').getByRole('button', { name: '制度比对', exact: true }).click()
    await page.getByRole('button', { name: '返回当前任务', exact: true }).click()
    await page.waitForURL('**/home/ai?view=tasks')
    assert.equal(await page.locator('.workbench__composer textarea').inputValue(), '保留草稿自测')
    await page.locator('.workbench__composer textarea').fill(`${marker}：请用文件工具在当前默认工作目录创建 ${fileName}，内容必须精确为“${content}”（不含引号），随后读回核对。不要读取其他文件，不要覆盖已有文件。`)
    await page.locator('.workbench__send').click()
    await page.locator('.workbench__stop').waitFor({ timeout: 15000 })
    const deadline = Date.now() + 180000
    let approvals = 0
    while (Date.now() < deadline) {
      const permission = page.locator('.work-permission')
      if (await permission.isVisible() && await permission.locator('.work-permission__main > strong').count()) {
        const heading = await permission.locator('.work-permission__main > strong').innerText()
        assert(heading.endsWith(fileName), `Unexpected write target: ${heading}`)
        await permission.locator('footer .n-button--primary-type').click()
        approvals++
        await page.waitForFunction(text => document.querySelector('.work-permission__main > strong')?.textContent !== text, heading, { polling: 100 })
      }
      if (await page.locator('.workbench__stop').count() === 0) break
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    assert(await page.locator('.workbench__stop').count() === 0, 'real-model task timed out')
    assert.deepEqual(await page.locator('.workbench__error-card').allTextContents(), [])
    assert.equal(fs.readFileSync(path.join(workspace, fileName), 'utf8'), content)
    await page.locator('.work-attachments__info strong').filter({ hasText: fileName }).waitFor()
    if (await page.getByRole('button', { name: '返回当前任务', exact: true }).isVisible()) await page.getByRole('button', { name: '返回当前任务', exact: true }).click()
    const layout = await page.locator('.workbench__chat').boundingBox()
    assert(layout.width > 300, 'long tool paths must not collapse the chat panel')
    const activity = await page.locator('.workbench__activity').boundingBox()
    if (activity) assert(activity.width <= 271, 'tool panel must stay within its allocated width')
    await page.screenshot({ path: path.join(output, 'default-workspace.png'), fullPage: true })
    await page.locator('.workbench__nav').getByRole('button', { name: '制度比对', exact: true }).click()
    const manage = page.getByRole('button', { name: /管理资料库/ })
    if (await manage.isVisible()) await manage.click()
    async function add(name, text) {
      await page.getByLabel('资料名称', { exact: true }).fill(name)
      await page.getByLabel('资料全文', { exact: true }).fill(text)
      await page.getByRole('button', { name: '保存资料到本机', exact: true }).click()
      await page.locator('.cw-library-item').filter({ hasText: name }).waitFor()
    }
    await add(`${marker}-旧版`, '第一条 本合成文件仅用于功能自测。\n\n第二条 记录保存3年。\n\n第三条 每季度检查。')
    await add(`${marker}-新版`, '第一条 本合成文件仅用于功能自测。\n\n第二条 记录保存5年。\n\n第三条 每月检查。\n\n第四条 新增整改记录。')
    await page.getByRole('button', { name: /收起资料库/ }).click()
    await page.locator('.document-diff').waitFor()
    assert.match((await page.locator('.diff-left mark').allTextContents()).join(''), /3/)
    assert.match((await page.locator('.diff-right mark').allTextContents()).join(''), /5/)
    await page.getByLabel('合规任务说明').fill(`${marker}：只比较这些合成文字，说明保存期限、检查频率及新增记录要求；输出修订草稿。`)
    await page.locator('.cw-consent input').check()
    await page.getByRole('button', { name: '开始分析', exact: true }).click()
    await page.locator('.cw-results .cw-finding').first().waitFor({ timeout: 180000 })
    assert.equal(await page.getByRole('alert').count(), 0)
    const resultText = await page.locator('.cw-results').innerText()
    assert.match(resultText, /5|五/)
    assert.match(resultText, /月/)
    await page.getByLabel('人工处理', { exact: true }).first().selectOption('已接受')
    await page.getByRole('button', { name: '保存审核与草稿', exact: true }).click()
    await page.reload()
    await page.locator('.cw-history').filter({ hasText: marker }).first().click()
    await page.locator('.document-diff').waitFor()
    assert.equal(await page.getByLabel('人工处理', { exact: true }).first().inputValue(), '已接受')
    assert.equal(await page.getByLabel('差异来源').inputValue(), 'result')
    await page.locator('.compliance-workbench').evaluate(el => el.scrollTop = 0)
    await page.screenshot({ path: path.join(output, 'desktop-diff.png'), fullPage: true })
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ status: 'passed', workspace, outputFile: fileName, approvals, defaultDirectoryRealWrite: true, removedRoutesRedirect: true, taskDraftPreservedOnCompareSwitch: true, realModelComparison: true, comparisonHistoryAndDiffPersist: true }, null, 2))
    console.log(`PASS: default workspace real file write, simplified navigation, retained task draft, real-model comparison and persistent diff/review. Evidence: ${output}`)
  } catch (e) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
    const reject = page.locator('.work-permission footer button').first()
    if (await reject.isVisible()) await reject.click().catch(() => {})
    if (await page.locator('.workbench__stop').count()) await page.locator('.workbench__stop').evaluate(el => el.click()).catch(() => {})
    throw e
  } finally {
    // Preserve an existing user-selected folder. First-use default remains default.
    if (priorLocal !== undefined) await page.evaluate(prior => {
      const current = JSON.parse(localStorage.getItem('workAssistant') || '{}')
      const previous = JSON.parse(prior || '{}')
      if (previous.workspacePath) current.workspacePath = previous.workspacePath
      current.scopeMode = 'workspace'
      localStorage.setItem('workAssistant', JSON.stringify(current))
    }, priorLocal)
    await browser.close()
  }
})().catch(e => { console.error(e); process.exitCode = 1 })
