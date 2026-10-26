import { CONTENT_PUBLISH_ACTION, CONTENT_SOURCE_FORMAT } from '@groupher/contracts/content-publish'
import { describe, expect, it, vi } from 'vitest'

import { handleContentPublishRequest } from './content-publisher'

const command = {
  action: CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT,
  commandId: '00000000-0000-4000-8000-000000000001',
  expectedVersion: 3,
  payload: {
    content: {
      format: CONTENT_SOURCE_FORMAT.PLATE,
      value: [{ children: [{ text: 'Draft' }], type: 'p' }],
    },
    slug: 'draft',
    subtitle: '',
    title: 'Draft',
  },
  target: { community: 'home', documentId: 'doc-id' },
} as const

const request = (body: unknown = command, headers: HeadersInit = {}) =>
  new Request('https://dash.groupher.com/api/content/publish', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  })

const serviceAuthClient = { getToken: vi.fn(async () => 'service-token') }

describe('handleContentPublishRequest', () => {
  it('uses the deployed GraphQL binding before legacy endpoint names', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ data: { updateDocDraft: { docId: 'doc-id', version: 4 } } }),
    )

    await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      environment: {
        GRAPHQL_ENDPOINT: 'https://api.groupher.com/graphiql',
        PHOENIX_GRAPHQL_ENDPOINT: 'http://127.0.0.1:4001/graphiql',
      },
      fetcher: fetcher as typeof fetch,
      serviceAuthClient,
    })

    expect(fetcher).toHaveBeenCalledWith('https://api.groupher.com/graphiql', expect.any(Object))
  })

  it('calls the Workers fetch implementation without an object receiver', async () => {
    const fetcher = vi.fn(async function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation')
      return Response.json({ data: { updateDocDraft: { docId: 'doc-id', version: 4 } } })
    })
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: fetcher as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(200)
    expect(fetcher.mock.contexts).toEqual([undefined])
  })

  it('uses a fixed operation and separates service and user credentials', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const upstream = JSON.parse(String(init?.body))
      expect(upstream.query).toContain('mutation UpdateDocDraft')
      expect(upstream.variables).toMatchObject({
        commandId: command.commandId,
        expectedVersion: command.expectedVersion,
        title: command.payload.title,
      })
      expect(upstream.variables.bodyBag.html).toContain('Draft')
      expect(upstream.variables.bodyBag).not.toHaveProperty('version')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer service-token')
      expect(new Headers(init?.headers).get('x-groupher-user-authorization')).toBe(
        'Bearer user-token',
      )
      return Response.json({ data: { updateDocDraft: { docId: 'doc-id', version: 4 } } })
    })

    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: fetcher as typeof fetch,
      serviceAuthClient,
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ ok: true, result: { docId: 'doc-id', version: 4 } })
    expect(JSON.stringify(payload)).not.toContain('bodyBag')
    expect(serviceAuthClient.getToken).toHaveBeenCalledWith({
      resource: 'https://api.groupher.com/content-publisher',
      scopes: ['content:doc:write'],
    })
  })

  it.each([
    ['unsupported content type', request(command, { 'content-type': 'text/plain' }), 415],
    [
      'invalid JSON',
      new Request('https://dash.groupher.com/api/content/publish', {
        body: '{',
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
      400,
    ],
    ['oversized payload', request(command, { 'content-length': String(2 * 1024 * 1024 + 1) }), 413],
  ])('returns stable JSON for %s', async (_name, input, status) => {
    const response = await handleContentPublishRequest(input as Request, {
      backendToken: 'user-token',
      fetcher: vi.fn() as typeof fetch,
      serviceAuthClient,
    })
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: expect.any(String) },
    })
  })

  it('does not expose invalid upstream HTML', async () => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(
        async () => new Response('<html>secret</html>', { status: 500 }),
      ) as typeof fetch,
      serviceAuthClient,
    })
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('secret')
  })

  it('preserves expected Publisher validation failures', async () => {
    const invalidCommand = {
      ...command,
      payload: {
        ...command.payload,
        content: { format: CONTENT_SOURCE_FORMAT.PLATE, value: [{ type: 'p' }] },
      },
    }
    const response = await handleContentPublishRequest(request(invalidCommand), {
      backendToken: 'user-token',
      fetcher: vi.fn() as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'invalid_value', details: expect.any(Array) },
      ok: false,
    })
  })

  it('maps upstream rate limits and preserves Retry-After', async () => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(async () =>
        Response.json(
          { errors: [{ extensions: { code: 'RATE_LIMITED' }, message: 'slow down' }] },
          { headers: { 'Retry-After': '17' }, status: 429 },
        ),
      ) as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('17')
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'rate_limited' },
      ok: false,
    })
  })

  it('preserves Retry-After for a bare upstream HTTP 429', async () => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(async () =>
        Response.json(
          { error: 'too many requests' },
          { headers: { 'Retry-After': '23' }, status: 429 },
        ),
      ) as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('23')
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'rate_limited' },
      ok: false,
    })
  })

  it.each([
    ['Doc Draft version conflict', 4539],
    ['Comment body version conflict', 4540],
  ])('maps %s to a stable 409 response', async (_name, code) => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(async () =>
        Response.json({ errors: [{ extensions: { code }, message: 'conflict' }] }),
      ) as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'version_conflict' },
      ok: false,
    })
  })

  it('maps the Auth service-scope contract to a stable 403 response', async () => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(async () =>
        Response.json({
          errors: [{ extensions: { code: 'SERVICE_SCOPE_FORBIDDEN' }, message: 'forbidden' }],
        }),
      ) as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'forbidden' },
      ok: false,
    })
  })

  it('uses stable precedence across multiple GraphQL errors', async () => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(async () =>
        Response.json({
          errors: [
            { extensions: { code: 4539 }, message: 'conflict' },
            { extensions: { code: 'SERVICE_SCOPE_FORBIDDEN' }, message: 'forbidden' },
          ],
        }),
      ) as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'forbidden' } })
  })

  it.each([5508, 4303])('does not misclassify unrelated code %s', async (code) => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(async () =>
        Response.json({ errors: [{ extensions: { code }, message: 'unrelated' }] }),
      ) as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'upstream_graphql_error' },
      ok: false,
    })
  })
})
