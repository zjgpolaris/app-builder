import assert from 'node:assert/strict'
import test from 'node:test'
import { generatedAppSchema } from '../src/contract.ts'
import { createOllamaModel } from '../server/ollama.ts'

const app = { title: '待办', html: '<main>待办</main>', css: '', js: '' }
const signal = new AbortController().signal

test('local Ollama requests structured app code without an API key', async () => {
  const model = createOllamaModel('qwen2.5-coder:3b', async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:11434/api/chat')
    assert.equal(options?.signal, signal)
    const request = JSON.parse(String(options?.body))
    assert.equal(request.model, 'qwen2.5-coder:3b')
    assert.equal(request.stream, false)
    assert.deepEqual(request.format, generatedAppSchema)
    assert.deepEqual(request.messages.at(-1), { role: 'user', content: '做一个待办清单' })
    return Response.json({ done: true, message: { content: JSON.stringify(app) } })
  })
  assert.deepEqual(await model('做一个待办清单', signal), app)
})

test('a missing local model gives an actionable error', async () => {
  const model = createOllamaModel('qwen2.5-coder:3b', async () => new Response(null, { status: 404 }))
  await assert.rejects(model('做一个待办清单', signal), { code: 'LOCAL_MODEL_MISSING', status: 503 })
})

test('a truncated model response is rejected', async () => {
  const model = createOllamaModel('qwen2.5-coder:3b', async () => Response.json({
    done: true, done_reason: 'length', message: { content: JSON.stringify(app) },
  }))
  await assert.rejects(model('做一个待办清单', signal), { code: 'INVALID_OUTPUT', status: 502 })
})

test('malformed JavaScript gets one repair pass without changing the markup', async () => {
  let calls = 0
  const model = createOllamaModel('qwen2.5-coder:3b', async (_url, options) => {
    calls += 1
    if (calls === 1) {
      return Response.json({ done: true, message: { content: JSON.stringify({ ...app, js: 'function add() {' }) } })
    }
    const payload = JSON.parse(String(options?.body))
    const repair = JSON.parse(payload.messages.at(-1).content)
    assert.equal(repair.js, 'function add() {')
    assert.match(repair.error, /Unexpected end/)
    assert.deepEqual(payload.format.required, ['js'])
    return Response.json({ done: true, message: { content: JSON.stringify({ js: 'function add() {}' }) } })
  })
  assert.deepEqual(await model('做一个待办清单', signal), { ...app, js: 'function add() {}' })
  assert.equal(calls, 2)
})
