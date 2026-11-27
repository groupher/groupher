import assert from 'node:assert/strict'
import test from 'node:test'

import { localFixtureEndpoint, localPublicRoot } from './local-test-command.ts'
import { articleDispatchError, LocalFixtureError } from './local-test-error.ts'

test('fixture requests follow the owning Hub Phoenix loopback address', () => {
  assert.equal(
    localFixtureEndpoint([{ id: 'phoenix', localUrl: 'http://127.0.0.1:14001/health' }]),
    'http://127.0.0.1:14001/__local-test/actors',
  )
  assert.throws(() =>
    localFixtureEndpoint([{ id: 'phoenix', localUrl: 'https://api.groupher.com/health' }]),
  )
  assert.throws(() => localFixtureEndpoint([]))
})

test('retained slug errors include actionable structured details', () => {
  const error = new LocalFixtureError('slug_retained', {
    slug: 'example',
    lifecycle: 'archived',
    action: 'choose_a_new_slug',
  })
  assert.equal(error.code, 'slug_retained')
  assert.match(error.message, /example, archived.*new slug/)
  assert.equal(error.details?.lifecycle, 'archived')
})

test('uncertain Article errors direct the caller to the matching run preview', () => {
  const error = new LocalFixtureError('local_test_article_recovery_required', { run: 'demo-1' })
  assert.equal(error.code, 'local_test_article_recovery_required')
  assert.equal(error.details?.run, 'demo-1')
  assert.match(error.message, /may still be in progress/)
  assert.match(error.message, /pnpm seed cleanup run --run demo-1/)
  assert.doesNotMatch(
    new LocalFixtureError('local_test_article_pending', { run: 'bad;command' }).message,
    /bad;command/,
  )
})

test('Article failures distinguish browser preparation from an attempted dispatch', () => {
  const early = new Error('browser unavailable')
  assert.equal(articleDispatchError(early, 'demo', false), early)
  const pending = articleDispatchError(early, 'demo', true) as LocalFixtureError
  assert.equal(pending.code, 'local_test_article_recovery_required')
  assert.equal(pending.details?.cause, 'transport_or_publisher_error')
  assert.match(pending.message, /--run demo/)
  const rejected = articleDispatchError(new LocalFixtureError('provenance_mismatch'), 'demo', true)
  assert.ok(rejected instanceof LocalFixtureError)
  assert.equal(rejected.details?.cause, 'provenance_mismatch')
})

test('browser targets must share the owning environment domain', () => {
  const services = [
    { id: 'auth', url: 'https://auth.groupher-feature.localhost/health' },
    { id: 'dash', url: 'https://dash.groupher-feature.localhost/home/overview' },
  ]
  assert.equal(localPublicRoot(services, 'dash'), 'groupher-feature.localhost')
  assert.throws(() =>
    localPublicRoot(
      [{ ...services[0] }, { ...services[1], url: 'https://dash.groupher.localhost/' }],
      'dash',
    ),
  )
})
