import { CONTENT_PUBLISH_ACTION, CONTENT_SOURCE_FORMAT } from '@groupher/contracts/content-publish'
import { describe, expect, it, vi } from 'vitest'

import { handleContentPublishRequest } from './content-publisher'

const command = {
  action: CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY,
  commandId: '00000000-0000-4000-8000-000000000001',
  revision: 3,
  payload: {
    content: {
      format: CONTENT_SOURCE_FORMAT.PLATE,
      value: [{ children: [{ text: 'Draft' }], type: 'p' }],
    },
    slug: 'draft',
    subtitle: '',
    title: 'Draft',
  },
  target: { community: 'home', articleId: 'doc-id', workingCopyId: 'work-id' },
} as const

const request = (body: unknown = command, headers: HeadersInit = {}) =>
  new Request('https://dash.groupher.com/api/content/publish', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...headers },
    method: 'POST',
  })

const serviceAuthClient = { getToken: vi.fn(async () => 'service-token') }

describe('handleContentPublishRequest', () => {
  it('sends Docs Queue content with both expected revisions through the trusted adapter', async () => {
    const saveCommand = {
      action: CONTENT_PUBLISH_ACTION.SAVE_DOC_QUEUE_COPY,
      commandId: '00000000-0000-4000-8000-000000000004',
      revision: 3,
      queueRevision: 5,
      payload: {
        content: {
          format: CONTENT_SOURCE_FORMAT.PLATE,
          value: [{ children: [{ text: 'Queue' }], type: 'p' }],
        },
        title: 'Queue',
        subtitle: '',
        slug: 'queue',
      },
      target: { articleId: 'doc-id', community: 'home' },
    }
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const upstream = JSON.parse(String(init?.body))
      expect(upstream.query).toContain('saveDocsQueueCopy(')
      expect(upstream.variables).toMatchObject({
        articleId: 'doc-id',
        queueRevision: 5,
        workingCopyRevision: 3,
        title: 'Queue',
      })
      expect(typeof upstream.variables.bodyBag.thumbnail).toBe('string')
      return Response.json({
        data: { saveDocsQueueCopy: { queueRevision: 6, workingCopyRevision: 4 } },
      })
    })
    const response = await handleContentPublishRequest(request(saveCommand), {
      backendToken: 'user-token',
      fetcher: fetcher as typeof fetch,
      serviceAuthClient,
    })
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { queueRevision: 6, workingCopyRevision: 4 },
    })
  })
  it('uses the deployed GraphQL binding before legacy endpoint names', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ data: { saveWorkingCopy: { docId: 'doc-id', version: 4 } } }),
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
      return Response.json({ data: { saveWorkingCopy: { docId: 'doc-id', version: 4 } } })
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
      expect(upstream.query).toContain('mutation SaveWorkingCopy')
      expect(upstream.variables).toMatchObject({
        commandId: command.commandId,
        revision: command.revision,
        title: command.payload.title,
      })
      expect(upstream.variables.bodyBag.html).toContain('Draft')
      expect(upstream.variables.bodyBag).not.toHaveProperty('version')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer service-token')
      expect(new Headers(init?.headers).get('x-groupher-user-authorization')).toBe(
        'Bearer user-token',
      )
      return Response.json({ data: { saveWorkingCopy: { docId: 'doc-id', version: 4 } } })
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
      scopes: ['content:article:write', 'content:history:browser'],
    })
  })

  it('creates an Article and its default WorkingCopy through createArticle', async () => {
    const createCommand = {
      action: CONTENT_PUBLISH_ACTION.CREATE_ARTICLE,
      commandId: '00000000-0000-4000-8000-000000000002',
      payload: {
        content: {
          format: CONTENT_SOURCE_FORMAT.PLATE,
          value: [{ children: [{ text: 'Published' }], id: 'node-1', type: 'p' }],
        },
        digest: 'Published summary',
        slug: 'published',
        tagIds: [],
        title: 'Published article',
      },
      target: { community: 'home', thread: 'post' },
    } as const
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const upstream = JSON.parse(String(init?.body))
      expect(upstream.query).toContain('mutation CreateArticle')
      expect(upstream.query).toContain('createArticle(')
      expect(upstream.query).not.toContain('createPost(')
      expect(upstream.variables).toMatchObject({
        commandId: createCommand.commandId,
        community: 'home',
        digest: 'Published summary',
        slug: 'published',
        thread: 'POST',
        title: 'Published article',
      })
      return Response.json({
        data: { createArticle: { articleId: 'article-id', revision: 1 } },
      })
    })

    const response = await handleContentPublishRequest(request(createCommand), {
      backendToken: 'user-token',
      fetcher: fetcher as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { articleId: 'article-id', revision: 1 },
    })
  })

  it('sends the Article WorkingCopy revision unchanged to saveWorkingCopy', async () => {
    const saveCommand = {
      action: CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY,
      commandId: '00000000-0000-4000-8000-000000000003',
      revision: 7,
      payload: {
        content: {
          format: CONTENT_SOURCE_FORMAT.PLATE,
          value: [{ children: [{ text: 'Saved' }], id: 'node-2', type: 'p' }],
        },
        tagIds: ['tag-1'],
        title: 'Saved article',
        linkAddr: 'https://example.test/source',
        subtitle: 'Saved subtitle',
      },
      target: { articleId: 'article-id', community: 'home', workingCopyId: 'working-copy-id' },
    } as const
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const upstream = JSON.parse(String(init?.body))
      expect(upstream.query).toContain('mutation SaveWorkingCopy')
      expect(upstream.query).toContain('saveWorkingCopy(')
      expect(upstream.variables).toMatchObject({
        articleId: 'article-id',
        commandId: saveCommand.commandId,
        revision: 7,
        tagIds: ['tag-1'],
        title: 'Saved article',
        linkAddr: 'https://example.test/source',
        subtitle: 'Saved subtitle',
        workingCopyId: 'working-copy-id',
      })
      expect(upstream.variables).not.toHaveProperty('expectedVersion')
      expect(typeof upstream.variables.bodyBag.thumbnail).toBe('string')
      expect(JSON.parse(upstream.variables.bodyBag.thumbnail)).toMatchObject({ version: 1 })
      return Response.json({ data: { saveWorkingCopy: { id: 'working-copy-id', revision: 8 } } })
    })

    const response = await handleContentPublishRequest(request(saveCommand), {
      backendToken: 'user-token',
      fetcher: fetcher as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { id: 'working-copy-id', revision: 8 },
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
    ['Doc Draft version conflict', 4539, 'version_conflict'],
    ['Comment body version conflict', 4540, 'version_conflict'],
    ['Article WorkingCopy revision conflict', 4561, 'revision_conflict'],
  ])('maps %s to a stable 409 response', async (_name, code, errorCode) => {
    const response = await handleContentPublishRequest(request(), {
      backendToken: 'user-token',
      fetcher: vi.fn(async () =>
        Response.json({ errors: [{ extensions: { code }, message: 'conflict' }] }),
      ) as typeof fetch,
      serviceAuthClient,
    })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: errorCode },
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
