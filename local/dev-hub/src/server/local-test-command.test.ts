import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertLocalTestTarget,
  parseActorUIOperation,
  parseLocalTestCommand,
  runCheckedActorUI,
} from './local-test-command.ts'

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
  assert.equal(
    parseLocalTestCommand(['actors', 'browsers-clean', '--run', 'demo']).command,
    'actor.browsers-clean',
  )
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

test('Article fixtures require a registered actor selector, explicit community and post thread', () => {
  const base = [
    'articles',
    'create',
    '--run',
    'demo',
    '--as',
    'owner',
    '--community',
    'home',
    '--thread',
    'post',
  ]
  assert.equal(parseLocalTestCommand(base).command, 'article.create')
  assert.equal(parseLocalTestCommand([...base, '--key', 'primary']).options.key, 'primary')
  assert.equal(parseLocalTestCommand([...base, '--publish']).options.publish, true)
  assert.equal(parseLocalTestCommand(base).options.publish, undefined)
  assert.throws(() => parseLocalTestCommand([...base, '--publish', '--publish']))
  assert.throws(() => parseLocalTestCommand(base.slice(0, -2)), /thread post/)
  assert.throws(() => parseLocalTestCommand([...base.slice(0, -1), 'doc']), /thread post/)
  assert.throws(() => parseLocalTestCommand([...base, '--key', '../other']))
  assert.throws(() => parseLocalTestCommand([...base, '--author-id', '42']))
  assert.throws(() => parseLocalTestCommand([...base, '--url', 'https://example.com']))
})

test('actor UI commands parse only bounded, accessible operations and require their app scope', () => {
  const base = ['actors', 'ui', '--run', 'demo', '--as', 'editor', '--community', 'demo-one']
  assert.equal(
    parseLocalTestCommand([...base, '--app', 'community', '--op', 'snapshot']).command,
    'actor.ui',
  )
  assert.deepEqual(parseActorUIOperation('click', { role: 'button', name: 'Save' }), {
    op: 'click',
    role: 'button',
    name: 'Save',
  })
  assert.deepEqual(
    parseActorUIOperation('fill', { role: 'textbox', name: 'Title', value: 'New title' }),
    { op: 'fill', role: 'textbox', name: 'Title', value: 'New title' },
  )
  assert.deepEqual(parseActorUIOperation('press', { key: 'Enter' }), { op: 'press', key: 'Enter' })
  assert.deepEqual(parseActorUIOperation('assert-text', { text: 'Saved' }), {
    op: 'assert-text',
    text: 'Saved',
  })
  assert.throws(() => parseLocalTestCommand([...base, '--op', 'snapshot']), /--app is required/)
  assert.throws(
    () => parseActorUIOperation('snapshot', { path: '/demo/docs' }),
    /Unexpected UI option/,
  )
  assert.throws(
    () => parseActorUIOperation('click', { role: 'button', name: '' }),
    /accessible role and name/,
  )
  assert.throws(
    () => parseActorUIOperation('click', { role: 'document', name: 'Save' }),
    /accessible role and name/,
  )
  assert.throws(
    () => parseActorUIOperation('fill', { role: 'button', name: 'Save', value: 'x' }),
    /textbox or combobox/,
  )
  assert.throws(
    () =>
      parseActorUIOperation('fill', { role: 'textbox', name: 'Title', value: 'x'.repeat(1001) }),
    /bounded value/,
  )
  assert.throws(() => parseActorUIOperation('press', { key: 'Control+C' }), /not allowed/)
  assert.throws(
    () => parseActorUIOperation('assert-text', { text: 'x'.repeat(251) }),
    /bounded visible text/,
  )
  assert.throws(() =>
    parseLocalTestCommand([...base, '--app', 'community', '--op', 'click', '--selector', 'body']),
  )
})

test('actor UI checks run/alias/community permission before operating the selected profile', async () => {
  const events: string[] = []
  const result = await runCheckedActorUI(
    {
      run: 'demo',
      alias: 'editor',
      community: 'demo-one',
      app: 'community',
      operation: { op: 'snapshot' },
    },
    async (body) => {
      events.push('check')
      assert.deepEqual(body, {
        command: 'actor.check',
        alias: 'editor',
        community: 'demo-one',
        app: 'community',
      })
      return { login: 'synthetic-editor' }
    },
    async (actor, operation) => {
      events.push('operate')
      assert.deepEqual(actor, {
        run: 'demo',
        alias: 'editor',
        community: 'demo-one',
        login: 'synthetic-editor',
        app: 'community',
        headless: false,
      })
      assert.deepEqual(operation, { op: 'snapshot' })
      return { visibleText: 'Queue member page' }
    },
  )
  assert.deepEqual(events, ['check', 'operate'])
  assert.deepEqual(result, { visibleText: 'Queue member page' })

  let operated = false
  await assert.rejects(
    runCheckedActorUI(
      {
        run: 'demo',
        alias: 'outsider',
        community: 'demo-one',
        app: 'dash',
        operation: { op: 'snapshot' },
      },
      async () => Promise.reject(new Error('admin_required')),
      async () => {
        operated = true
      },
    ),
    /admin_required/,
  )
  assert.equal(operated, false)
})

test('allows an exact unnamed textbox for bounded editor input', () => {
  assert.deepEqual(
    parseActorUIOperation('fill', { role: 'textbox', name: '', value: 'Queue body' }),
    { op: 'fill', role: 'textbox', name: '', value: 'Queue body' },
  )
})
