import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  userDataBase,
  userDataRoot,
  workerRoot,
  workerStateRoot,
  worktreeId,
} from './storage-paths.ts'

test('storage paths share a stable worktree identity and isolate checkouts', () => {
  const first = '/workspace/first'
  const second = '/workspace/second'
  assert.match(worktreeId(first), /^[a-f0-9]{16}$/)
  assert.notEqual(worktreeId(first), worktreeId(second))
  assert.equal(worktreeId(first), worktreeId(first + path.sep))
  assert.equal(path.basename(userDataRoot(first)), worktreeId(first))
  assert.equal(path.dirname(workerStateRoot(first)), userDataRoot(first))
  assert.equal(
    workerRoot(first),
    path.join(tmpdir(), 'groupher-dev-hub', worktreeId(first), 'workers'),
  )
})

test('user data base follows the platform and rejects relative XDG paths', () => {
  assert.equal(
    userDataBase('darwin', {}, '/home/user'),
    path.join('/home/user', 'Library', 'Application Support'),
  )
  assert.equal(userDataBase('linux', { XDG_DATA_HOME: '/data/user' }, '/home/user'), '/data/user')
  assert.equal(
    userDataBase('linux', { XDG_DATA_HOME: 'relative' }, '/home/user'),
    path.join('/home/user', '.local', 'share'),
  )
  assert.equal(userDataBase('win32', { LOCALAPPDATA: '/appdata' }, '/home/user'), '/appdata')
})
