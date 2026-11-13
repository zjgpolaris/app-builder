import assert from 'node:assert/strict'
import test from 'node:test'
import route from '../api/generate.ts'

const app = { title: '记账页', html: '<main>记账页</main>', css: '', js: '' }
const baseUrl = 'https://test-workspace.cn-beijing.maas.aliyuncs.com/compatible-mode/v1'

function request(ip: string) {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ prompt: '制作记账页' }),
  })
}

test('production routes configured generation to Qwen and validates its JSON', async t => {
  const originalEnv = process.env
  t.after(() => { process.env = originalEnv })
  process.env = { ...originalEnv, DASHSCOPE_API_KEY: 'test-dashscope-key', DASHSCOPE_BASE_URL: `${baseUrl}/`, OPENAI_API_KEY: 'test-openai-key' }

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
  assert.equal(body.model, 'qwen-plus')
  assert.equal(body.enable_thinking, false)
  assert.deepEqual(body.response_format, { type: 'json_object' })
  assert.match(body.messages[0].content, /JSON/)
  assert.deepEqual(body.messages[1], { role: 'user', content: '制作记账页' })

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
  assert.equal(upstream.mock.callCount(), 3)

  process.env.DASHSCOPE_BASE_URL = 'https://maas.aliyuncs.com.example.com/compatible-mode/v1'
  const invalidEndpoint = await route.fetch(request('192.0.2.5'))
  assert.equal(invalidEndpoint.status, 503)
  assert.equal((await invalidEndpoint.json()).code, 'INVALID_MODEL_CONFIG')
  assert.equal(upstream.mock.callCount(), 3)

  delete process.env.DASHSCOPE_API_KEY
  const missingKey = await route.fetch(request('192.0.2.5'))
  assert.equal(missingKey.status, 503)
  assert.equal((await missingKey.json()).code, 'NOT_CONFIGURED')
  assert.equal(upstream.mock.callCount(), 3)
})
