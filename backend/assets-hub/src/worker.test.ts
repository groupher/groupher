import { env, runInDurableObject } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { signPayload } from './capability'
import { GeneratedImageBatchDO } from './generated-batch-do'
import worker, { ASSETS_HUB_INTERNAL_SCOPE, generatedBatchCleanupHttpStatus } from './worker'

afterEach(() => vi.unstubAllGlobals())

describe('Assets Hub delete queue', () => {
  it('deduplicates storage keys into one R2 bulk delete and ignores invalid messages', async () => {
    const deleteObjects = vi.fn(async (_keys: string | string[]) => undefined)
    const env = {
      ASSETS_BUCKET: { delete: deleteObjects, get: vi.fn() },
    } as unknown as Env

    await worker.queue(
      {
        messages: [
          {
            body: {
              assetId: 1,
              assetPublicRef: 'asset-1',
              communityId: 1,
              storage: 'r2',
              storageKey: 'assets/one.png',
            },
          },
          {
            body: {
              assetId: 2,
              assetPublicRef: 'asset-2',
              communityId: 1,
              storage: 'r2',
              storageKey: 'assets/one.png',
            },
          },
          { body: { storage: 'local', storageKey: 'invalid' } },
        ],
      },
      env,
    )

    expect(deleteObjects).toHaveBeenCalledTimes(1)
    expect(deleteObjects).toHaveBeenCalledWith(['assets/one.png'])
  })
})

describe('Assets Hub readiness', () => {
  const baseEnv = {
    ASSETS_BUCKET: { delete: vi.fn(), get: vi.fn() },
    ASSET_DELETE_QUEUE: { send: vi.fn() },
    ENVIRONMENT: 'development',
    PHOENIX_GRAPHQL_ENDPOINT: 'http://127.0.0.1:4001/graphiql',
    SERVICE_AUTH_CLIENT_ID: 'assets-hub-test',
    SERVICE_AUTH_CLIENT_SECRET: 'test-secret',
    SERVICE_AUTH_ISSUER: 'https://auth.groupher.localhost',
    SERVICE_AUTH_JWKS_URL: 'http://127.0.0.1:3004/.well-known/jwks.json',
    SERVICE_AUTH_TOKEN_ENDPOINT: 'http://127.0.0.1:3004/oauth2/token',
  } as unknown as Env

  it('fails readiness when the service identity configuration is incomplete', async () => {
    const response = await worker.fetch(new Request('http://assets.test/health/ready'), {
      ...baseEnv,
      SERVICE_AUTH_CLIENT_ID: undefined,
      SERVICE_AUTH_CLIENT_SECRET: undefined,
    })

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      status: 'down',
      checks: [
        {
          name: 'assets-service-auth',
          status: 'down',
          message: 'Service identity client configuration is incomplete.',
        },
      ],
    })
  })

  it('only reports ready after the token is accepted by Phoenix origin lookup', async () => {
    const fetcher = vi.fn()
    fetcher
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'probe-token', expires_in: 600, token_type: 'Bearer' }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { communityAssetOriginInfo: null } }), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetcher)

    const response = await worker.fetch(new Request('http://assets.test/health/ready'), baseEnv)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      status: 'ok',
      checks: [{ name: 'assets-service-auth', status: 'ok' }],
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({ authorization: 'Bearer probe-token' }),
    })
  })
})

describe('ReviewBot private image reads', () => {
  it('serves only a signed active-window image capability with no-store headers', async () => {
    const secret = 'review-image-capability-secret'
    const bytes = new Uint8Array([137, 80, 78, 71])
    const get = vi.fn(async () => ({
      body: new Blob([bytes]).stream(),
      httpMetadata: { contentType: 'image/png' },
      size: bytes.byteLength,
    }))
    const runtime = {
      ASSETS_BUCKET: { get },
      ASSETS_HUB_CAPABILITY_SECRET: secret,
    } as unknown as Env
    const token = signPayload(
      {
        assetId: 41,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        immutableVersion: 'sha256:asset-version',
        mimeType: 'image/png',
        objectKey: 'communities/9/assets/41/original',
        purpose: 'review.read',
      },
      runtime,
    )

    const response = await worker.fetch(new Request(`https://assets.test/review/${token}`), runtime)

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    expect(get).toHaveBeenCalledWith('communities/9/assets/41/original')
  })

  it('rejects expired capabilities before reading the object', async () => {
    const get = vi.fn()
    const runtime = {
      ASSETS_BUCKET: { get },
      ASSETS_HUB_CAPABILITY_SECRET: 'review-image-capability-secret',
    } as unknown as Env
    const token = signPayload(
      {
        assetId: 41,
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
        immutableVersion: 'sha256:asset-version',
        mimeType: 'image/png',
        objectKey: 'communities/9/assets/41/original',
        purpose: 'review.read',
      },
      runtime,
    )

    const response = await worker.fetch(new Request(`https://assets.test/review/${token}`), runtime)

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(get).not.toHaveBeenCalled()
  })
})

describe('Assets Hub generated-batch authorization', () => {
  const authEnv = {
    ASSETS_BUCKET: { delete: vi.fn(), get: vi.fn() },
    ASSET_DELETE_QUEUE: { send: vi.fn() },
    SERVICE_AUTH_ISSUER: 'https://auth.groupher.localhost',
    SERVICE_AUTH_JWKS_URL: 'http://assets-auth.test/.well-known/jwks.json',
  } as unknown as Env

  const internalRoutes = [
    {
      path: '/generated-batches/batch-auth/assets',
      scope: ASSETS_HUB_INTERNAL_SCOPE.generatedBatchRegister,
      subject: 'service:assets-hub',
    },
    {
      path: '/generated-batches/batch-auth/claim',
      scope: ASSETS_HUB_INTERNAL_SCOPE.generatedBatchClaim,
      subject: 'service:phoenix',
    },
    {
      path: '/generated-batches/batch-auth/cleanup',
      scope: ASSETS_HUB_INTERNAL_SCOPE.generatedBatchCleanup,
      subject: 'service:phoenix',
    },
  ] as const

  const base64Url = (bytes: Uint8Array) =>
    btoa(String.fromCharCode(...bytes))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')

  const base64UrlJson = (value: unknown) =>
    base64Url(new TextEncoder().encode(JSON.stringify(value)))

  let signingFixture:
    | {
        privateKey: CryptoKey
        jwk: JsonWebKey
      }
    | undefined

  const serviceSigningFixture = async () => {
    if (signingFixture) return signingFixture

    const keyPair = await crypto.subtle.generateKey(
      {
        hash: 'SHA-256',
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
      },
      true,
      ['sign', 'verify'],
    )
    signingFixture = {
      jwk: await crypto.subtle.exportKey('jwk', keyPair.publicKey),
      privateKey: keyPair.privateKey,
    }
    return signingFixture
  }

  const serviceToken = async (scope: string, subject: string) => {
    const { jwk, privateKey } = await serviceSigningFixture()
    const issuedAt = Math.floor(Date.now() / 1_000)
    const header = base64UrlJson({
      alg: 'RS256',
      kid: 'assets-hub-test',
      typ: 'service_access+jwt',
    })
    const payload = base64UrlJson({
      aud: 'assets-hub:internal-api',
      exp: issuedAt + 600,
      iat: issuedAt,
      iss: 'https://auth.groupher.localhost',
      jti: `test-${crypto.randomUUID()}`,
      scope,
      sub: subject,
    })
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    )
    const token = `${header}.${payload}.${base64Url(new Uint8Array(signature))}`

    return {
      token,
      jwks: {
        keys: [{ ...jwk, alg: 'RS256', kid: 'assets-hub-test', use: 'sig' }],
      },
    }
  }

  const stubJwksFetch = (jwks: unknown) => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === 'http://assets-auth.test/.well-known/jwks.json') {
        return new Response(JSON.stringify(jwks), {
          headers: { 'content-type': 'application/json' },
        })
      }
      throw new Error(`Unexpected auth request: ${String(input)}`)
    })
    vi.stubGlobal('fetch', fetcher)
    return fetcher
  }

  it('returns 401 for every internal generated-batch route without a bearer token', async () => {
    for (const route of internalRoutes) {
      const response = await worker.fetch(
        new Request(`http://assets.test${route.path}`, {
          body: JSON.stringify({}),
          method: 'POST',
        }),
        authEnv,
      )

      expect(response.status, route.path).toBe(401)
      await expect(response.json()).resolves.toMatchObject({
        error: { code: 'service_auth_required' },
      })
    }
  })

  it('returns 403 for a valid token with a missing scope or disallowed subject', async () => {
    const missingScope = await serviceToken('assets:generated-batch:other', 'service:phoenix')
    stubJwksFetch(missingScope.jwks)
    const claimResponse = await worker.fetch(
      new Request('http://assets.test/generated-batches/batch-auth/claim', {
        body: JSON.stringify({}),
        headers: { authorization: `Bearer ${missingScope.token}` },
        method: 'POST',
      }),
      authEnv,
    )
    expect(claimResponse.status).toBe(403)
    const cleanupResponse = await worker.fetch(
      new Request('http://assets.test/generated-batches/batch-auth/cleanup', {
        body: JSON.stringify({}),
        headers: { authorization: `Bearer ${missingScope.token}` },
        method: 'POST',
      }),
      authEnv,
    )
    expect(cleanupResponse.status).toBe(403)

    const wrongSubject = await serviceToken(
      ASSETS_HUB_INTERNAL_SCOPE.generatedBatchRegister,
      'service:phoenix',
    )
    stubJwksFetch(wrongSubject.jwks)
    const registerResponse = await worker.fetch(
      new Request('http://assets.test/generated-batches/batch-auth/assets', {
        body: JSON.stringify({}),
        headers: { authorization: `Bearer ${wrongSubject.token}` },
        method: 'POST',
      }),
      authEnv,
    )
    expect(registerResponse.status).toBe(403)
  })

  it('keeps browser cancel capability-authenticated instead of service-token authenticated', async () => {
    const response = await worker.fetch(
      new Request('http://assets.test/generated-batches/batch-auth/cancel', {
        body: JSON.stringify({}),
        method: 'POST',
      }),
      authEnv,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'generated_batch_cancel_failed' },
    })
  })

  it('returns 503 from /cleanup when the DO cannot confirm final publication', async () => {
    const batchRef = `batch-cleanup-route-${crypto.randomUUID()}`
    const claimKey = `${batchRef}:publish`
    const runtimeEnv = env as unknown as Record<string, unknown>
    const previous = {
      capabilitySecret: runtimeEnv.ASSETS_HUB_CAPABILITY_SECRET,
      phoenixEndpoint: runtimeEnv.PHOENIX_GRAPHQL_ENDPOINT,
      issuer: runtimeEnv.SERVICE_AUTH_ISSUER,
      jwksUrl: runtimeEnv.SERVICE_AUTH_JWKS_URL,
    }
    const capabilitySecret = 'assets-hub-cleanup-route-test-secret'
    runtimeEnv.ASSETS_HUB_CAPABILITY_SECRET = capabilitySecret
    runtimeEnv.PHOENIX_GRAPHQL_ENDPOINT = ''
    runtimeEnv.SERVICE_AUTH_ISSUER = 'https://auth.groupher.localhost'
    runtimeEnv.SERVICE_AUTH_JWKS_URL = 'http://assets-auth.test/.well-known/jwks.json'

    try {
      const stub = env.GENERATED_IMAGE_BATCHES.getByName(batchRef)
      await stub.create({
        claim: null,
        expectedVariants: [],
        expiresAt: '2099-09-02T17:00:00.000Z',
        publicRef: batchRef,
        purpose: 'wallpaper-render',
        requestDigest: 'sha256:request',
        requestDigestVersion: 1,
      })
      await runInDurableObject(stub, async (_instance: GeneratedImageBatchDO, state) => {
        state.storage.sql.exec(
          `UPDATE generated_batches
           SET claim_type = 'publish', claim_key = ?, claimed_at = ?, claim_expires_at = ?
           WHERE public_ref = ?`,
          claimKey,
          new Date().toISOString(),
          new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
          batchRef,
        )
      })

      const auth = await serviceToken(
        ASSETS_HUB_INTERNAL_SCOPE.generatedBatchCleanup,
        'service:phoenix',
      )
      stubJwksFetch(auth.jwks)
      const capability = signPayload(
        {
          batchRef,
          claimKey,
          expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
          purpose: 'generated_image_publish',
        },
        { ASSETS_HUB_CAPABILITY_SECRET: capabilitySecret },
      )
      const response = await worker.fetch(
        new Request(`http://assets.test/generated-batches/${batchRef}/cleanup`, {
          body: JSON.stringify({ capability }),
          headers: { authorization: `Bearer ${auth.token}` },
          method: 'POST',
        }),
        env,
      )

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({
        error: {
          code: 'generated_batch_cleanup_failed',
          message: 'GENERATED_IMAGE_BATCH_PUBLISH_STATUS_UNKNOWN',
        },
      })
      expect(await stub.snapshot()).toMatchObject({ publicRef: batchRef })
    } finally {
      if (previous.capabilitySecret === undefined) delete runtimeEnv.ASSETS_HUB_CAPABILITY_SECRET
      else runtimeEnv.ASSETS_HUB_CAPABILITY_SECRET = previous.capabilitySecret
      if (previous.phoenixEndpoint === undefined) delete runtimeEnv.PHOENIX_GRAPHQL_ENDPOINT
      else runtimeEnv.PHOENIX_GRAPHQL_ENDPOINT = previous.phoenixEndpoint
      if (previous.issuer === undefined) delete runtimeEnv.SERVICE_AUTH_ISSUER
      else runtimeEnv.SERVICE_AUTH_ISSUER = previous.issuer
      if (previous.jwksUrl === undefined) delete runtimeEnv.SERVICE_AUTH_JWKS_URL
      else runtimeEnv.SERVICE_AUTH_JWKS_URL = previous.jwksUrl
    }
  })
})

describe('Assets Hub generated-batch cleanup responses', () => {
  it('maps an unavailable final publication probe to retryable HTTP 503', () => {
    expect(generatedBatchCleanupHttpStatus('GENERATED_IMAGE_BATCH_PUBLISH_STATUS_UNKNOWN')).toBe(
      503,
    )
    expect(generatedBatchCleanupHttpStatus('GENERATED_IMAGE_BATCH_DELETE_CLAIM_REQUIRED')).toBe(400)
  })
})
