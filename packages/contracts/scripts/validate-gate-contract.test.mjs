import assert from 'node:assert/strict'
import test from 'node:test'

import { validateGateContract } from './validate-gate-contract.mjs'
const threads = new Set(['post', 'doc'])
const entry = (action, scope = 'community', requires = [], requires_thread = {}) => ({
  action,
  scope,
  grantable: true,
  requires,
  requires_thread,
})
const validation = (entries) => validateGateContract({ permissions: entries }, threads)
test('validates static and thread dependencies in the same scope', () => {
  const entries = [
    entry('doc.queue.write'),
    entry('article.mirror', 'community', [], { doc: ['doc.queue.write'] }),
  ]
  assert.equal(validation(entries).length, 2)
  assert.throws(
    () =>
      validation([
        entries[0],
        entry('article.mirror', 'community', [], { bogus: ['doc.queue.write'] }),
      ]),
    /thread/,
  )
  assert.throws(() => validation([entry('doc.queue.write', 'global'), entries[1]]), /dependency/)
  assert.throws(
    () => validation([entry('article.mirror', 'community', [], { doc: ['doc.queue.write'] })]),
    /dependency/,
  )
})
test('rejects aliases, malformed entries, generated name collisions and cycles', () => {
  assert.throws(
    () => validateGateContract({ permissions: [], grantAliases: {} }, threads),
    /array only/,
  )
  assert.throws(
    () => validation([entry('post.update'), entry('post_update.x'), entry('post.update')]),
    /duplicate/,
  )
  assert.throws(() => validation([entry('a.b_c'), entry('a_b.c')]), /duplicate/)
  assert.throws(
    () =>
      validation([entry('a.one', 'community', ['a.two']), entry('a.two', 'community', ['a.one'])]),
    /cycle/,
  )
})

test('Article and Doc permissions retain their required scopes and dependencies', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = JSON.parse(
    await readFile(new URL('../gate.contract.json', import.meta.url), 'utf8'),
  )
  const all = new Map(
    validateGateContract(source, new Set(['post', 'blog', 'changelog', 'doc'])).map((item) => [
      item.action,
      item,
    ]),
  )
  assert.equal(all.get('article.mirror').scope, 'community')
  assert.deepEqual(all.get('article.history.restore').requires, [
    'article.history.read',
    'article.update',
    'article.read_draft',
  ])
  assert.deepEqual(all.get('community.article.hide').requires_thread, { doc: ['doc.queue.write'] })
  assert.equal(all.get('article.author.manage').grantable, false)
  assert.equal(all.has('doc.update'), false)
})
