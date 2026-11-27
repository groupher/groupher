import assert from 'node:assert/strict'
import test from 'node:test'

import { runHubCommand } from './cli.ts'
import { parseLocalTestCommand } from './local-test-command.ts'
import { formatSeedResult, mapSeedCommand } from './seed-command.ts'

test('JSON results identify the checkout and run and retain cleanup status', () => {
  assert.deepEqual(
    formatSeedResult(['cleanup', 'run', '--run', 'demo', '--json'], '/checkout', {
      status: 'partial',
      blockers: ['pending'],
    }),
    {
      environment: '/checkout',
      run: 'demo',
      command: 'cleanup run',
      status: 'partial',
      result: { status: 'partial', blockers: ['pending'] },
    },
  )
  assert.deepEqual(formatSeedResult(['home', 'prepare', '--json'], '/checkout', { slug: 'home' }), {
    environment: '/checkout',
    run: 'home',
    command: 'home prepare',
    status: 'completed',
    result: { slug: 'home' },
  })
})

test('seed help is available without a Hub or database', async () => {
  const unavailable: typeof fetch = async () => {
    throw new Error('help must not contact a service')
  }
  const help = await runHubCommand(['seed', '--help'], unavailable)
  assert.match(String(help), /community create/)
  assert.match(String(help), /cleanup run/)
})

test('seed commands use the managed fixture parser', () => {
  const input = [
    'community',
    'create',
    '--run',
    'demo',
    '--owner',
    'alice',
    '--slug',
    'demo',
    '--json',
  ]
  const mapped = mapSeedCommand(input)
  assert.deepEqual(parseLocalTestCommand(mapped), {
    command: 'community.create',
    options: { run: 'demo', owner: 'alice', slug: 'demo' },
  })
  assert.equal(
    parseLocalTestCommand(mapSeedCommand(['cleanup', 'run', '--run', 'demo'])).command,
    'actor.clean',
  )
  assert.deepEqual(parseLocalTestCommand(mapSeedCommand(['home', 'prepare', '--json'])), {
    command: 'home.prepare',
    options: { run: 'home' },
  })
  assert.equal(
    parseLocalTestCommand(
      mapSeedCommand([
        'community',
        'request-destroy',
        '--run',
        'demo',
        '--slug',
        'demo',
        '--by',
        'alice',
      ]),
    ).command,
    'community.request-destroy',
  )
  assert.throws(
    () => mapSeedCommand(['community', 'create', '--run', 'demo', '--owner', 'alice']),
    /slug/,
  )
  assert.throws(() =>
    parseLocalTestCommand(
      mapSeedCommand(['actor', 'create', '--run', 'demo', '--url', 'https://example.com']),
    ),
  )
})

test('admin invitation and acceptance require explicit actor and key', () => {
  const invite = mapSeedCommand([
    'admin',
    'invite',
    '--run',
    'demo',
    '--community',
    'demo',
    '--by',
    'owner',
    '--to',
    'editor',
    '--key',
    'editor-invite',
    '--permissions',
    'dashboard.theme.update',
  ])
  assert.equal(parseLocalTestCommand(invite).command, 'admin.invite')
  const accept = mapSeedCommand([
    'admin',
    'accept',
    '--run',
    'demo',
    '--as',
    'editor',
    '--invite',
    'editor-invite',
  ])
  assert.equal(parseLocalTestCommand(accept).command, 'admin.accept')
  assert.throws(() =>
    parseLocalTestCommand(
      mapSeedCommand(['admin', 'accept', '--run', 'demo', '--invite', 'editor-invite']),
    ),
  )
})

test('named cases map to managed fixture commands', () => {
  for (const [name, command] of [
    ['theme-edit-permission', 'case.theme-edit-permission'],
    ['admin-invitation-pending', 'case.admin-invitation-pending'],
    ['admin-invitation-accepted', 'case.admin-invitation-accepted'],
  ]) {
    const input = ['case', name, '--run', 'demo', '--community', 'demo-community']
    assert.equal(parseLocalTestCommand(mapSeedCommand(input)).command, command)
    assert.throws(() => parseLocalTestCommand(mapSeedCommand(input.slice(0, 4))), /community/)
  }
})

test('unconfirmed cleanup requires an explicit apply and reason', () => {
  const args = [
    'cleanup',
    'run',
    '--run',
    'demo',
    '--retain-unconfirmed',
    'operation',
    '--reason',
    'diagnosis',
  ]
  assert.throws(() => parseLocalTestCommand(mapSeedCommand(args)), /requires --apply/)
  const parsed = parseLocalTestCommand(mapSeedCommand([...args, '--apply']))
  assert.equal(parsed.options['retain-unconfirmed'], 'operation')
  assert.equal(parsed.options.reason, 'diagnosis')
})
