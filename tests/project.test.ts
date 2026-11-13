import assert from 'node:assert/strict'
import test from 'node:test'
import { createProject, PROJECT_KEY, readProject, saveProject } from '../src/project.ts'

const app = { title: '待办', html: '<main>待办</main>', css: '', js: '' }

function storage() {
  const records = new Map<string, string>()
  globalThis.localStorage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value) },
  } as Storage
  return records
}

test('legacy project migrates to a stable version 2 identity', () => {
  const records = storage()
  records.set(PROJECT_KEY, JSON.stringify({ version: 1, prompt: '待办', app, savedAt: 1 }))
  const first = readProject()
  assert.equal(first?.version, 2)
  assert.ok(first?.id)
  assert.equal(readProject()?.id, first.id)
  assert.equal(JSON.parse(records.get(PROJECT_KEY)!).id, first.id)
})

test('new projects have independent identities while revisions retain identity', () => {
  storage()
  const first = createProject('待办', app)
  const second = createProject('记账', app)
  assert.notEqual(first.id, second.id)
  assert.ok(saveProject(first))
  assert.equal(readProject()?.id, first.id)
  const revision = createProject(first.prompt, app, first)
  assert.equal(revision.id, first.id)
})
