import assert from 'node:assert/strict'
import test from 'node:test'
import { createOpenAIModel } from '../server/openai.ts'
import { createGenerateHandler } from '../server/generate.ts'

const app = { title: '记账页', html: '<main>记账页</main>', css: '', js: '' }

test('provider sends the brief and extracts the structured message from Responses API', async () => {
  const signal = new AbortController().signal
  const model = createOpenAIModel({ apiKey: 'test-only-key' }, async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses')
    assert.equal(options?.signal, signal)
    const payload = JSON.parse(String(options?.body))
    assert.equal(payload.input, '制作记账页')
    assert.equal(payload.store, false)
    assert.equal(payload.text.format.type, 'json_schema')
    return Response.json({
      status: 'completed',
      output: [
        { type: 'reasoning' },
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(app) }] },
      ],
    })
  })
  assert.deepEqual(await model('制作记账页', signal), app)
})

test('the route reports a missing model key without making an upstream request', async () => {
  const generate = createGenerateHandler(createOpenAIModel({}, async () => {
    assert.fail('missing credentials must not call the provider')
  }))
  const response = await generate(new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: '制作记账页' }),
  }))
  assert.equal(response.status, 503)
  assert.equal((await response.json()).code, 'NOT_CONFIGURED')
})

test('Vercel gateway sends the project token and provider-qualified model to Responses API', async () => {
  const model = createOpenAIModel({ apiKey: 'test-project-token', gateway: true }, async (url, options) => {
    assert.equal(url, 'https://ai-gateway.vercel.sh/v1/responses')
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-project-token')
    const payload = JSON.parse(String(options?.body))
    assert.equal(payload.model, 'openai/gpt-5-mini')
    assert.equal(payload.text.format.type, 'json_schema')
    return Response.json({
      status: 'completed',
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(app) }] }],
    })
  })
  assert.deepEqual(await model('制作记账页', new AbortController().signal), app)
})
