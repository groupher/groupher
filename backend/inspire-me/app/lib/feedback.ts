/**
 * Implements the App Lib Feedback boundary inside Inspire Me.
 *
 * Business position:
 *
 *   Research dataset
 *     -> Inspire Me module
 *     -> Vinext / Worker UI
 *     -> researcher
 */

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
const GENERATED_DATA_BASE_PATH = '/feedback-platforms'

/** Returns feedback platforms for the inspire me workflow. */
export async function getFeedbackPlatforms(): Promise<FeedbackPlatformSummary[]> {
  if (platformSummaryCache) return platformSummaryCache

  platformSummaryCache = await getGeneratedData<FeedbackPlatformSummary[]>('index.json')
  return platformSummaryCache
}

/** Returns feedback platform for the inspire me workflow. */
export async function getFeedbackPlatform(platformId: string): Promise<FeedbackPlatform | null> {
  const cached = platformCache.get(platformId)
  if (cached) return cached

  if (!/^[a-z0-9-]+$/.test(platformId)) return null

  const platform = await getGeneratedData<Omit<FeedbackPlatform, 'count'>>(`${platformId}.json`)
  const normalizedPlatform = {
    ...platform,
    count: platform.posts.length,
  }

  platformCache.set(platformId, normalizedPlatform)
  return normalizedPlatform
}

async function getGeneratedData<TData>(fileName: string): Promise<TData> {
  return process.env.NODE_ENV === 'development'
    ? getGeneratedDataFromFile<TData>(fileName)
    : getGeneratedDataFromAsset<TData>(fileName)
}

async function getGeneratedDataFromFile<TData>(fileName: string): Promise<TData> {
  const [{ readFile }, { resolve }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ])
  const data = await readFile(resolve(process.cwd(), 'public/feedback-platforms', fileName), 'utf8')

  return JSON.parse(data) as TData
}

async function getGeneratedDataFromAsset<TData>(fileName: string): Promise<TData> {
  const { env } = await import('cloudflare:workers')
  const path = `${GENERATED_DATA_BASE_PATH}/${fileName}`
  const response = await env.ASSETS.fetch(new Request(`https://assets.local${path}`))

  if (!response.ok) {
    throw new Error(`Failed to load feedback data: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as TData
}
