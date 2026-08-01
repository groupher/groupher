import assert from 'node:assert/strict'
import test from 'node:test'

import { openPlatformUrl } from './open-platform-url.ts'

const originalWindow = globalThis.window
const originalConsoleError = console.error

test.afterEach(() => {
  if (originalWindow) {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    })
  } else {
    Reflect.deleteProperty(globalThis, 'window')
  }
  console.error = originalConsoleError
})

test('platform URLs can open public HTTPS destinations in browser mode', () => {
  const calls: unknown[][] = []

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      open: (...args: unknown[]) => calls.push(args),
    },
  })

  openPlatformUrl('https://vercel.com/groupher/main')

  assert.equal(calls.length, 1)
  assert.equal(String(calls[0][0]), 'https://vercel.com/groupher/main')
  assert.equal(calls[0][1], '_blank')
  assert.equal(calls[0][2], 'noopener,noreferrer')
})

test('platform URLs reject non-web protocols', () => {
  const calls: unknown[][] = []
  const errors: unknown[][] = []

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      open: (...args: unknown[]) => calls.push(args),
    },
  })
  console.error = (...args: unknown[]) => {
    errors.push(args)
  }

  openPlatformUrl('file:///tmp/secret')

  assert.equal(calls.length, 0)
  assert.equal(errors.length, 1)
  assert.match(String(errors[0][0]), /Refused to open an unsupported platform URL/)
})
