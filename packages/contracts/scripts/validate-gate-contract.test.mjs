import assert from 'node:assert/strict'
import test from 'node:test'

import { validateGateContract } from './validate-gate-contract.mjs'
const threads = new Set(['post', 'doc'])
const entry = (action, scope = 'community', requires = [], requires_thread = {}) => ({
  action,
  scope,
  grantable: true,
  owner_only: scope === 'article',
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
  assert.equal(all.get('article.read_draft').scope, 'article')
  assert.equal(all.get('article.read_draft').grantable, true)
  assert.equal(all.get('article.read_draft').owner_only, true)
  assert.equal(all.get('article.trash.read').grantable, false)
  assert.equal(all.get('article.trash.read').owner_only, true)
  assert.deepEqual(all.get('article.history.restore').requires, [
    'article.history.read',
    'article.update',
    'article.read_draft',
  ])
  assert.deepEqual(all.get('article.mirror').requires_thread, { doc: ['doc.queue.write'] })
  assert.deepEqual(all.get('community.article.hide').requires_thread, { doc: ['doc.queue.write'] })
  assert.deepEqual(all.get('community.article.hide').requires, ['community.article.trash.read'])
  assert.equal(all.get('community.article.hide').owner_only, false)
  assert.equal(all.get('article.author.manage').grantable, false)
  assert.equal(all.get('article.author.manage').owner_only, true)
  assert.equal(all.get('admin.invite').scope, 'community')
  assert.equal(all.get('admin.invite').grantable, false)
  assert.equal(all.has('doc.update'), false)
})

test('permission contract is the only source and contains no alias metadata protocol', async () => {
  const { readFile } = await import('node:fs/promises')
  const source = JSON.parse(
    await readFile(new URL('../gate.contract.json', import.meta.url), 'utf8'),
  )
  assert.deepEqual(Object.keys(source), ['permissions'])
  assert.ok(
    source.permissions.every(
      (permission) =>
        Object.keys(permission).sort().join(',') ===
        'action,grantable,owner_only,requires,requires_thread,scope',
    ),
  )
})

test('rejects malformed owner-only metadata', () => {
  const malformed = { ...entry('article.read_draft', 'article'), owner_only: 'true' }
  assert.throws(() => validation([malformed]), /metadata/)
})
