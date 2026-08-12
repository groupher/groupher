import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPhoenixToken } from '~/app/phoenix-token'

import { handleArtimentPublishRequest } from '../../../../lib/artiment-publisher/http'
import { POST } from './route'

vi.mock('~/app/phoenix-token', () => ({ getPhoenixToken: vi.fn() }))
vi.mock('../../../../lib/artiment-publisher/http', () => ({
  handleArtimentPublishRequest: vi.fn(async () =>
    Response.json({
      bodyBag: { plainText: 'Body content', schemaVersion: 1 },
      draft: { docId: 'doc-id', title: 'Introduction' },
      ok: true,
    }),
  ),
}))

const mockedGetPhoenixToken = vi.mocked(getPhoenixToken)
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
    mockedGetPhoenixToken.mockReset()
    mockedHandleRequest.mockClear()
  })

  it('requires an authenticated Groupher session', async () => {
    mockedGetPhoenixToken.mockReturnValue(null)

    const response = await POST(request())
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({
      error: { code: 'unauthorized', message: 'Authentication is required.' },
      ok: false,
    })
  })

  it('publishes for an authenticated Groupher session', async () => {
    mockedGetPhoenixToken.mockReturnValue('backend-token')

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
      }),
    )
  })
})
