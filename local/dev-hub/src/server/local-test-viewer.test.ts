import assert from 'node:assert/strict'
import test from 'node:test'

import { verifyLocalTestViewer } from './local-test-viewer.ts'

test('viewer check reports upstream HTTP failures before parsing their error bodies', async (t) => {
  for (const body of ['<!DOCTYPE html>', JSON.stringify({ unhandled: true })]) {
    t.mock.method(globalThis, 'fetch', async () => new Response(body, { status: 500 }))
    await assert.rejects(verifyLocalTestViewer('owner'), /HTTP 500/)
    t.mock.restoreAll()
  }
})

test('viewer check distinguishes invalid JSON and GraphQL failures from an account mismatch', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>'))
  await assert.rejects(verifyLocalTestViewer('owner'), /invalid JSON/)
  t.mock.restoreAll()
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ errors: [{ message: 'rejected' }] }),
  )
  await assert.rejects(verifyLocalTestViewer('owner'), /GraphQL errors/)
})

test('viewer check requires a valid session for the exact selected owner', async (t) => {
  for (const sessionState of [
    null,
    { isValid: false, user: { login: 'owner' } },
    { isValid: true, user: { login: 'other' } },
  ]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ data: { sessionState } }))
    await assert.rejects(verifyLocalTestViewer('owner'), /did not match/)
    t.mock.restoreAll()
  }
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ data: { sessionState: { isValid: true, user: { login: 'owner' } } } }),
  )
  await verifyLocalTestViewer('owner')
})
