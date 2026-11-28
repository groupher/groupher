import assert from 'node:assert/strict'
import test from 'node:test'

import { embedPageIdentity, extractPageIdentity } from './page-identity.ts'

test('page identity cannot escape its non-executable JSON element', () => {
  const identity = {
    instanceId: 'instance-a',
    repoRoot: '/checkout/</script><script>alert(1)</script>&',
  }
  const html = embedPageIdentity('<html><head></head><body></body></html>', identity)
  const payload = html.match(
    /<script id="dev-hub-page-identity" type="application\/json">(.*?)<\/script>/,
  )?.[1]
  assert.ok(payload)
  assert.deepEqual(JSON.parse(payload), identity)
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.deepEqual(extractPageIdentity(html), identity)
  assert.throws(() => extractPageIdentity(html + html), /one instance/)
  assert.throws(() => embedPageIdentity('<body></body>', identity), /head element/)
})
