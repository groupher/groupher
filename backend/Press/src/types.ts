export type OutputKind = 'markdown' | 'rss' | 'atom' | 'json_feed' | 'llms' | 'sitemap'
export type Thread = 'post' | 'blog' | 'changelog' | 'doc'

export type PressConfig = {
  markdownEnabled: boolean
  feedEnabled: boolean
  feedType: 'digest' | 'full'
  feedCount: number
  feedThreads: Thread[]
  llmsEnabled: boolean
  sitemapEnabled: boolean
  revision: number
}

export type PressAuthor = { login?: string; name?: string; avatar?: string }
export type PressTag = { slug: string; title: string }

export type PressArticle = {
  communityRef: string
  articleRef: string
  articleRevision: string
  thread: Thread
  canonicalPath: string
  canonicalOrigin: string
  canonicalUrl: string
  title: string
  subtitle?: string
  markdown: string
  html?: string
  digest?: string
  bodyHash?: string
  publishedAt: string
  updatedAt: string
  author?: PressAuthor
  tags: PressTag[]
  visibility: 'public'
}

export type FeedItem = Pick<
  PressArticle,
  | 'articleRef'
  | 'articleRevision'
  | 'thread'
  | 'title'
  | 'digest'
  | 'html'
  | 'canonicalUrl'
  | 'publishedAt'
  | 'updatedAt'
  | 'author'
  | 'tags'
>

export type PressCommunity = {
  publicRef: string
  slug: string
  title: string
  description?: string
  locale: string
  canonicalOrigin: string
  canonicalPath: string
}

export type RSSFeed = {
  community: PressCommunity
  config: PressConfig
  thread?: Thread
  configRevision: number
  feedRevision: string
  items: FeedItem[]
}

export type SiteManifest = {
  community: PressCommunity
  config: PressConfig
  siteRevision: string
  threads: Thread[]
  items: FeedItem[]
}
