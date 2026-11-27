import assert from 'node:assert/strict'
import test from 'node:test'

import { openUrl } from './open-url'

test('managed desktop frames send the destination to their parent', () => {
  const original = globalThis.window
  const messages: unknown[] = []
  const parent = { postMessage: (...args: unknown[]) => messages.push(args) }
  Object.assign(globalThis, { window: { parent, location: { search: '?devhubRoot=a&devhubInstance=b' } } })
  try {
    openUrl(new URL('https://dash.groupher-b.localhost/'))
    assert.deepEqual(messages, [[{ type: 'groupher-devhub-open-url', url: 'https://dash.groupher-b.localhost/' }, '*']])
  } finally {
    Object.assign(globalThis, { window: original })
  }
})
