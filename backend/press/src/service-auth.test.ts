import { describe, expect, it, vi } from 'vitest'

import { createServiceAuthClientCache } from './service-auth'

describe('Press service-auth client cache', () => {
  it('reuses a token client for requests with the same credentials', async () => {
    const getToken = vi.fn(async () => 'service-token')
    const createClient = vi.fn(() => ({ getToken }))
    const clients = createServiceAuthClientCache(createClient)
    const environment = {
      SERVICE_AUTH_CLIENT_ID: 'press',
      SERVICE_AUTH_CLIENT_SECRET: 'secret',
      SERVICE_AUTH_TOKEN_ENDPOINT: 'https://auth.test/oauth2/token',
    }
    const request = { resource: 'https://api.test/press', scopes: ['press:article:read'] }

    await clients(environment).getToken(request)
    await clients({ ...environment }).getToken(request)

    expect(createClient).toHaveBeenCalledOnce()
    expect(getToken).toHaveBeenCalledTimes(2)
  })

  it('recreates the cached client when credentials change', async () => {
    const createClient = vi.fn(() => ({ getToken: vi.fn(async () => 'service-token') }))
    const clients = createServiceAuthClientCache(createClient)

    await clients({
      SERVICE_AUTH_CLIENT_ID: 'press',
      SERVICE_AUTH_CLIENT_SECRET: 'secret-a',
      SERVICE_AUTH_TOKEN_ENDPOINT: 'https://auth.test/oauth2/token',
    }).getToken({ resource: 'resource', scopes: ['scope'] })
    await clients({
      SERVICE_AUTH_CLIENT_ID: 'press',
      SERVICE_AUTH_CLIENT_SECRET: 'secret-b',
      SERVICE_AUTH_TOKEN_ENDPOINT: 'https://auth.test/oauth2/token',
    }).getToken({ resource: 'resource', scopes: ['scope'] })

    expect(createClient).toHaveBeenCalledTimes(2)
  })
})
