import { describe, expect, it, vi } from 'vitest'

import { createPhoenixOrigin, OriginError } from './origin'

describe('Phoenix Press origin client', () => {
  const tokenProvider = { getToken: vi.fn().mockResolvedValue('press-service-token') }

  it('uses executable Absinthe RSS field names and aliases the response DTO', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as { query: string }
      expect(request.query).toContain('pressCommunityRSSFeed: pressCommunityRssFeed')
      expect(request.query).toContain('articleRef: itemId')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer press-service-token')
      return Response.json({
        data: {
          pressCommunityRSSFeed: {
            community: {
              publicRef: 'home',
              slug: 'home',
              title: 'Home',
              locale: 'en',
              canonicalOrigin: 'https://groupher.com',
              canonicalPath: '/home',
            },
            config: {
              markdownEnabled: true,
              feedEnabled: true,
              feedType: 'DIGEST',
              feedCount: 20,
              feedThreads: ['POST'],
              llmsEnabled: true,
              sitemapEnabled: true,
              revision: 1,
            },
            configRevision: 1,
            feedRevision: 'revision-1',
            items: [],
          },
        },
      })
    })

    const feed = await createPhoenixOrigin(
      'http://phoenix.test/graphiql',
      fetcher,
      tokenProvider,
    ).communityFeed('home')
    expect(feed.feedRevision).toBe('revision-1')
    expect(feed.config.feedType).toBe('digest')
    expect(feed.config.feedThreads).toEqual(['post'])
  })

  it('maps unavailable Phoenix requests to a safe 503', async () => {
    const origin = createPhoenixOrigin('http://phoenix.test/graphiql', async () => {
      throw new Error('connection refused')
    })

    await expect(origin.siteManifest('home')).rejects.toEqual(
      expect.objectContaining<Partial<OriginError>>({ status: 503 }),
    )
  })

  it('aliases Phoenix article identifiers into the Press response contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as { query: string }
      expect(request.query).toContain('articleRef: articleId')
      return Response.json({ data: { pressArticle: null } })
    })
    const origin = createPhoenixOrigin('http://phoenix.test/graphiql', fetcher, tokenProvider)

    await expect(
      origin.article({ community: 'home', thread: 'post', innerId: '1' }),
    ).rejects.toEqual(expect.objectContaining<Partial<OriginError>>({ status: 404 }))
  })

  it('aliases Phoenix site manifest item identifiers into the Press response contract', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as { query: string }
      expect(request.query).toContain('articleRef: itemId')
      return Response.json({ data: { pressSiteManifest: null } })
    })
    const origin = createPhoenixOrigin('http://phoenix.test/graphiql', fetcher, tokenProvider)

    await expect(origin.siteManifest('home')).rejects.toEqual(
      expect.objectContaining<Partial<OriginError>>({ status: 404 }),
    )
  })

  it('maps Phoenix NOT_EXIST errors to 404 even when the message is a domain label', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ errors: [{ message: 'Press Article', code: 4003 }] }))
    const origin = createPhoenixOrigin('http://phoenix.test/graphiql', fetcher, tokenProvider)

    await expect(
      origin.article({ community: 'home', thread: 'post', innerId: '1' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OriginError>>({ status: 404, message: 'Press Article' }),
    )
  })
  it.each([
    [5504, 'Public Community'],
    ['5504', 'Public Community'],
    [6008, 'Press Article'],
    [6011, 'Published Doc'],
  ])(
    'maps Absinthe absence code %s to 404 without relying on message text',
    async (code, message) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ errors: [{ message, extensions: { code } }] }))
      const origin = createPhoenixOrigin('http://phoenix.test/graphiql', fetcher, tokenProvider)
      await expect(origin.siteManifest('hidden')).rejects.toEqual(
        expect.objectContaining<Partial<OriginError>>({ status: 404, message }),
      )
    },
  )

  it('keeps operational GraphQL failures as 502', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        errors: [{ message: 'Search platform unavailable', extensions: { code: 4529 } }],
      }),
    )
    const origin = createPhoenixOrigin('http://phoenix.test/graphiql', fetcher, tokenProvider)
    await expect(origin.siteManifest('home')).rejects.toEqual(
      expect.objectContaining<Partial<OriginError>>({ status: 502 }),
    )
  })
})
