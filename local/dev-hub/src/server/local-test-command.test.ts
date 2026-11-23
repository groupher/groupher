import assert from 'node:assert/strict'
import test from 'node:test'

import { assertLocalTestTarget, parseLocalTestCommand } from './local-test-command.ts'

test('rejects remote Hub targets and deployment environments before doing work', () => {
  for (const origin of [
    'https://example.com',
    'http://192.168.1.2:4310',
    'http://127.0.0.1:4310/redirect',
    'http://user@localhost:4310',
  ])
    assert.throws(() => assertLocalTestTarget(origin, {}))
  for (const key of ['NODE_ENV', 'CLOUDFLARE_ENV', 'ENVIRONMENT', 'MIX_ENV']) {
    for (const value of ['production', 'staging', 'preview'])
      assert.throws(() => assertLocalTestTarget('http://127.0.0.1:4310', { [key]: value }))
  }
  assert.doesNotThrow(() => assertLocalTestTarget('http://127.0.0.1:4310', {}))
})

test('Dash needs explicit community and actor; grants cannot mix scopes or privileged roles', () => {
  const parse = (s: string) => parseLocalTestCommand(s.split(' '))
  assert.throws(() => parse('actors open --run demo --as alice'), /community/)
  assert.throws(() => parse('actors open --run demo --community home'), /as/)
  assert.throws(() => parse('actors create --run ../other --alias alice'))
  assert.throws(() => parse('actors create --run demo --url https://example.com'))
  assert.throws(
    () =>
      parse(
        'actors grant --run demo --as alice --community home --article abc --permissions article.update --by bob',
      ),
    /exactly one/,
  )
  assert.throws(
    () =>
      parse(
        'actors grant --run demo --as alice --community home --role lord --permissions community.update',
      ),
    /cannot be mixed/,
  )
  assert.throws(
    () =>
      parse('actors grant --run demo --as alice --community home --permissions community.update'),
    /by/,
  )
  assert.equal(
    parse('communities create --run demo --owner alice --slug demo-one').command,
    'community.create',
  )
  assert.equal(
    parse('actors grant --run demo --as alice --community home --role lord').options.role,
    'lord',
  )
})

test('cleanup requires explicit apply and accepts no force or remote target', () => {
  assert.equal(parseLocalTestCommand(['actors', 'clean', '--run', 'demo']).options.apply, undefined)
  assert.equal(
    parseLocalTestCommand(['actors', 'clean', '--run', 'demo', '--apply']).options.apply,
    true,
  )
  assert.throws(() => parseLocalTestCommand(['actors', 'clean', '--run', 'demo', '--force']))
  assert.throws(() =>
    parseLocalTestCommand(['actors', 'clean', '--run', 'demo', '--url', 'https://example.com']),
  )
})
