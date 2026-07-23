import { RICH_EDITOR_SCHEMA_VERSION } from '@groupher/rich-editor/node'
import { describe, expect, it, vi } from 'vitest'

import { handleArtimentPublishRequest } from './http'
import { ARTIMENT_MAX_INPUT_BYTES } from './validate'

const request = (body: string, headers: HeadersInit = { 'Content-Type': 'application/json' }) =>
  new Request('http://localhost/api/artiment/publish', {
    body,
    headers,
    method: 'POST',
  })

const validPayload = {
  action: 'updateDocDraft',
  value: [{ type: 'p', children: [{ text: 'Body content' }] }],
  variables: {
    community: 'home',
    id: 'doc-id',
    slug: 'intro',
    subtitle: 'Intro',
    title: 'Introduction',
  },
}

const options = () => ({
  backendToken: 'backend-token',
  fetchImpl: vi.fn(async () =>
    Response.json({ data: { updateDocDraft: { docId: 'doc-id', title: 'Introduction' } } }),
  ),
  graphqlEndpoint: 'http://backend.test/graphql',
  serverTrustSecret: 'server-trust-secret',
})

describe('handleArtimentPublishRequest', () => {
  it('returns a BodyBag for a valid request', async () => {
    const requestOptions = options()
    const response = await handleArtimentPublishRequest(
      request(JSON.stringify(validPayload)),
      requestOptions,
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(payload).toMatchObject({
      ok: true,
      bodyBag: {
        plainText: 'Body content',
        schemaVersion: RICH_EDITOR_SCHEMA_VERSION,
      },
      draft: { docId: 'doc-id', title: 'Introduction' },
    })
    expect(requestOptions.fetchImpl).toHaveBeenCalledOnce()
    expect(requestOptions.fetchImpl).toHaveBeenCalledWith(
      'http://backend.test/graphql',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer backend-token',
          'X-Groupher-Server-Trust': 'server-trust-secret',
        }),
      }),
    )
  })

  it('rejects unsupported content types', async () => {
    const response = await handleArtimentPublishRequest(request('{}', {}), options())
    const payload = await response.json()

    expect(response.status).toBe(415)
    expect(payload.error.code).toBe('unsupported_media_type')
  })

  it('rejects malformed JSON', async () => {
    const response = await handleArtimentPublishRequest(request('{'), options())
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('invalid_json')
  })

  it('rejects incomplete GraphQL variables before publishing', async () => {
    const response = await handleArtimentPublishRequest(
      request(JSON.stringify({ ...validPayload, variables: { community: 'home' } })),
      options(),
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error.code).toBe('invalid_request')
  })

  it('rejects requests whose declared body size exceeds the limit', async () => {
    const response = await handleArtimentPublishRequest(
      request('{}', {
        'Content-Length': String(ARTIMENT_MAX_INPUT_BYTES + 1),
        'Content-Type': 'application/json',
      }),
      options(),
    )
    const payload = await response.json()

    expect(response.status).toBe(413)
    expect(payload.error.code).toBe('payload_too_large')
  })

  it('maps editor diagnostics to an unprocessable response', async () => {
    const response = await handleArtimentPublishRequest(
      request(
        JSON.stringify({
          action: 'updateDocDraft',
          value: [{ type: 'unknown-block', children: [{ text: 'Body' }] }],
          variables: validPayload.variables,
        }),
      ),
      options(),
    )
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload.error).toMatchObject({
      code: 'invalid_value',
      diagnostics: [expect.objectContaining({ code: 'unknown_node' })],
    })
  })

  it('preserves structured GraphQL changeset errors as readable messages', async () => {
    const requestOptions = options()
    requestOptions.fetchImpl.mockResolvedValueOnce(
      Response.json({
        errors: [
          {
            message: [{ key: 'Slug', message: 'has already been taken' }],
          },
        ],
      }),
    )

    const response = await handleArtimentPublishRequest(
      request(JSON.stringify(validPayload)),
      requestOptions,
    )
    const payload = await response.json()

    expect(response.status).toBe(422)
    expect(payload.error).toEqual({
      code: 'graphql_error',
      message: 'Slug: has already been taken',
    })
  })
})
