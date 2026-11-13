import assert from 'node:assert/strict'
import test from 'node:test'
import { createGenerateHandler } from '../server/generate.ts'
import { createRateLimiter } from '../server/rate-limit.ts'

const app = { title: '待办清单', html: '<button>添加</button>', css: '', js: 'void 0' }
const request = (prompt: string, currentApp?: unknown) => new Request('http://localhost/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, currentApp }),
})

test('revision accepts an existing app larger than the original prompt body limit', async () => {
  const currentApp = { ...app, css: ' '.repeat(20_000) }
  const handler = createGenerateHandler(async (prompt, _signal, existing) => {
    assert.equal(prompt, '增加筛选')
    assert.deepEqual(existing, currentApp)
    return app
  })
  assert.equal((await handler(request(' 增加筛选 ', currentApp))).status, 200)
})

test('invalid revision context is rejected before contacting the model', async () => {
  const handler = createGenerateHandler(async () => assert.fail('model must not be called'))
  const response = await handler(request('增加筛选', { title: '缺少代码' }))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'INVALID_CURRENT_APP')
})

test('a revision with invalid JavaScript cannot replace the current version', async () => {
  const handler = createGenerateHandler(async () => ({ ...app, js: 'const = ;' }))
  const response = await handler(request('增加筛选', app))
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'INVALID_OUTPUT')
})

test('an initial generation with invalid JavaScript is rejected', async () => {
  const handler = createGenerateHandler(async () => ({ ...app, js: 'const = ;' }))
  const response = await handler(request('制作坦克大战'))
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'INVALID_OUTPUT')
})

test('blank prompts do not call the model', async () => {
  const handler = createGenerateHandler(async () => {
    assert.fail('model must not be called')
  })
  const response = await handler(request('  '))
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'INVALID_PROMPT')
})

test('valid model output is returned as an app', async () => {
  const handler = createGenerateHandler(async (prompt) => {
    assert.equal(prompt, '制作待办应用')
    return app
  })
  const response = await handler(request(' 制作待办应用 '))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), app)
})

test('invalid model output is rejected', async () => {
  const handler = createGenerateHandler(async () => ({ title: '空应用' }))
  const response = await handler(request('制作待办应用'))
  assert.equal(response.status, 502)
  assert.equal((await response.json()).code, 'INVALID_OUTPUT')
})

test('a timed-out call ends even if the model ignores cancellation', async () => {
  const handler = createGenerateHandler(() => new Promise(() => {}), { timeoutMs: 10 })
  const response = await handler(request('制作待办应用'))
  assert.equal(response.status, 504)
  assert.equal((await response.json()).code, 'TIMEOUT')
})

test('rate limiting rejects excess requests before calling the model', async () => {
  let calls = 0
  const handler = createGenerateHandler(async () => {
    calls += 1
    return app
  }, { allow: createRateLimiter(1, 60_000) })
  assert.equal((await handler(request('第一个应用'))).status, 200)
  assert.equal((await handler(request('第二个应用'))).status, 429)
  assert.equal(calls, 1)
})
