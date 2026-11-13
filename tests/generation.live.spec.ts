import { expect, test } from '@playwright/test'
import { isGeneratedApp } from '../src/contract.ts'

test('an anonymous visitor can generate and operate two apps and restore the last project', async ({ page }) => {
  const expensePrompt = '生成一个中文单页记账应用。用可访问标签「支出名称」和「金额」标记两个输入框，金额输入使用 number 类型。点击「添加支出」后展示每条记录，并显示包含「总额」和金额数字的文字。无需联网。'
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '应用需求' })
  const preview = page.frameLocator('iframe[title="应用预览"]')

  const generate = async (prompt: string) => {
    await input.fill(prompt)
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/generate'
        && response.request().method() === 'POST', { timeout: 70_000 }),
      page.getByRole('button', { name: '生成应用', exact: true }).click(),
    ])
    const body: unknown = await response.json()
    expect(response.ok(), `生成接口返回 HTTP ${response.status()}：${JSON.stringify(body).slice(0, 200)}`).toBe(true)
    expect(isGeneratedApp(body)).toBe(true)
    await expect(page.getByText('已保存需求和应用代码')).toBeVisible()
    return body
  }

  const todo = await generate('制作中文待办清单。输入框 aria-label=任务名称，添加任务按钮。点击按钮在 ul 新增 li；每项是一个 label，内含复选框和用户输入的任务名称。')
  await preview.getByRole('textbox', { name: '任务名称', exact: true }).fill('准备笔试')
  await preview.getByRole('button', { name: '添加任务', exact: true }).press('Enter')
  const task = preview.getByRole('checkbox', { name: '准备笔试', exact: true })
  await task.check()
  await expect(task).toBeChecked()

  const expenses = await generate(expensePrompt)
  expect(expenses).not.toEqual(todo)
  for (const [name, amount] of [['交通', '12'], ['咖啡', '8']]) {
    await preview.getByRole('textbox', { name: /^支出名称\s*[:：]?$/ }).fill(name)
    await preview.getByRole('spinbutton', { name: /^金额\s*[:：]?$/ }).fill(amount)
    await preview.getByRole('button', { name: '添加支出', exact: true }).press('Enter')
  }
  await expect(preview.getByText('交通', { exact: false }).first()).toBeVisible()
  await expect(preview.getByText('咖啡', { exact: false }).first()).toBeVisible()
  await expect.poll(() => preview.locator('body').innerText()).toMatch(/总额[^\d]*20(?:[.,]00)?\b/)

  await page.reload()
  await expect(input).toHaveValue(expensePrompt)
  await expect(preview.getByRole('textbox', { name: /^支出名称\s*[:：]?$/ })).toBeVisible()
})
