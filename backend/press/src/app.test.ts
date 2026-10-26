import { ServiceTokenAuthorizationError } from '@groupher/service/auth'
import { describe, expect, it, vi } from 'vitest'

import { createApp } from './app'
import type { CachedOutput, OutputCache } from './cache'
import type { Origin } from './origin'

const article = {
  communityRef: 'home',
  articleRef: 'article-1',
  articleRevision: 'revision-1',
  thread: 'post' as const,
  canonicalPath: '/home/post/1',
  canonicalOrigin: 'https://groupher.com',
  canonicalUrl: 'https://groupher.com/home/post/1',
  title: 'Hello',
  markdown: '# Hello\n',
  publishedAt: '2026-08-01T10:00:00Z',
  updatedAt: '2026-08-01T10:00:00Z',
  tags: [],
  visibility: 'public' as const,
}

const origin = {
  article: vi.fn(async () => article),
  communityFeed: vi.fn(),
  threadFeed: vi.fn(),
  siteManifest: vi.fn(),
} satisfies Origin

const createTestCache = (): OutputCache => {
  const values = new Map<string, CachedOutput>()
  return {
    async get(key) {
      const value = values.get(key)
      return value && value.expiresAt > new Date() ? value : null
    },
    async set(key, value) {
      values.set(key, value)
    },
    async invalidate(prefix) {
      for (const key of values.keys()) if (key.startsWith(prefix)) values.delete(key)
    },
  }
}

const feed = {
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
    feedType: 'digest' as const,
    feedCount: 20,
    feedThreads: ['post' as const],
    llmsEnabled: true,
    sitemapEnabled: true,
    revision: 1,
  },
  configRevision: 1,
  feedRevision: 'feed-revision-1',
  items: [
    {
      articleRef: article.articleRef,
      articleRevision: article.articleRevision,
      thread: article.thread,
      title: article.title,
      canonicalUrl: article.canonicalUrl,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      tags: [],
    },
  ],
}

describe('Press HTTP app', () => {
  const serviceTokenVerifier = {
    verify: vi.fn().mockResolvedValue({
      audience: 'press:internal-api',
      scopes: new Set(['press:cache:invalidate']),
      subject: 'service:phoenix',
      tokenId: 'test-token-id',
    }),
  }

  it('exposes the shared backend health contract', async () => {
    const app = createApp({ origin, cache: createTestCache(), recorder: { record: vi.fn() } })
    const response = await app.request('https://press.test/health')
    const body = (await response.json()) as {
      schemaVersion: string
      service: string
      status: string
    }

    expect(body.schemaVersion).toBe('health.v1')
    expect(body.service).toBe('press')
    expect(body.status).toBe('ok')
  })

  it('keeps a successful response when metric recording throws synchronously', async () => {
    const app = createApp({
      origin,
      cache: createTestCache(),
      recorder: {
        record() {
          throw new Error('metrics unavailable')
        },
      },
    })

    const response = await app.request('https://press.test/home/post/1.md')

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('# Hello')
  })

  it('keeps the default HTTP entrypoint limited to health and internal invalidation', async () => {
    const app = createApp({
      routes: 'internal',
      origin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
      serviceTokenVerifier,
    })

    expect((await app.request('https://press.test/health')).status).toBe(200)
    expect((await app.request('https://press.test/home/post/1.md')).status).toBe(404)
    expect(
      (await app.request('https://press.test/internal/invalidate', { method: 'POST' })).status,
    ).toBe(401)
  })

  it('keeps the named public entrypoint isolated and disabled by default', async () => {
    origin.article.mockClear()
    const disabledApp = createApp({
      routes: 'public',
      environment: {},
      origin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })

    expect((await disabledApp.request('https://press.test/health')).status).toBe(404)
    expect(
      (await disabledApp.request('https://press.test/internal/invalidate', { method: 'POST' }))
        .status,
    ).toBe(404)
    const disabledResponse = await disabledApp.request('https://press.test/home/post/1.md')
    expect(disabledResponse.status).toBe(503)
    expect(disabledResponse.headers.get('cache-control')).toBe('no-store')
    expect(disabledResponse.headers.get('retry-after')).toBe('60')
    expect(origin.article).not.toHaveBeenCalled()

    const enabledApp = createApp({
      routes: 'public',
      environment: { PRESS_PUBLIC_DISABLED: 'false' },
      origin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })
    expect((await enabledApp.request('https://press.test/home/post/1.md')).status).toBe(200)
  })

  it('serves generic Article Markdown with canonical and conditional headers', async () => {
    const record = vi.fn()
    const app = createApp({ origin, cache: createTestCache(), recorder: { record } })
    const first = await app.request('https://press.test/home/post/1.md')
    expect(first.status).toBe(200)
    expect(await first.text()).toBe('# Hello\n')
    expect(first.headers.get('content-type')).toContain('text/markdown')
    expect(first.headers.get('link')).toContain('rel="canonical"')
    expect(first.headers.get('content-disposition')).toBe('inline')
    expect(first.headers.get('last-modified')).toBe('Sat, 01 Aug 2026 10:00:00 GMT')
    expect(origin.article).toHaveBeenCalledTimes(1)

    const second = await app.request('https://press.test/home/post/1.md', {
      headers: { 'if-none-match': first.headers.get('etag') || '' },
    })
    expect(second.status).toBe(304)
    expect(origin.article).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0][0].responseBytes).toBeGreaterThan(0)
    expect(record.mock.calls[1][0].responseBytes).toBe(0)
    expect(record.mock.calls[1][0].cacheStatus).toBe('hit')
  })

  it('negative-caches missing public content briefly', async () => {
    const missingOrigin = {
      ...origin,
      article: vi.fn(async () => {
        const { OriginError } = await import('./origin')
        throw new OriginError('not found', 404)
      }),
    }
    const app = createApp({
      origin: missingOrigin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })

    expect((await app.request('https://press.test/home/post/404.md')).status).toBe(404)
    expect((await app.request('https://press.test/home/post/404.md')).status).toBe(404)
    expect(
      (
        await app.request('https://press.test/home/post/404.md', {
          headers: { 'if-none-match': '*' },
        })
      ).status,
    ).toBe(404)
    expect(missingOrigin.article).toHaveBeenCalledTimes(1)
  })

  it('revalidates compressed weak ETags, tag lists and wildcard conditions', async () => {
    const articleOrigin = { ...origin, article: vi.fn(async () => article) }
    const app = createApp({
      origin: articleOrigin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })
    const first = await app.request('https://press.test/home/post/1.md')
    const tag = first.headers.get('etag')

    for (const condition of [`W/${tag}`, `"another-revision", W/${tag}`, '*']) {
      const response = await app.request('https://press.test/home/post/1.md', {
        headers: { 'if-none-match': condition },
      })
      expect(response.status).toBe(304)
      expect(await response.text()).toBe('')
    }

    const changed = await app.request('https://press.test/home/post/1.md', {
      headers: { 'if-none-match': 'W/"another-revision"' },
    })
    expect(changed.status).toBe(200)
    expect(await changed.text()).toBe('# Hello\n')
    expect(articleOrigin.article).toHaveBeenCalledTimes(1)
  })

  it('renders RSS, Atom and JSON Feed from the same origin DTO', async () => {
    const feedOrigin = {
      ...origin,
      communityFeed: vi.fn(async () => feed),
    }
    const app = createApp({
      origin: feedOrigin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })

    const rss = await app.request('https://press.test/home/feed.xml')
    const atom = await app.request('https://press.test/home/feed.atom')
    const json = await app.request('https://press.test/home/feed.json')

    expect(rss.headers.get('content-type')).toContain('application/rss+xml')
    expect(await rss.text()).toContain('<guid isPermaLink="false">article-1</guid>')
    expect(atom.headers.get('content-type')).toContain('application/atom+xml')
    const jsonBody = (await json.json()) as { items: Array<{ id: string }> }
    expect(jsonBody.items[0].id).toBe('article-1')
    expect(feedOrigin.communityFeed).toHaveBeenCalledTimes(3)
  })

  it('renders site outputs and respects output configuration', async () => {
    const siteOrigin = {
      ...origin,
      siteManifest: vi.fn(async () => ({
        ...feed,
        siteRevision: 'site-revision-1',
        threads: ['post' as const],
      })),
    }
    const app = createApp({
      origin: siteOrigin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })

    expect((await app.request('https://press.test/home/llms.txt')).status).toBe(200)
    expect((await app.request('https://press.test/home/sitemap.xml')).status).toBe(200)

    siteOrigin.siteManifest.mockResolvedValueOnce({
      ...feed,
      config: { ...feed.config, llmsEnabled: false },
      siteRevision: 'site-revision-2',
      threads: ['post'],
    })
    const disabledApp = createApp({
      origin: siteOrigin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })
    expect((await disabledApp.request('https://press.test/home/llms.txt')).status).toBe(404)
  })

  it('validates community-scoped internal invalidation requests', async () => {
    const cache = createTestCache()
    const invalidate = vi.spyOn(cache, 'invalidate')
    const app = createApp({ origin, cache, recorder: { record: vi.fn() }, serviceTokenVerifier })

    expect(
      (
        await app.request('https://press.test/internal/invalidate', {
          method: 'POST',
          body: JSON.stringify({ community: '../cms' }),
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer test-token',
          },
        })
      ).status,
    ).toBe(400)

    expect(
      (
        await app.request('https://press.test/internal/invalidate', {
          method: 'POST',
          body: JSON.stringify({ community: 'home' }),
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer test-token',
          },
        })
      ).status,
    ).toBe(200)
    expect(invalidate).toHaveBeenCalledWith('pointer:home:')

    expect(
      (
        await app.request('https://press.test/internal/invalidate', {
          method: 'POST',
          body: JSON.stringify({ community: 'home' }),
          headers: { 'content-type': 'application/json' },
        })
      ).status,
    ).toBe(401)
    vi.unstubAllEnvs()
  })

  it('returns 403 when a valid service token lacks the invalidation scope', async () => {
    const app = createApp({
      origin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
      serviceTokenVerifier: {
        verify: vi.fn().mockRejectedValue(new ServiceTokenAuthorizationError('scope', 403)),
      },
    })

    const response = await app.request('https://press.test/internal/invalidate', {
      body: JSON.stringify({ community: 'home' }),
      headers: { authorization: 'Bearer valid-token-without-scope' },
      method: 'POST',
    })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'forbidden' })
  })

  it('uses the same handler for Docs Markdown routes', async () => {
    const docOrigin = {
      ...origin,
      article: vi.fn(async () => ({ ...article, thread: 'doc' as const })),
    }
    const app = createApp({
      origin: docOrigin,
      cache: createTestCache(),
      recorder: { record: vi.fn() },
    })
    const response = await app.request('https://press.test/home/doc/8/getting-started.md')
    expect(response.status).toBe(200)
    expect(docOrigin.article).toHaveBeenCalledWith({
      community: 'home',
      thread: 'doc',
      innerId: '8',
    })
  })
})
