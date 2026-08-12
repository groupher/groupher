// @vitest-environment node

import { createHash } from 'node:crypto'

import { exportJWK, generateKeyPair, jwtVerify } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { issueServiceToken, serviceJwks } from './service-identity'

const secret = 'press-development-secret'
const resource = 'https://api.groupher.com/press'
let environment: Record<string, string>

beforeAll(async () => {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true })
  const signingJwk = { ...(await exportJWK(privateKey)), alg: 'RS256', kid: 'test-key' }
  environment = {
    SERVICE_AUTH_CLIENTS_JSON: JSON.stringify([
      {
        allowedAudiences: ['phoenix:press-api'],
        allowedScopes: ['press:article:read', 'press:site:read'],
        clientId: 'press-development',
        clientRef: 'client_test_press',
        credentialHashes: [`sha256:${createHash('sha256').update(secret).digest('hex')}`],
        serviceName: 'press',
        status: 'active',
      },
    ]),
    SERVICE_AUTH_ISSUER: 'https://auth.groupher.test',
    SERVICE_AUTH_RESOURCES_JSON: JSON.stringify({ [resource]: 'phoenix:press-api' }),
    SERVICE_AUTH_SIGNING_JWK: JSON.stringify(signingJwk),
  }
})

const tokenRequest = (overrides: Record<string, string> = {}) => {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    resource,
    scope: 'press:article:read unavailable:scope',
    ...overrides,
  })
  return new Request('https://auth.groupher.test/oauth2/token', {
    body,
    headers: {
      authorization: `Basic ${Buffer.from(`press-development:${secret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    method: 'POST',
  })
}

describe('service identity issuer', () => {
  it('issues an audience-bound token with only granted requested scopes', async () => {
    const result = await issueServiceToken(tokenRequest(), environment)
    expect(result).toMatchObject({
      expires_in: 600,
      scope: 'press:article:read',
      token_type: 'Bearer',
    })
    if (!('access_token' in result)) throw new Error('Expected a service token.')

    const jwks = await serviceJwks(environment)
    const key = await import('jose').then(({ importJWK }) => importJWK(jwks.keys[0], 'RS256'))
    const verified = await jwtVerify(result.access_token, key, {
      audience: 'phoenix:press-api',
      issuer: 'https://auth.groupher.test',
      typ: 'service_access+jwt',
    })
    expect(verified.payload.sub).toBe('service:press')
    expect(verified.payload.scope).toBe('press:article:read')
    expect(verified.protectedHeader.kid).toBe('test-key')
  })

  it('rejects a resource outside the client allowlist', async () => {
    await expect(
      issueServiceToken(
        tokenRequest({ resource: 'https://assets.groupher.com/internal' }),
        environment,
      ),
    ).resolves.toMatchObject({ error: 'invalid_target', status: 400 })
  })

  it('rejects an invalid client credential without issuing a token', async () => {
    const request = tokenRequest()
    request.headers.set(
      'authorization',
      `Basic ${Buffer.from('press-development:wrong-secret').toString('base64')}`,
    )
    await expect(issueServiceToken(request, environment)).resolves.toMatchObject({
      error: 'invalid_client',
      status: 401,
    })
  })
})
