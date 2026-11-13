import { expect, test } from '@playwright/test'
import { isGeneratedApp } from '../src/contract.ts'

test('an anonymous visitor can generate and operate two apps and restore the last project', async ({ page }) => {
  const expensePrompt = '生成一个中文单页记账应用。用可访问标签「支出名称」和「金额」标记两个输入框，金额输入使用 number 类型。点击「添加支出」后展示每条记录，并显示包含「总额」和金额数字的文字。每次录入后用 localStorage 保存支出数组，页面重新加载时恢复记录及总额；解析损坏数据时回退为空数组。无需联网。'
  await page.goto('/')
  const input = page.getByRole('textbox', { name: '应用需求' })
  const preview = page.frameLocator('iframe[title="应用预览"]')

  const generate = async (prompt: string) => {
    await input.fill(prompt)
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const [response] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).pathname === '/api/generate'
          && response.request().method() === 'POST', { timeout: 110_000 }),
        page.getByRole('button', { name: '生成应用', exact: true }).click(),
      ])
      const body: unknown = await response.json()
      if (!response.ok() && response.status() === 502 && attempt < 3) continue
      expect(response.ok(), `生成接口返回 HTTP ${response.status()}：${JSON.stringify(body).slice(0, 200)}`).toBe(true)
      expect(isGeneratedApp(body)).toBe(true)
      await expect(page.getByText('已保存需求和应用代码')).toBeVisible()
      return body
    }
    throw new Error('三次生成均未返回应用')
  }

  const todoPrompt = '制作中文待办清单。输入框 aria-label=任务名称，添加任务按钮。点击按钮在 ul 新增 li；每项是一个 label，内含复选框和用户输入的任务名称。新增和勾选后用 localStorage 保存任务数组；页面重新加载时恢复任务及勾选状态，损坏数据回退为空数组。'
  const todo = await generate(todoPrompt)
  await preview.getByRole('textbox', { name: '任务名称', exact: true }).fill('准备笔试')
  await preview.getByRole('button', { name: '添加任务', exact: true }).press('Enter')
  const task = preview.getByRole('checkbox', { name: /准备笔试/ })
  await task.click()
  await expect(task).toBeChecked()
  await page.getByRole('button', { name: '重新加载预览' }).click()
  await expect(preview.getByRole('checkbox', { name: /准备笔试/ })).toBeChecked()

  const expenses = await generate(expensePrompt)
  expect(expenses).not.toEqual(todo)
  for (const [name, amount] of [['交通', '12'], ['咖啡', '8']]) {
    await preview.getByRole('textbox', { name: /^支出名称\s*[:：]?$/ }).fill(name)
    await preview.getByRole('spinbutton', { name: /^金额(?:（元）)?\s*[:：]?$/ }).fill(amount)
    await preview.getByRole('button', { name: '添加支出', exact: true }).press('Enter')
  }
  await expect(preview.getByText('交通', { exact: false }).first()).toBeVisible()
  await expect(preview.getByText('咖啡', { exact: false }).first()).toBeVisible()
  await expect.poll(() => preview.locator('body').innerText()).toMatch(/总额[^\d]*20(?:[.,]00)?\b/)

  await page.reload()
  await expect(input).toHaveValue(expensePrompt)
  await expect(preview.getByRole('textbox', { name: /^支出名称\s*[:：]?$/ })).toBeVisible()
  await expect(preview.getByText('交通', { exact: false }).first()).toBeVisible()
  await expect.poll(() => preview.locator('body').innerText()).toMatch(/总额[^\d]*20(?:[.,]00)?\b/)
})

test('a generated 2048 game moves, merges, scores, and restores progress', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: '应用需求' }).fill('做一个2048游戏，支持方向键移动、相同数字合并、计分，刷新后保留进度。棋盘容器 id 为 grid，每个格子 class 为 cell，当前分数 id 为 score。')
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/generate'
      && response.request().method() === 'POST', { timeout: 110_000 }),
    page.getByRole('button', { name: '生成应用', exact: true }).click(),
  ])
  const body: unknown = await response.json()
  expect(response.ok(), `生成接口返回 HTTP ${response.status()}：${JSON.stringify(body).slice(0, 200)}`).toBe(true)
  expect(isGeneratedApp(body)).toBe(true)

  const preview = page.frameLocator('iframe[title="应用预览"]')
  await expect(preview.locator('#grid .cell')).toHaveCount(16)
  const initialBoard = await preview.locator('#grid').innerText()
  let score = 0
  for (let turn = 0; turn < 32 && score === 0; turn += 1) {
    await page.keyboard.press(['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'][turn % 4])
    score = Number((await preview.locator('#score').innerText()).replace(/[^\d]/g, '')) || 0
  }
  expect(await preview.locator('#grid').innerText()).not.toBe(initialBoard)
  expect(score).toBeGreaterThan(0)
  await page.getByRole('button', { name: '重新加载预览' }).click()
  await expect(preview.locator('#score')).toContainText(String(score))
  await page.reload()
  await expect(preview.locator('#score')).toContainText(String(score))
  await expect(page.locator('.preview-error')).toHaveCount(0)
})

test('a generated expense app adds 20 and 30, deletes, and restores the remainder', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: '应用需求' }).fill('做一个中文费用记录应用：有标为「支出名称」和「金额」的输入框、「添加支出」按钮，每条记录有 aria-label 为「删除」加该记录名称的按钮，总额显示在 id=total 的元素中。添加 20 和 30 后应显示 50，删除 20 后显示 30；用 localStorage 保存并在刷新后恢复。')
  const [response] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/generate'
      && response.request().method() === 'POST', { timeout: 110_000 }),
    page.getByRole('button', { name: '生成应用', exact: true }).click(),
  ])
  const body: unknown = await response.json()
  expect(response.ok(), `生成接口返回 HTTP ${response.status()}：${JSON.stringify(body).slice(0, 200)}`).toBe(true)
  expect(isGeneratedApp(body)).toBe(true)
  const preview = page.frameLocator('iframe[title="应用预览"]')
  for (const [name, amount] of [['交通', '20'], ['午餐', '30']]) {
    await preview.getByRole('textbox', { name: /支出名称/ }).fill(name)
    await preview.getByRole('spinbutton', { name: /金额/ }).fill(amount)
    await preview.getByRole('button', { name: /添加支出/ }).click()
  }
  await expect(preview.locator('#total')).toContainText(/50(?:[.,]00)?/)
  await preview.getByRole('button', { name: /删除.*交通/ }).click()
  await expect(preview.locator('#total')).toContainText(/30(?:[.,]00)?/)
  await page.getByRole('button', { name: '重新加载预览' }).click()
  await expect(preview.locator('#total')).toContainText(/30(?:[.,]00)?/)
  await page.reload()
  await expect(preview.locator('#total')).toContainText(/30(?:[.,]00)?/)
  await expect(page.locator('.preview-error')).toHaveCount(0)
})
