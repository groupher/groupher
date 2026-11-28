import assert from 'node:assert/strict'
import test from 'node:test'

import { SERVICE_DEFINITIONS } from './services.ts'
import { prepareSiblingHosts, siblingHostnames } from './sibling-hosts.ts'

const environment = {
  root: '/tmp/secondary',
  commonDir: '/tmp/main/.git',
  worktreeId: '0123456789abcdef',
  claimToken: 'a'.repeat(64),
  slug: 'feature-login',
  role: 'secondary' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
}

test('generates only the registered environment sibling hostnames', () => {
  const names = siblingHostnames(environment, SERVICE_DEFINITIONS)
  assert.ok(names.includes('auth.groupher-feature-login.localhost'))
  assert.ok(names.includes('dash.groupher-feature-login.localhost'))
  assert.ok(names.includes('groupher-feature-login.localhost'))
  assert.ok(names.every((name) => name.endsWith('groupher-feature-login.localhost')))
  assert.throws(() => siblingHostnames({ ...environment, role: 'primary' }, SERVICE_DEFINITIONS))
})

test('updates only the selected marker block and rejects unmanaged conflicts', () => {
  const original =
    '127.0.0.1 localhost\n# groupher-devhub:begin other\n127.0.0.1 groupher-other.localhost\n# groupher-devhub:end other\n'
  const names = ['groupher-feature-login.localhost', 'dash.groupher-feature-login.localhost']
  const first = prepareSiblingHosts(original, 'feature-login', names)
  assert.ok(first.contents.includes(original.trimEnd()))
  assert.equal(prepareSiblingHosts(first.contents, 'feature-login', names).contents, first.contents)
  const removed = prepareSiblingHosts(first.contents, 'feature-login', names, true)
  assert.ok(removed.contents.includes('# groupher-devhub:begin other'))
  assert.ok(!removed.contents.includes('groupher-feature-login.localhost'))
  assert.throws(() =>
    prepareSiblingHosts(
      '127.0.0.1 dash.groupher-feature-login.localhost\n',
      'feature-login',
      names,
    ),
  )
  assert.throws(() =>
    prepareSiblingHosts('# groupher-devhub:begin feature-login\n', 'feature-login', names),
  )
  assert.throws(() =>
    prepareSiblingHosts(original, 'feature-login', ['bad name.groupher-feature-login.localhost']),
  )
})
