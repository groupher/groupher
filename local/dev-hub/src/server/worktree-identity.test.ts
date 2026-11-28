import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { worktreeId } from './storage-paths.ts'
import { checkoutSlug, resolveCheckout } from './worktree-identity.ts'

test('Git checkout identity is stable through a symbolic link', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'groupher-identity-'))
  const root = path.join(base, 'groupher-feat test')
  const link = path.join(base, 'link')
  try {
    await mkdir(root)
    execFileSync('git', ['init', '-q', root])
    await symlink(root, link)
    const identity = await resolveCheckout(root)
    const linked = await resolveCheckout(link)
    assert.deepEqual(linked, identity)
    assert.equal(identity.root, await realpath(root))
    assert.equal(worktreeId(root), worktreeId(link))
    assert.equal(identity.worktreeId, worktreeId(root))
    assert.equal(identity.isMainWorktree, true)
    assert.equal(checkoutSlug(identity), 'feat-test')
    assert.equal(checkoutSlug(identity, true), `feat-test-${identity.worktreeId.slice(0, 8)}`)
  } finally {
    await rm(base, { recursive: true, force: true })
  }
})

test('checkout slug remains valid for non-ASCII names', () => {
  const identity = {
    root: '/repo/测试',
    commonDir: '/repo/.git',
    mainRoot: '/repo',
    isMainWorktree: false,
    worktreeId: '0123456789abcdef',
  }
  assert.equal(checkoutSlug(identity), 'worktree')
  assert.equal(checkoutSlug(identity, true), 'worktree-01234567')
})
