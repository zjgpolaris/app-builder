import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const gamePrompt = '做一个2048游戏，支持方向键移动、相同数字合并、计分，刷新后保留进度。'

test('a generated 2048 game receives arrow keys and merges two tiles', async ({ page }) => {
  const app = JSON.parse(await readFile(new URL('./fixtures-2048.json', import.meta.url), 'utf8'))
  await page.route('**/api/generate', route => route.fulfill({ json: app }))
  await page.goto('/')
  await page.getByRole('textbox', { name: '应用需求' }).fill(gamePrompt)
  await page.getByRole('button', { name: '生成应用' }).click()
  const preview = page.frameLocator('iframe[title="应用预览"]')
  await expect(preview.locator('#grid .cell')).toHaveCount(16)
  await expect.poll(() => page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('app-builder:latest-project') || '{}')
    return !!localStorage.getItem(`app-builder:preview-data:${project.id}`)
  })).toBe(true)
  await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem('app-builder:latest-project') || '{}')
    const board = [[2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]
    localStorage.setItem(`app-builder:preview-data:${project.id}`, JSON.stringify({
      version: 1, data: { '2048_game_state': JSON.stringify({ board, score: 0, best: 0, isGameOver: false, hasWon: false }) },
    }))
  })
  await page.getByRole('button', { name: '重新加载预览' }).click()
  await expect(preview.locator('#grid .cell').filter({ hasText: '2' })).toHaveCount(2)
  await page.keyboard.press('ArrowLeft')
  await expect(preview.locator('#score')).toHaveText('4')
  await expect(preview.locator('#grid .cell[data-value="4"]')).toHaveCount(1)
  await page.getByRole('button', { name: '重新加载预览' }).click()
  await expect(preview.locator('#score')).toHaveText('4')
  await page.reload()
  await expect(preview.locator('#score')).toHaveText('4')
  await expect(page.locator('.preview-error')).toHaveCount(0)
})

test('a generated expense app adds 20 and 30, deletes a row, and restores state', async ({ page }) => {
  const app = JSON.parse(await readFile(new URL('./fixtures-expense.json', import.meta.url), 'utf8'))
  await page.route('**/api/generate', route => route.fulfill({ json: app }))
  await page.goto('/')
  await page.getByRole('textbox', { name: '应用需求' }).fill('做一个费用记录应用，输入名称和金额后能新增记录，显示总额，能删除单条记录；刷新后保留数据。')
  await page.getByRole('button', { name: '生成应用' }).click()
  const preview = page.frameLocator('iframe[title="应用预览"]')
  for (const [name, amount] of [['交通', '20'], ['午餐', '30']]) {
    await preview.getByRole('textbox', { name: '名称' }).fill(name)
    await preview.getByRole('spinbutton', { name: '金额（元）' }).fill(amount)
    await preview.getByRole('button', { name: '＋ 新增记录' }).click()
  }
  await expect(preview.locator('#totalDisplay')).toHaveText('¥50.00')
  await expect(preview.locator('.expense-item')).toHaveCount(2)
  await preview.getByRole('button', { name: /删除记录：交通/ }).click()
  await expect(preview.locator('#totalDisplay')).toHaveText('¥30.00')
  await expect(preview.locator('.expense-item')).toHaveCount(1)
  await page.getByRole('button', { name: '重新加载预览' }).click()
  await expect(preview.locator('#totalDisplay')).toHaveText('¥30.00')
  await page.reload()
  await expect(preview.locator('#totalDisplay')).toHaveText('¥30.00')
  await expect(page.locator('.preview-error')).toHaveCount(0)
})

test('the offline expense example supports add, delete, and restore', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '试用支出记录' }).click()
  const preview = page.frameLocator('iframe[title="应用预览"]')
  for (const [name, amount] of [['交通', '20'], ['午餐', '30']]) {
    await preview.getByRole('textbox', { name: '支出名称' }).fill(name)
    await preview.getByRole('spinbutton', { name: '金额' }).fill(amount)
    await preview.getByRole('button', { name: '添加支出' }).click()
  }
  await expect(preview.locator('#total')).toHaveText('50.00')
  await preview.getByRole('button', { name: '删除交通' }).click()
  await expect(preview.locator('#total')).toHaveText('30.00')
  await page.getByRole('button', { name: '重新加载预览' }).click()
  await expect(preview.locator('#total')).toHaveText('30.00')
  await page.reload()
  await page.getByRole('button', { name: '试用支出记录' }).click()
  await expect(preview.locator('#total')).toHaveText('30.00')
})
