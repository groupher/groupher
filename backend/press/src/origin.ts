import { createServiceAuthClientFromEnv, type TServiceAuthClient } from '@groupher/service/auth'

import type { PressArticle, PressConfig, RSSFeed, SiteManifest, Thread } from './types'

type GraphQLError = { message: string; code?: number | string }
type GraphQLResponse<T> = { data?: T; errors?: GraphQLError[] }

const NOT_EXIST_CODES = new Set([4003, '4003', 'NOT_EXIST', 'not_exist'])

const normalizeThread = (thread: string): Thread => thread.toLowerCase() as Thread

const normalizeConfig = (config: PressConfig): PressConfig => ({
  ...config,
  feedType: String(config.feedType).toLowerCase() as PressConfig['feedType'],
  feedThreads: config.feedThreads.map((thread) => normalizeThread(thread)),
})

const normalizeArticle = (article: PressArticle): PressArticle => ({
  ...article,
  thread: normalizeThread(article.thread),
})

const normalizeFeed = (feed: RSSFeed): RSSFeed => ({
  ...feed,
  config: normalizeConfig(feed.config),
  thread: feed.thread ? normalizeThread(feed.thread) : undefined,
  items: feed.items.map((item) => ({ ...item, thread: normalizeThread(item.thread) })),
})

const normalizeSiteManifest = (manifest: SiteManifest): SiteManifest => ({
  ...manifest,
  config: normalizeConfig(manifest.config),
  threads: manifest.threads.map(normalizeThread),
  items: manifest.items.map((item) => ({ ...item, thread: normalizeThread(item.thread) })),
})

export class OriginError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type Origin = {
  article(input: { community: string; thread: Thread; innerId: string }): Promise<PressArticle>
  communityFeed(community: string): Promise<RSSFeed>
  threadFeed(community: string, thread: Thread): Promise<RSSFeed>
  siteManifest(community: string): Promise<SiteManifest>
}

const ARTICLE_QUERY = `query PressArticle($article: ArticlePathInput!) {
  pressArticle(article: $article) {
    communityRef articleRef articleRevision thread canonicalPath canonicalOrigin canonicalUrl
    title subtitle markdown html digest bodyHash publishedAt updatedAt visibility
    author { login name avatar } tags { slug title }
  }
}`

const FEED_FIELDS = `community { publicRef slug title description locale canonicalOrigin canonicalPath }
  config { markdownEnabled feedEnabled feedType feedCount feedThreads llmsEnabled sitemapEnabled revision }
  configRevision feedRevision
  items { articleRef articleRevision thread title digest html canonicalUrl publishedAt updatedAt author { login name avatar } tags { slug title } }`

const COMMUNITY_FEED_QUERY = `query PressCommunityFeed($community: String!, $input: PressCommunityRSSFeedInput!) {
  pressCommunityRSSFeed: pressCommunityRssFeed(community: $community, input: $input) { ${FEED_FIELDS} }
}`

const THREAD_FEED_QUERY = `query PressThreadFeed($community: String!, $thread: Thread!, $input: PressThreadRSSFeedInput!) {
  pressThreadRSSFeed: pressThreadRssFeed(community: $community, thread: $thread, input: $input) {
    ${FEED_FIELDS}
    thread
  }
}`

const SITE_QUERY = `query PressSite($community: String!) {
  pressSiteManifest(community: $community) {
    community { publicRef slug title description locale canonicalOrigin canonicalPath }
    config { markdownEnabled feedEnabled feedType feedCount feedThreads llmsEnabled sitemapEnabled revision }
    siteRevision threads
    items { articleRef articleRevision thread title digest html canonicalUrl publishedAt updatedAt author { login name avatar } tags { slug title } }
  }
}`

export const createPhoenixOrigin = (
  endpoint = process.env.PHOENIX_GRAPHQL_ENDPOINT || 'http://127.0.0.1:4001/graphiql',
  fetcher: typeof fetch = fetch,
  tokenProvider?: TServiceAuthClient,
): Origin => {
  let activeTokenProvider = tokenProvider
  const query = async <T>(
    document: string,
    variables: Record<string, unknown>,
    scope: string,
  ): Promise<T> => {
    let response: Response
    try {
      activeTokenProvider ??= createServiceAuthClientFromEnv(process.env, fetcher)
      const token = await activeTokenProvider.getToken({
        resource: process.env.PHOENIX_PRESS_RESOURCE || 'https://api.groupher.com/press',
        scopes: [scope],
      })
      response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-groupher-client': 'press-v2',
        },
        body: JSON.stringify({ query: document, variables }),
        signal: AbortSignal.timeout(5_000),
      })
    } catch (error) {
      throw new OriginError(error instanceof Error ? error.message : 'Phoenix unavailable', 503)
    }

    if (!response.ok) throw new OriginError(`Phoenix returned ${response.status}`, 502)
    const payload = (await response.json()) as GraphQLResponse<T>
    if (payload.errors?.length) {
      const message = payload.errors.map((error) => error.message).join('; ')
      const isNotFound = payload.errors.some(
        (error) => error.code !== undefined && NOT_EXIST_CODES.has(error.code),
      )
      const status = isNotFound || /not exist|disabled|not found/i.test(message) ? 404 : 502
      throw new OriginError(message, status)
    }
    if (!payload.data) throw new OriginError('Phoenix returned no data', 502)
    return payload.data
  }

  return {
    async article(input) {
      const data = await query<{ pressArticle: PressArticle | null }>(
        ARTICLE_QUERY,
        {
          article: {
            community: input.community,
            thread: input.thread.toUpperCase(),
            innerId: input.innerId,
          },
        },
        'press:article:read',
      )
      if (!data.pressArticle) throw new OriginError('Press Article not found', 404)
      return normalizeArticle(data.pressArticle)
    },
    async communityFeed(community) {
      const data = await query<{ pressCommunityRSSFeed: RSSFeed | null }>(
        COMMUNITY_FEED_QUERY,
        { community, input: {} },
        'press:rss-feed:read',
      )
      if (!data.pressCommunityRSSFeed) throw new OriginError('Press Feed not found', 404)
      return normalizeFeed(data.pressCommunityRSSFeed)
    },
    async threadFeed(community, thread) {
      const data = await query<{ pressThreadRSSFeed: RSSFeed | null }>(
        THREAD_FEED_QUERY,
        { community, input: {}, thread: thread.toUpperCase() },
        'press:rss-feed:read',
      )
      if (!data.pressThreadRSSFeed) throw new OriginError('Press Feed not found', 404)
      return normalizeFeed(data.pressThreadRSSFeed)
    },
    async siteManifest(community) {
      const data = await query<{ pressSiteManifest: SiteManifest | null }>(
        SITE_QUERY,
        { community },
        'press:site:read',
      )
      if (!data.pressSiteManifest) throw new OriginError('Press Site not found', 404)
      return normalizeSiteManifest(data.pressSiteManifest)
    },
  }
}
