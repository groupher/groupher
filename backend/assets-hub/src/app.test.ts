import { afterEach, describe, expect, it, vi } from 'vitest'

import { createApp } from './app'

const allowedOrigin = 'http://dash.groupher.localhost:3103'
const localEnvironment = {
  ASSETS_HUB_CAPABILITY_SECRET: 'test-capability-secret',
  ASSETS_HUB_RUNTIME: 'local',
  PHOENIX_GRAPHQL_ENDPOINT: 'http://127.0.0.1:4001/graphql',
  SERVICE_AUTH_CLIENT_ID: 'assets-hub-test',
  SERVICE_AUTH_CLIENT_SECRET: 'test-secret',
  SERVICE_AUTH_ISSUER: 'http://auth.groupher.localhost:3004',
  SERVICE_AUTH_JWKS_URL: 'http://auth.groupher.localhost:3004/.well-known/jwks.json',
  SERVICE_AUTH_TOKEN_ENDPOINT: 'http://auth.groupher.localhost:3004/oauth2/token',
}

const preflight = (path: string, method: string) =>
  createApp({ environment: localEnvironment }).request(path, {
    headers: {
      'access-control-request-headers': 'content-type',
      'access-control-request-method': method,
      origin: allowedOrigin,
    },
    method: 'OPTIONS',
  })

const base64Url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url')
const base64UrlJson = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')

const serviceToken = async () => {
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
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey)
  const issuedAt = Math.floor(Date.now() / 1_000)
  const header = base64UrlJson({
    alg: 'RS256',
    kid: 'assets-hub-app-test',
    typ: 'service_access+jwt',
  })
  const payload = base64UrlJson({
    aud: 'assets-hub:internal-api',
    exp: issuedAt + 600,
    iat: issuedAt,
    iss: localEnvironment.SERVICE_AUTH_ISSUER,
    jti: `test-${crypto.randomUUID()}`,
    scope: 'assets:object:delete',
    sub: 'service:phoenix',
  })
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(`${header}.${payload}`),
  )

  return {
    jwks: { keys: [{ ...jwk, alg: 'RS256', kid: 'assets-hub-app-test', use: 'sig' }] },
    token: `${header}.${payload}.${base64Url(new Uint8Array(signature))}`,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('local Assets Hub HTTP boundary', () => {
  it.each([
    ['/generated-batches', 'POST'],
    ['/local/uploads/upload-1', 'PUT'],
    ['/a/asset-1/original', 'GET'],
  ])('allows configured browser preflight for %s', async (path, method) => {
    const response = await preflight(path, method)

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin)
    expect(response.headers.get('access-control-allow-methods')).toContain(method)
  })

  it('requires explicit local issuer and JWKS configuration before reporting ready', async () => {
    const app = createApp({
      environment: {
        ...localEnvironment,
        SERVICE_AUTH_ISSUER: undefined,
        SERVICE_AUTH_JWKS_URL: undefined,
      },
    })

    const response = await app.request('/health/ready')

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      checks: [
        {
          message: expect.stringContaining('SERVICE_AUTH_ISSUER, SERVICE_AUTH_JWKS_URL'),
          status: 'down',
        },
      ],
    })
  })

  it('keeps public routes available and fails internal auth closed for an invalid JWKS URL', async () => {
    const fixture = await serviceToken()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(fixture.jwks), {
            headers: { 'content-type': 'application/json' },
          }),
      ),
    )
    const validApp = createApp({
      environment: {
        ...localEnvironment,
        SERVICE_AUTH_JWKS_URL: 'http://assets-auth.test/.well-known/jwks.json',
      },
    })
    const validResponse = await validApp.request('/internal/assets/delete', {
      body: JSON.stringify({}),
      headers: { authorization: `Bearer ${fixture.token}`, 'content-type': 'application/json' },
      method: 'POST',
    })
    expect(validResponse.status).toBe(400)

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const app = createApp({
      environment: {
        ...localEnvironment,
        SERVICE_AUTH_JWKS_URL: 'not-a-url',
      },
    })

    expect((await app.request('/health')).status).toBe(200)
    expect((await app.request('/health/ready')).status).toBe(503)
    expect(warn).toHaveBeenCalledWith(
      '[assets-hub] Invalid service-auth verifier configuration',
      expect.objectContaining({ error: expect.any(String) }),
    )
    expect(
      (
        await app.request('/internal/assets/delete', {
          headers: { authorization: `Bearer ${fixture.token}` },
          method: 'POST',
        })
      ).status,
    ).toBe(401)
  })

  it('reports an invalid verifier configuration as unready outside local mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const app = createApp({ environment: { SERVICE_AUTH_JWKS_URL: 'not-a-url' } })

    const response = await app.request('/health/ready')

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      checks: [
        {
          message: 'Invalid service-auth verifier configuration.',
          status: 'down',
        },
      ],
    })
    expect(warn).toHaveBeenCalledOnce()
  })
})
