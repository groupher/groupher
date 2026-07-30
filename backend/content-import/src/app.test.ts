import assert from 'node:assert/strict'

import { test } from 'vitest'

import { createApp } from './app'

const environment = {
  CONTENT_IMPORT_PREVIEW_SECRET: 'preview-secret',
  GROUPHER_SERVER_TRUST_SECRET: 'server-trust',
}

test('health response identifies the content-import service', async () => {
  const app = createApp({ environment })
  const response = await app.request('/health')

  assert.equal(response.status, 200)
  assert.equal((await response.json()).service, 'content-import')
})

test('preview routes require an authenticated backend token', async () => {
  const app = createApp({ environment })
  const response = await app.request('/api/docs/import/previews', { method: 'POST' })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    error: { code: 'unauthorized', message: 'Authentication is required.' },
    ok: false,
  })
})

test('preview creation passes stable auth options to the migrated handler', async () => {
  const calls: unknown[] = []
  const app = createApp({
    environment,
    handlers: {
      createPreview: async (_request, options) => {
        calls.push(options)
        return Response.json({ ok: true, status: 'queued' }, { status: 202 })
      },
    },
  })

  const response = await app.request('/api/docs/import/previews', {
    body: JSON.stringify({ community: 'home', repoUrl: 'https://github.com/acme/docs' }),
    headers: {
      Authorization: 'Bearer backend-token',
      'Content-Type': 'application/json',
      'X-Groupher-Server-Trust': 'server-trust',
      'x-groupher-user-ref': 'user-1',
    },
    method: 'POST',
  })

  assert.equal(response.status, 202)
  assert.deepEqual(calls, [
    {
      backendToken: 'backend-token',
      previewSecret: 'preview-secret',
      serverTrustSecret: 'server-trust',
      userRef: 'user-1',
    },
  ])
})

test('direct preview requests cannot spoof owner with the user-ref header', async () => {
  const calls: unknown[] = []
  const app = createApp({
    environment,
    handlers: {
      createPreview: async (_request, options) => {
        calls.push(options)
        return Response.json({ ok: true, status: 'queued' }, { status: 202 })
      },
    },
  })

  const response = await app.request('/api/docs/import/previews', {
    body: JSON.stringify({ community: 'home', repoUrl: 'https://github.com/acme/docs' }),
    headers: {
      Authorization: 'Bearer backend-token',
      'Content-Type': 'application/json',
      'x-groupher-user-ref': 'spoofed-user',
    },
    method: 'POST',
  })

  assert.equal(response.status, 202)
  assert.notEqual((calls[0] as { userRef: string }).userRef, 'spoofed-user')
})

test('preview read and delete pass path params and owner scope', async () => {
  const calls: unknown[] = []
  const app = createApp({
    environment,
    handlers: {
      cancelPreview: async (previewRef, community, owner) => {
        calls.push(['cancel', previewRef, community, owner])
        return Response.json({ ok: true })
      },
      getPreview: async (previewRef, community, owner) => {
        calls.push(['get', previewRef, community, owner])
        return Response.json({ ok: true })
      },
    },
  })
  const headers = {
    Authorization: 'Bearer backend-token',
    'X-Groupher-Server-Trust': 'server-trust',
    'x-groupher-user-ref': 'user-1',
  }

  assert.equal(
    (
      await app.request('/api/docs/import/previews/prv_123?community=home', {
        headers,
        method: 'GET',
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await app.request('/api/docs/import/previews/prv_123?community=home', {
        headers,
        method: 'DELETE',
      })
    ).status,
    200,
  )

  assert.deepEqual(calls, [
    ['get', 'prv_123', 'home', { serverTrustSecret: 'server-trust', userRef: 'user-1' }],
    ['cancel', 'prv_123', 'home', { serverTrustSecret: 'server-trust', userRef: 'user-1' }],
  ])
})

test('apply route passes the preview ref and full auth options', async () => {
  const calls: unknown[] = []
  const app = createApp({
    environment,
    handlers: {
      applyPreview: async (_request, previewRef, options) => {
        calls.push([previewRef, options])
        return Response.json({ jobRef: 'job-1', ok: true, status: 'STAGING' }, { status: 202 })
      },
    },
  })

  const response = await app.request('/api/docs/import/previews/prv_123/apply', {
    body: JSON.stringify({ community: 'home', selectedSourceIds: ['source-1'] }),
    headers: {
      Authorization: 'Bearer backend-token',
      'Content-Type': 'application/json',
      'X-Groupher-Server-Trust': 'server-trust',
      'x-groupher-user-ref': 'user-1',
    },
    method: 'POST',
  })

  assert.equal(response.status, 202)
  assert.deepEqual(calls, [
    [
      'prv_123',
      {
        backendToken: 'backend-token',
        previewSecret: 'preview-secret',
        serverTrustSecret: 'server-trust',
        userRef: 'user-1',
      },
    ],
  ])
})

test('internal sweep route requires the cron secret and deletes expired previews', async () => {
  const calls: string[] = []
  const app = createApp({
    environment: { ...environment, CRON_SECRET: 'cron-secret' },
    handlers: {
      sweepExpiredPreviews: async () => {
        calls.push('sweep')
        return 3
      },
    },
  })

  assert.equal(
    (await app.request('/api/internal/docs-import/sweep', { method: 'POST' })).status,
    401,
  )

  const response = await app.request('/api/internal/docs-import/sweep', {
    headers: { Authorization: 'Bearer cron-secret' },
    method: 'POST',
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { deleted: 3, ok: true })
  assert.deepEqual(calls, ['sweep'])
})
