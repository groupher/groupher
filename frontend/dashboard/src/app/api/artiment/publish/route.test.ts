import { getToken } from 'next-auth/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AUTH_KEY } from '~/const/oauth'

import { handleArtimentPublishRequest } from '../../../../lib/artiment-publisher/http'
import { POST } from './route'

vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }))
vi.mock('../../../../lib/artiment-publisher/http', () => ({
  handleArtimentPublishRequest: vi.fn(async () =>
    Response.json({
      bodyBag: { plainText: 'Body content', schemaVersion: 1 },
      draft: { docId: 'doc-id', title: 'Introduction' },
      ok: true,
    }),
  ),
}))

const mockedGetToken = vi.mocked(getToken)
const mockedHandleRequest = vi.mocked(handleArtimentPublishRequest)

const request = () =>
  new Request('http://localhost/api/artiment/publish', {
    body: JSON.stringify({
      action: 'updateDocDraft',
      value: [{ type: 'p', children: [{ text: 'Body content' }] }],
      variables: {
        community: 'home',
        id: 'doc-id',
        slug: 'intro',
        subtitle: 'Intro',
        title: 'Introduction',
      },
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

describe('/api/artiment/publish', () => {
  beforeEach(() => {
    mockedGetToken.mockReset()
    mockedHandleRequest.mockClear()
    process.env.GROUPHER_SERVER_TRUST_SECRET = 'server-trust-secret'
  })

  afterEach(() => {
    delete process.env.GROUPHER_SERVER_TRUST_SECRET
  })

  it('requires an authenticated Groupher session', async () => {
    mockedGetToken.mockResolvedValue(null)

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      error: { code: 'unauthorized', message: 'Authentication is required.' },
      ok: false,
    })
  })

  it('publishes for an authenticated Groupher session', async () => {
    mockedGetToken.mockResolvedValue({ [AUTH_KEY.TOKEN]: 'backend-token' })

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status, JSON.stringify(payload)).toBe(200)
    expect(payload).toMatchObject({
      bodyBag: { plainText: 'Body content', schemaVersion: 1 },
      draft: { docId: 'doc-id', title: 'Introduction' },
      ok: true,
    })
    expect(mockedHandleRequest).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        backendToken: 'backend-token',
        serverTrustSecret: 'server-trust-secret',
      }),
    )
  })

  it('requires the Groupher server trust secret', async () => {
    mockedGetToken.mockResolvedValue({ [AUTH_KEY.TOKEN]: 'backend-token' })
    delete process.env.GROUPHER_SERVER_TRUST_SECRET

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      error: {
        code: 'server_trust_not_configured',
        message: 'Groupher server trust is not configured.',
      },
      ok: false,
    })
    expect(mockedHandleRequest).not.toHaveBeenCalled()
  })
})
