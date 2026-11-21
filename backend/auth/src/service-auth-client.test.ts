// @vitest-environment node
import { createServiceAuthClient } from '@groupher/service/auth'
import { describe, expect, it, vi } from 'vitest'

describe('content history capability acquisition', () => {
  it('rejects a partially granted token before sending it to Phoenix', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        access_token: 'token',
        expires_in: 600,
        token_type: 'Bearer',
        scope: 'content:article:write',
      }),
    )
    const client = createServiceAuthClient({
      clientId: 'browser',
      clientSecret: 'secret',
      endpoint: 'https://auth.example/token',
      fetcher: fetcher as typeof fetch,
    })

    await expect(
      client.getToken({
        resource: 'https://api.groupher.com/content-publisher',
        scopes: ['content:article:write', 'content:history:browser'],
      }),
    ).rejects.toThrow('missing a requested content history capability')
  })
})
