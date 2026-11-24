import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertActorUIPageLocation,
  assertActorUIPath,
  assertActorUILinkHref,
  validateActorUIOperation,
} from './local-test-browser.ts'

test('actor UI navigation stays on the selected app origin and actor community routes', () => {
  assert.equal(
    assertActorUIPath('/demo-one/docs/page-1', 'demo-one', 'dash'),
    'https://dash.groupher.localhost/demo-one/docs/page-1',
  )
  assert.equal(
    assertActorUIPath('/home/post', 'demo-one', 'community'),
    'https://community.groupher.localhost/home/post',
  )
  assert.equal(
    assertActorUIPath('/demo-one/', 'demo-one', 'dash'),
    'https://dash.groupher.localhost/demo-one/',
  )

  for (const path of [
    'https://evil.example/',
    '//evil.example/',
    '/other-community/docs',
    '/demo-one/%2e%2e/home',
    '/demo-one/docs?next=/home',
    '/demo-one/docs#section',
    '/demo-one\\docs',
    '/demo-one/%2f%2fevil',
  ])
    assert.throws(() => assertActorUIPath(path, 'demo-one', 'dash'))
})

test('actor UI link actions reject external or out-of-scope destinations', () => {
  assert.equal(
    assertActorUILinkHref('/demo-one/docs/page-1', 'demo-one', 'community'),
    'https://community.groupher.localhost/demo-one/docs/page-1',
  )
  for (const href of [
    null,
    'https://evil.example/',
    '//evil.example/',
    '/other-community/docs',
    '/demo-one/docs?next=/home',
    '/demo-one/docs#section',
    'javascript:alert(1)',
  ])
    assert.throws(() => assertActorUILinkHref(href, 'demo-one', 'community'))
})

test('actor UI page location remains on allowed app routes after each interaction', () => {
  assert.doesNotThrow(() =>
    assertActorUIPageLocation('https://dash.groupher.localhost/demo-one/docs', 'demo-one', 'dash'),
  )
  assert.doesNotThrow(() =>
    assertActorUIPageLocation(
      'https://community.groupher.localhost/home/post',
      'demo-one',
      'community',
    ),
  )
  for (const url of [
    'https://evil.example/demo-one/docs',
    'https://community.groupher.localhost/other-community/post',
    'https://dash.groupher.localhost/demo-one/docs?secret=1',
  ])
    assert.throws(() => assertActorUIPageLocation(url, 'demo-one', 'dash'))
})

test('worker UI operations accept only accessible locator operations and the key allowlist', () => {
  for (const operation of [
    { op: 'snapshot' },
    { op: 'navigate', path: '/demo-one/docs' },
    { op: 'click', role: 'button', name: 'Save' },
    { op: 'fill', role: 'textbox', name: 'Title', value: 'Docs' },
    { op: 'press', key: 'Enter' },
    { op: 'assert-text', text: 'Saved' },
  ] as const)
    assert.doesNotThrow(() => validateActorUIOperation(operation))

  assert.throws(() =>
    validateActorUIOperation({ op: 'click', role: 'document', name: 'x' } as never),
  )
  assert.throws(() =>
    validateActorUIOperation({ op: 'fill', role: 'button', name: 'x', value: 'y' } as never),
  )
  assert.throws(() => validateActorUIOperation({ op: 'press', key: 'Control+C' } as never))
  assert.throws(() =>
    validateActorUIOperation({ op: 'evaluate', expression: 'document.cookie' } as never),
  )
})
