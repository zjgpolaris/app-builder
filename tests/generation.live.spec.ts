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
    await expect(page.getByText('已保存到此浏览器')).toBeVisible()
    return body
  }

  const todo = await generate('生成一个中文待办清单。用可访问标签「任务名称」标记输入框。点击「添加任务」后在列表中显示任务，每条任务有可勾选完成的复选框，用任务名称标记复选框。无需联网。')
  await preview.getByRole('textbox', { name: '任务名称', exact: true }).fill('准备笔试')
  await preview.getByRole('button', { name: '添加任务', exact: true }).click()
  const task = preview.getByRole('checkbox', { name: '准备笔试', exact: true })
  await task.check()
  await expect(task).toBeChecked()

  const expenses = await generate(expensePrompt)
  expect(expenses).not.toEqual(todo)
  for (const [name, amount] of [['交通', '12'], ['咖啡', '8']]) {
    await preview.getByRole('textbox', { name: '支出名称', exact: true }).fill(name)
    await preview.getByRole('spinbutton', { name: '金额', exact: true }).fill(amount)
    await preview.getByRole('button', { name: '添加支出', exact: true }).click()
  }
  await expect(preview.getByText('交通', { exact: false }).first()).toBeVisible()
  await expect(preview.getByText('咖啡', { exact: false }).first()).toBeVisible()
  await expect.poll(() => preview.locator('body').innerText()).toMatch(/总额[^\d]*20(?:[.,]00)?\b/)

  await page.reload()
  await expect(input).toHaveValue(expensePrompt)
  await expect(preview.getByRole('textbox', { name: '支出名称', exact: true })).toBeVisible()
})
