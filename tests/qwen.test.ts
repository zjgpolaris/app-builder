import assert from 'node:assert/strict'
import test from 'node:test'
import route from '../api/generate.ts'
import { configuredQwenModel } from '../server/qwen.ts'

const app = { title: '记账页', html: '<main>记账页</main>', css: '', js: '' }
const baseUrl = 'https://test-workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'

function request(ip: string, currentApp?: typeof app) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-vercel-forwarded-for': ip },
    body: JSON.stringify({ prompt: currentApp ? '添加分类' : '制作记账页', currentApp }),
  })
}

test('production routes configured generation to Qwen and validates its JSON', async t => {
  const originalEnv = process.env
  t.after(() => { process.env = originalEnv })
  process.env = { ...originalEnv, VERCEL: '1', DASHSCOPE_API_KEY: 'test-dashscope-key', DASHSCOPE_BASE_URL: `${baseUrl}/`, OPENAI_API_KEY: 'test-openai-key' }

  const upstream = t.mock.method(globalThis, 'fetch', async () => Response.json({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(app) } }],
  }))
  const response = await route.fetch(request('192.0.2.5'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), app)
  assert.equal(upstream.mock.callCount(), 1)
  const [url, options] = upstream.mock.calls[0].arguments as unknown as [URL, RequestInit]
  assert.equal(String(url), `${baseUrl}/chat/completions`)
  assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer test-dashscope-key')
  const body = JSON.parse(String(options.body))
  assert.equal(body.model, 'qwen3.8-flash')
  assert.equal(body.enable_thinking, false)
  assert.deepEqual(body.response_format, { type: 'json_object' })
  assert.match(body.messages[0].content, /JSON/)
  assert.deepEqual(body.messages[1], { role: 'user', content: '制作记账页' })

  process.env.DASHSCOPE_MODEL = 'qwen-custom-model'
  const overridden = await route.fetch(request('192.0.2.7'))
  assert.equal(overridden.status, 200)
  const overriddenOptions = (upstream.mock.calls[1].arguments as unknown as [URL, RequestInit])[1]
  const overriddenBody = JSON.parse(String(overriddenOptions.body))
  assert.equal(overriddenBody.model, 'qwen-custom-model')
  delete process.env.DASHSCOPE_MODEL

  const revision = await route.fetch(request('192.0.2.6', app))
  assert.equal(revision.status, 200)
  const revisionOptions = (upstream.mock.calls[2].arguments as unknown as [URL, RequestInit])[1]
  const revisionBody = JSON.parse(String(revisionOptions.body))
  assert.deepEqual(JSON.parse(revisionBody.messages[1].content), { change: '添加分类', currentApp: app })

  upstream.mock.mockImplementation(async () => Response.json({
    choices: [{ finish_reason: 'length', message: { content: JSON.stringify(app) } }],
  }))
  const truncated = await route.fetch(request('192.0.2.5'))
  assert.equal(truncated.status, 502)
  assert.equal((await truncated.json()).code, 'INVALID_OUTPUT')

  upstream.mock.mockImplementation(async () => new Response(null, { status: 429 }))
  const limited = await route.fetch(request('192.0.2.5'))
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).code, 'RATE_LIMITED')
  assert.equal(upstream.mock.callCount(), 5)

  process.env.DASHSCOPE_BASE_URL = 'https://maas.aliyuncs.com.example.com/compatible-mode/v1'
  const invalidEndpoint = await route.fetch(request('192.0.2.5'))
  assert.equal(invalidEndpoint.status, 503)
  assert.equal((await invalidEndpoint.json()).code, 'INVALID_MODEL_CONFIG')
  assert.equal(upstream.mock.callCount(), 5)

  delete process.env.DASHSCOPE_API_KEY
  const missingKey = await route.fetch(request('192.0.2.5'))
  assert.equal(missingKey.status, 503)
  assert.equal((await missingKey.json()).code, 'NOT_CONFIGURED')
  assert.equal(upstream.mock.callCount(), 5)
})

test('Qwen repairs malformed JavaScript once before returning the app', async () => {
  const broken = { ...app, js: 'const = ;' }
  const repaired = { ...app, js: 'document.body.dataset.ready = "true"' }
  const requests: Record<string, unknown>[] = []
  const responses = [broken, repaired]
  const model = configuredQwenModel({
    DASHSCOPE_API_KEY: 'test-key',
    DASHSCOPE_BASE_URL: baseUrl,
  }, async (_url, options) => {
    requests.push(JSON.parse(String(options?.body)))
    return Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(responses.shift()) } }],
    })
  })

  assert.ok(model)
  assert.deepEqual(await model('制作坦克大战', new AbortController().signal), repaired)
  assert.equal(requests.length, 2)
  const repairInput = JSON.parse(String((requests[1].messages as { content: string }[])[1].content))
  assert.equal(repairInput.app.js, broken.js)
  assert.match(repairInput.error, /Unexpected token/)
})
