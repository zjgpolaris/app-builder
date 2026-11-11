import { expect, test } from '@playwright/test'

const prompt = '生成一个可以新增任务并勾选完成的待办清单'
const app = {
  title: '生成的待办应用',
  html: '<button id="add">新增任务</button><p id="result"></p>',
  css: '',
  js: `document.querySelector('#add').onclick = () => {
    let blocked = 0;
    try { void parent.document.body; } catch { blocked++; }
    try { void localStorage.length; } catch { blocked++; }
    document.querySelector('#result').textContent = blocked === 2 ? '任务已添加，宿主访问被隔离' : '任务已添加，隔离失败';
  }`,
}

test('generation renders an isolated interactive app and restores it after refresh', async ({ page }) => {
  let calls = 0
  await page.route('**/api/generate', async route => {
    calls += 1
    expect(route.request().postDataJSON()).toEqual({ prompt })
    await route.fulfill({ json: app })
  })
  await page.goto('/')
  await page.getByRole('textbox', { name: '应用需求' }).fill(prompt)
  await page.getByRole('button', { name: '生成应用' }).click()
  const preview = page.frameLocator('iframe[title="应用预览"]')
  await preview.getByRole('button', { name: '新增任务' }).click()
  await expect(preview.locator('#result')).toHaveText('任务已添加，宿主访问被隔离')
  await expect(page.getByText('已保存到此浏览器')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('textbox', { name: '应用需求' })).toHaveValue(prompt)
  await expect(preview.getByRole('button', { name: '新增任务' })).toBeVisible()
  expect(calls).toBe(1)
})

test('an in-flight request blocks duplicates and a failed replacement can be retried', async ({ page }) => {
  let calls = 0
  let releaseResponse!: () => void
  const holdFirstResponse = new Promise<void>(resolve => { releaseResponse = resolve })
  await page.route('**/api/generate', async route => {
    calls += 1
    if (calls === 1) await holdFirstResponse
    if (calls === 2) {
      await route.fulfill({ status: 502, json: { message: '服务暂时不可用' } })
      return
    }
    await route.fulfill({ json: app })
  })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '应用需求' })
  await input.fill(prompt)
  await page.getByRole('button', { name: '生成应用' }).click()
  await expect(page.getByRole('button', { name: '生成中' })).toBeDisabled()
  await expect.poll(() => calls).toBe(1)
  await input.press('Control+Enter')
  expect(calls).toBe(1)
  releaseResponse()
  await expect(page.getByText('已保存到此浏览器')).toBeVisible()
  await input.fill('生成一个计算支出总额的记账页')
  await page.getByRole('button', { name: '生成应用' }).click()
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用')
  await expect(page.frameLocator('iframe').getByRole('button', { name: '新增任务' })).toBeVisible()
  await page.getByRole('button', { name: '重试' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect.poll(() => calls).toBe(3)
})

test('a failed replacement leaves the last saved app available after reload', async ({ page }) => {
  await page.route('**/api/generate', async route => {
    if (route.request().postDataJSON().prompt === prompt) {
      await route.fulfill({ json: app })
    } else {
      await route.fulfill({ status: 502, json: { message: '服务暂时不可用' } })
    }
  })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '应用需求' })
  await input.fill(prompt)
  await page.getByRole('button', { name: '生成应用' }).click()
  await expect(page.getByText('已保存到此浏览器')).toBeVisible()
  await input.fill('做一个日历')
  await page.getByRole('button', { name: '生成应用' }).click()
  await expect(page.getByRole('alert')).toContainText('服务暂时不可用')
  await page.reload()
  await expect(input).toHaveValue(prompt)
  await expect(page.frameLocator('iframe').getByRole('button', { name: '新增任务' })).toBeVisible()
})

test('failed storage still leaves the preview usable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError') }
  })
  await page.route('**/api/generate', route => route.fulfill({ json: app }))
  await page.goto('/')
  await page.getByRole('textbox', { name: '应用需求' }).fill(prompt)
  await page.getByRole('button', { name: '生成应用' }).click()
  await expect(page.getByText('当前结果未保存，刷新后可能丢失')).toBeVisible()
  await expect(page.frameLocator('iframe').getByRole('button', { name: '新增任务' })).toBeVisible()
})

test('a preview runtime error is reported inside the workspace', async ({ page }) => {
  await page.route('**/api/generate', route => route.fulfill({
    json: { ...app, js: 'throw new Error("Preview fixture error")' },
  }))
  await page.goto('/')
  await page.getByRole('button', { name: '填入待办清单需求' }).click()
  await page.getByRole('button', { name: '生成应用' }).click()
  await expect(page.getByText('预览脚本遇到错误。可重新生成应用。')).toBeVisible()
})

test('the local HTTP route rejects empty prompts', async ({ request }) => {
  const response = await request.post('/api/generate', { data: { prompt: ' ' } })
  expect(response.status()).toBe(400)
  expect((await response.json()).code).toBe('INVALID_PROMPT')
})

test('the workbench fits a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: '生成应用' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '应用预览' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
})

test('built-in examples work offline and keep the generated project intact', async ({ page }) => {
  let calls = 0
  await page.route('**/api/generate', async route => {
    calls += 1
    await route.fulfill({ json: app })
  })
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '应用需求' })
  await input.fill(prompt)
  await page.getByRole('button', { name: '生成应用' }).click()
  await expect(page.getByText('已保存到此浏览器')).toBeVisible()
  await input.fill('另一个应用的需求')

  const preview = page.frameLocator('iframe[title="应用预览"]')
  await page.getByRole('button', { name: '试用待办清单' }).click()
  await expect(page.getByText('内置示例 · 无需 API 密钥')).toBeVisible()
  await preview.getByRole('textbox', { name: '任务名称' }).fill('准备笔试')
  await preview.getByRole('button', { name: '添加任务' }).click()
  await preview.getByRole('checkbox', { name: '准备笔试' }).check()

  await page.getByRole('button', { name: '试用支出记录' }).click()
  for (const [name, amount] of [['交通', '12'], ['咖啡', '8']]) {
    await preview.getByRole('textbox', { name: '支出名称' }).fill(name)
    await preview.getByRole('spinbutton', { name: '金额' }).fill(amount)
    await preview.getByRole('button', { name: '添加支出' }).click()
  }
  await expect(preview.locator('#total')).toHaveText('20.00')
  await expect(input).toHaveValue('另一个应用的需求')
  await page.getByRole('button', { name: '返回项目' }).click()
  await expect(preview.getByRole('button', { name: '新增任务' })).toBeVisible()
  await page.reload()
  await expect(input).toHaveValue(prompt)
  await expect(preview.getByRole('button', { name: '新增任务' })).toBeVisible()
  expect(calls).toBe(1)
})
