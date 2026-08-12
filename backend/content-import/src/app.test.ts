import assert from 'node:assert/strict'

import { test } from 'vitest'

import { createApp as createContentImportApp } from './app'

const environment = {
  CONTENT_IMPORT_PREVIEW_SECRET: 'preview-secret',
}

const userToken = `header.${Buffer.from(JSON.stringify({ sub: '42' })).toString('base64url')}.signature`
const userRef = 'user:test-subject'

const serviceTokenVerifier = {
  verify: async (_token: string, scope: string) => ({
    audience: 'content-import:internal-api',
    scopes: new Set([scope]),
    subject: 'service:dashboard',
    tokenId: 'test-token',
  }),
}

const createApp = (options: Parameters<typeof createContentImportApp>[0] = {}) =>
  createContentImportApp({
    environment,
    resolveDelegationSubject: async () => 'user:test-subject',
    serviceTokenVerifier,
    ...options,
  })

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

test('preview routes reject a delegated credential without a stable user subject', async () => {
  const appWithoutSubject = createApp({ resolveDelegationSubject: async () => null })
  const subjectResponse = await appWithoutSubject.request('/api/docs/import/previews', {
    headers: {
      Authorization: 'Bearer dashboard-service-token',
      'X-Groupher-User-Authorization': 'Bearer any-token',
    },
    method: 'POST',
  })

  assert.equal(subjectResponse.status, 401)
  assert.deepEqual(await subjectResponse.json(), {
    error: { code: 'unauthorized', message: 'The delegated user credential is invalid.' },
    ok: false,
  })
})

test('preview creation passes stable auth options to the migrated handler', async () => {
  const calls: unknown[] = []
  const app = createApp({
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
      Authorization: 'Bearer dashboard-service-token',
      'Content-Type': 'application/json',
      'X-Groupher-User-Authorization': `Bearer ${userToken}`,
      'x-groupher-user-ref': 'user-1',
    },
    method: 'POST',
  })

  assert.equal(response.status, 202)
  assert.deepEqual(calls, [
    {
      backendToken: userToken,
      previewSecret: 'preview-secret',
      serviceIdentity: 'service:dashboard',
      userRef,
    },
  ])
})

test('direct preview requests cannot spoof owner with the user-ref header', async () => {
  const calls: unknown[] = []
  const app = createApp({
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
      Authorization: 'Bearer dashboard-service-token',
      'Content-Type': 'application/json',
      'X-Groupher-User-Authorization': `Bearer ${userToken}`,
      'x-groupher-user-ref': 'spoofed-user',
    },
    method: 'POST',
  })

  assert.equal(response.status, 202)
  assert.equal((calls[0] as { userRef: string }).userRef, userRef)
})

test('preview read and delete pass path params and owner scope', async () => {
  const calls: unknown[] = []
  const app = createApp({
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
    Authorization: 'Bearer dashboard-service-token',
    'X-Groupher-User-Authorization': `Bearer ${userToken}`,
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
    ['get', 'prv_123', 'home', { serviceIdentity: 'service:dashboard', userRef }],
    ['cancel', 'prv_123', 'home', { serviceIdentity: 'service:dashboard', userRef }],
  ])
})

test('apply route passes the preview ref and full auth options', async () => {
  const calls: unknown[] = []
  const app = createApp({
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
      Authorization: 'Bearer dashboard-service-token',
      'Content-Type': 'application/json',
      'X-Groupher-User-Authorization': `Bearer ${userToken}`,
      'x-groupher-user-ref': 'user-1',
    },
    method: 'POST',
  })

  assert.equal(response.status, 202)
  assert.deepEqual(calls, [
    [
      'prv_123',
      {
        backendToken: userToken,
        previewSecret: 'preview-secret',
        serviceIdentity: 'service:dashboard',
        userRef,
      },
    ],
  ])
})

test('internal sweep route requires Dashboard service identity and deletes expired previews', async () => {
  const calls: string[] = []
  const app = createApp({
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
    headers: { Authorization: 'Bearer dashboard-service-token' },
    method: 'POST',
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { deleted: 3, ok: true })
  assert.deepEqual(calls, ['sweep'])
})
