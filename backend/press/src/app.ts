import { createHash } from 'node:crypto'

import { createHealthResponse } from '@groupher/service/health'
import { Hono } from 'hono'

import type { CachedOutput, OutputCache } from './cache'
import { createOutputCache } from './cache'
import { createDatabase } from './db/client'
import { startRetention } from './db/retention'
import {
  classifyBot,
  classifyUa,
  createMetricRecorder,
  hashClientIp,
  requestId,
  type MetricEvent,
} from './metrics'
import { createPhoenixOrigin, OriginError, type Origin } from './origin'
import { renderAtom, renderJSONFeed, renderLlms, renderRSS, renderSitemap } from './render'
import type { OutputKind, Thread } from './types'

const RENDERER_VERSION = 'press-v1'
const POINTER_TTL_MS = 60_000
const OUTPUT_TTL_MS = 24 * 60 * 60_000
const NEGATIVE_TTL_MS = 15_000
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024
const THREADS = new Set<Thread>(['post', 'blog', 'changelog', 'doc'])

type Dependencies = {
  origin?: Origin
  cache?: OutputCache
  recorder?: ReturnType<typeof createMetricRecorder>
}

type Rendered = {
  body: string
  contentType: string
  revision: string
  updatedAt?: string
  canonicalUrl?: string
  contentRef?: string
  thread?: Thread
}

const etag = (revision: string): string =>
  `"${createHash('sha256').update(`${revision}:${RENDERER_VERSION}`).digest('base64url')}"`

const outputHeaders = (rendered: Rendered): Record<string, string> => ({
  'cache-control': 'public, max-age=60',
  'content-type': rendered.contentType,
  etag: etag(rendered.revision),
  'x-content-type-options': 'nosniff',
  ...(rendered.updatedAt ? { 'last-modified': new Date(rendered.updatedAt).toUTCString() } : {}),
  ...(rendered.contentType.startsWith('text/markdown') ? { 'content-disposition': 'inline' } : {}),
  ...(rendered.canonicalUrl ? { link: `<${rendered.canonicalUrl}>; rel="canonical"` } : {}),
})

const responseFrom = (request: Request, output: CachedOutput): Response => {
  if (request.headers.get('if-none-match') === output.headers.etag) {
    return new Response(null, { status: 304, headers: output.headers })
  }
  return new Response(output.body, { status: output.status, headers: output.headers })
}

export const createApp = (dependencies: Dependencies = {}) => {
  const database = createDatabase()
  startRetention(database)
  const origin = dependencies.origin || createPhoenixOrigin()
  const cache = dependencies.cache || createOutputCache(database)
  const recorder = dependencies.recorder || createMetricRecorder(database)
  const app = new Hono()

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'press' })))

  const serve = async <T>(
    request: Request,
    community: string,
    kind: OutputKind,
    routeKey: string,
    load: () => Promise<T>,
    render: (data: T) => Rendered,
  ): Promise<Response> => {
    const started = performance.now()
    let originDurationMs = 0
    let renderDurationMs = 0
    let cacheStatus: MetricEvent['cacheStatus'] = 'miss'
    let renderedMeta: Partial<Rendered> = {}
    let response: Response

    try {
      const pointerKey = `pointer:${community}:${kind}:${routeKey}:${RENDERER_VERSION}`
      const pointer = await cache.get(pointerKey)
      if (pointer) {
        const output = await cache.get(pointer.body)
        if (output) {
          cacheStatus = 'hit'
          renderedMeta = { ...output.metadata, body: output.body }
          response = responseFrom(request, output)
          record(response)
          return response
        }
      }

      const originStarted = performance.now()
      const data = await load()
      originDurationMs = Math.round(performance.now() - originStarted)
      const renderStarted = performance.now()
      const rendered = render(data)
      const headers = outputHeaders(rendered)
      const responseBytes = new TextEncoder().encode(rendered.body).byteLength
      if (responseBytes > MAX_OUTPUT_BYTES) throw new Error('Press output exceeds size limit')
      renderDurationMs = Math.round(performance.now() - renderStarted)
      renderedMeta = rendered
      const immutableKey = `output:${community}:${kind}:${rendered.thread || ''}:${rendered.contentRef || ''}:${rendered.revision}:${RENDERER_VERSION}`
      const output: CachedOutput = {
        status: 200,
        body: rendered.body,
        headers,
        metadata: {
          ...(rendered.contentRef ? { contentRef: rendered.contentRef } : {}),
          ...(rendered.thread ? { thread: rendered.thread } : {}),
          revision: rendered.revision,
        },
        expiresAt: new Date(Date.now() + OUTPUT_TTL_MS),
      }
      await cache.set(immutableKey, output)
      await cache.set(pointerKey, {
        status: 200,
        body: immutableKey,
        headers: {},
        expiresAt: new Date(Date.now() + POINTER_TTL_MS),
      })
      response = responseFrom(request, output)
    } catch (error) {
      const status = error instanceof OriginError ? error.status : 500
      const message = error instanceof Error ? error.message : ''
      const body =
        status === 404
          ? 'Not found\n'
          : message === 'Press output exceeds size limit'
            ? 'Press output rendering failed\n'
            : 'Press origin unavailable\n'
      const output: CachedOutput = {
        status,
        body,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': status === 404 ? 'public, max-age=15' : 'no-store',
          'x-content-type-options': 'nosniff',
        },
        expiresAt: new Date(Date.now() + NEGATIVE_TTL_MS),
      }
      if (status === 404) {
        const pointerKey = `pointer:${community}:${kind}:${routeKey}:${RENDERER_VERSION}`
        const negativeKey = `negative:${community}:${kind}:${routeKey}:${RENDERER_VERSION}`
        await cache.set(negativeKey, output)
        await cache.set(pointerKey, {
          status: 404,
          body: negativeKey,
          headers: {},
          expiresAt: output.expiresAt,
        })
      }
      renderedMeta = { ...renderedMeta, body: output.body }
      response = responseFrom(request, output)
    }

    record(response)
    return response

    function record(result: Response) {
      const bodyLength =
        result.status === 304
          ? 0
          : Number(result.headers.get('content-length')) ||
            (renderedMeta.body ? new TextEncoder().encode(renderedMeta.body).byteLength : 0)
      const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      recorder.record({
        requestTimeUtc: new Date(),
        communityRef: community,
        thread: renderedMeta.thread,
        contentRef: renderedMeta.contentRef,
        outputKind: kind,
        statusCode: result.status,
        cacheStatus,
        durationMs: Math.round(performance.now() - started),
        originDurationMs,
        renderDurationMs,
        responseBytes: bodyLength,
        botFamily: classifyBot(request.headers.get('user-agent') || ''),
        uaFamily: classifyUa(request.headers.get('user-agent') || ''),
        clientIpHash: hashClientIp(forwarded),
        requestId: requestId(request.headers.get('x-request-id') || undefined),
        revision: renderedMeta.revision,
      })
    }
  }

  const markdown = async (request: Request, community: string, thread: Thread, innerId: string) =>
    serve(
      request,
      community,
      'markdown',
      `${thread}:${innerId}`,
      () => origin.article({ community, thread, innerId }),
      (article) => ({
        body: article.markdown,
        contentType: 'text/markdown; charset=utf-8',
        revision: article.articleRevision,
        updatedAt: article.updatedAt,
        canonicalUrl: article.canonicalUrl,
        contentRef: article.articleRef,
        thread,
      }),
    )

  app.get('/:community/doc/:id/:slug{.+\\.md}', (context) =>
    markdown(context.req.raw, context.req.param('community'), 'doc', context.req.param('id')),
  )
  app.get('/:community/:thread/:id{.+\\.md}', (context) => {
    const thread = context.req.param('thread') as Thread
    if (!THREADS.has(thread)) return context.notFound()
    return markdown(
      context.req.raw,
      context.req.param('community'),
      thread,
      context.req.param('id').replace(/\.md$/, ''),
    )
  })

  const feed = (
    request: Request,
    community: string,
    format: 'rss' | 'atom' | 'json_feed',
    thread?: Thread,
  ) =>
    serve(
      request,
      community,
      format,
      thread || 'community',
      () => (thread ? origin.threadFeed(community, thread) : origin.communityFeed(community)),
      (data) => ({
        body:
          format === 'rss'
            ? renderRSS(data)
            : format === 'atom'
              ? renderAtom(data)
              : renderJSONFeed(data),
        contentType:
          format === 'json_feed'
            ? 'application/feed+json; charset=utf-8'
            : format === 'atom'
              ? 'application/atom+xml; charset=utf-8'
              : 'application/rss+xml; charset=utf-8',
        revision: data.feedRevision,
        updatedAt: data.items.reduce<string | undefined>(
          (latest, item) => (!latest || item.updatedAt > latest ? item.updatedAt : latest),
          undefined,
        ),
        thread,
      }),
    )

  app.get('/:community/feed.xml', (c) => feed(c.req.raw, c.req.param('community'), 'rss'))
  app.get('/:community/feed.atom', (c) => feed(c.req.raw, c.req.param('community'), 'atom'))
  app.get('/:community/feed.json', (c) => feed(c.req.raw, c.req.param('community'), 'json_feed'))
  app.get('/:community/:thread/feed.xml', (c) =>
    THREADS.has(c.req.param('thread') as Thread)
      ? feed(c.req.raw, c.req.param('community'), 'rss', c.req.param('thread') as Thread)
      : c.notFound(),
  )

  const site = (request: Request, community: string, kind: 'llms' | 'sitemap') =>
    serve(
      request,
      community,
      kind,
      kind,
      () => origin.siteManifest(community),
      (manifest) => {
        if (kind === 'llms' && !manifest.config.llmsEnabled)
          throw new OriginError('llms disabled', 404)
        if (kind === 'sitemap' && !manifest.config.sitemapEnabled)
          throw new OriginError('sitemap disabled', 404)
        return {
          body: kind === 'llms' ? renderLlms(manifest) : renderSitemap(manifest),
          contentType:
            kind === 'llms' ? 'text/plain; charset=utf-8' : 'application/xml; charset=utf-8',
          revision: manifest.siteRevision,
          updatedAt: manifest.items.reduce<string | undefined>(
            (latest, item) => (!latest || item.updatedAt > latest ? item.updatedAt : latest),
            undefined,
          ),
        }
      },
    )

  app.get('/:community/llms.txt', (c) => site(c.req.raw, c.req.param('community'), 'llms'))
  app.get('/:community/sitemap.xml', (c) => site(c.req.raw, c.req.param('community'), 'sitemap'))

  app.post('/internal/invalidate', async (context) => {
    const expectedToken = process.env.PRESS_INTERNAL_TOKEN?.trim()
    const providedToken = context.req.header('x-press-internal-token')
    if (!expectedToken || providedToken !== expectedToken)
      return context.json({ error: 'unauthorized' }, 401)

    const body = await context.req
      .json<{ community?: string }>()
      .catch((): { community?: string } => ({}))
    if (!body.community || !/^[a-z0-9][a-z0-9-]*$/.test(body.community))
      return context.json({ error: 'invalid community' }, 400)
    await cache.invalidate(`pointer:${body.community}:`)
    return context.json({ ok: true })
  })

  return app
}

export default createApp()
