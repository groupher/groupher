/// <reference path="../../cloudflare-workers.d.ts" />
/// <reference path="../vite-env.d.ts" />

export type FeedbackPost = {
  id: string
  titleEn: string
  titleZh: string
  digestEn: string
  digestZh: string
  sourceUrl: string
  upvotes: number
  comments: number | null
}

export type FeedbackPlatform = {
  id: string
  name: string
  count: number
  logoPath: string
  posts: FeedbackPost[]
}

export type FeedbackPlatformSummary = Omit<FeedbackPlatform, 'posts'>

let platformSummaryCache: FeedbackPlatformSummary[] | null = null
const platformCache = new Map<string, FeedbackPlatform>()
const generatedDataBasePath = '/feedback-platforms'

/** Returns the generated feedback platform summaries through the Worker Assets binding. */
export async function getFeedbackPlatforms(): Promise<FeedbackPlatformSummary[]> {
  if (platformSummaryCache) return platformSummaryCache

  platformSummaryCache = await getGeneratedData<FeedbackPlatformSummary[]>('index.json')
  return platformSummaryCache
}

/** Returns one generated feedback platform through the Worker Assets binding. */
export async function getFeedbackPlatform(platformId: string): Promise<FeedbackPlatform | null> {
  const cached = platformCache.get(platformId)
  if (cached) return cached
  if (!/^[a-z0-9-]+$/.test(platformId)) return null

  let platform: Omit<FeedbackPlatform, 'count'>
  try {
    platform = await getGeneratedData<Omit<FeedbackPlatform, 'count'>>(`${platformId}.json`)
  } catch (error) {
    if (error instanceof FeedbackDataNotFound) return null
    throw error
  }
  const normalizedPlatform = { ...platform, count: platform.posts.length }
  platformCache.set(platformId, normalizedPlatform)
  return normalizedPlatform
}

async function getGeneratedData<TData>(fileName: string): Promise<TData> {
  const { env } = await import('cloudflare:workers')
  const path = `${generatedDataBasePath}/${fileName}`
  const assetOrigin = import.meta.env.DEV ? 'http://localhost' : 'https://assets.local'
  const response = await env.ASSETS.fetch(new Request(`${assetOrigin}${path}`))

  if (!response.ok) {
    if (response.status === 404) throw new FeedbackDataNotFound(fileName)
    throw new Error(`Failed to load feedback data: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as TData
}

class FeedbackDataNotFound extends Error {
  constructor(fileName: string) {
    super(`Generated feedback data does not exist: ${fileName}`)
  }
}
