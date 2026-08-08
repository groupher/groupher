import { describe, expect, it, vi } from 'vitest'

import { createPhoenixOrigin, OriginError } from './origin'

describe('Phoenix Press origin client', () => {
  it('uses executable Absinthe RSS field names and aliases the response DTO', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const request = JSON.parse(String(init?.body)) as { query: string }
      expect(request.query).toContain('pressCommunityRSSFeed: pressCommunityRssFeed')
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

    const feed = await createPhoenixOrigin('http://phoenix.test/graphiql', fetcher).communityFeed(
      'home',
    )
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

  it('maps Phoenix NOT_EXIST errors to 404 even when the message is a domain label', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ errors: [{ message: 'Press Article', code: 4003 }] }))
    const origin = createPhoenixOrigin('http://phoenix.test/graphiql', fetcher)

    await expect(
      origin.article({ community: 'home', thread: 'post', innerId: '1' }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<OriginError>>({ status: 404, message: 'Press Article' }),
    )
  })
})
