import assert from 'node:assert/strict'
import test from 'node:test'
import { applyPreviewOperation, readPreviewData, PREVIEW_DATA_PREFIX } from '../src/preview-data.ts'

function storage(fail = false) {
  const records = new Map<string, string>()
  globalThis.localStorage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { if (fail) throw new Error('quota'); records.set(key, value) },
  } as Storage
  return records
}

test('preview data is isolated by namespace and accepts only string values', () => {
  storage()
  assert.ok(applyPreviewOperation('a', { operation: 'set', key: 'task', value: 'done' }))
  assert.deepEqual(readPreviewData('a'), { task: 'done' })
  assert.deepEqual(readPreviewData('b'), {})
  assert.equal(applyPreviewOperation('a', { operation: 'set', key: 'bad', value: 123 }), false)
  assert.deepEqual(readPreviewData('a'), { task: 'done' })
  assert.ok(applyPreviewOperation('a', { operation: 'remove', key: 'task' }))
  assert.deepEqual(readPreviewData('a'), {})
})

test('corrupt records and failed writes safely fall back', () => {
  const records = storage()
  records.set(PREVIEW_DATA_PREFIX + 'a', '{broken')
  assert.deepEqual(readPreviewData('a'), {})
  records.set(PREVIEW_DATA_PREFIX + 'a', JSON.stringify({ version: 1, data: { x: 3 } }))
  assert.deepEqual(readPreviewData('a'), {})
  storage(true)
  assert.equal(applyPreviewOperation('a', { operation: 'set', key: 'x', value: '1' }), false)
})

test('oversized writes do not replace existing data', () => {
  storage()
  assert.ok(applyPreviewOperation('a', { operation: 'set', key: 'x', value: '1' }))
  assert.equal(applyPreviewOperation('a', { operation: 'set', key: 'x', value: 'a'.repeat(70_000) }), false)
  assert.deepEqual(readPreviewData('a'), { x: '1' })
})
