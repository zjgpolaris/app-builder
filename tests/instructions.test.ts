import assert from 'node:assert/strict'
import test from 'node:test'
import { appInstructions } from '../server/instructions.ts'

test('generated stateful apps are instructed to restore and validate local data', () => {
  assert.match(appInstructions, /localStorage/)
  assert.match(appInstructions, /Save JSON after each change/)
  assert.match(appInstructions, /Parse stored JSON defensively/)
})
