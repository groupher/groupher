export type TRateLimitBinding = {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

const WINDOW_MS = 60_000
const MAX_REQUESTS = 10
const MAX_KEYS = 10_000

type TBucket = { count: number; resetAt: number }

/** Bounded development/Node fallback; production Workers use the native binding. */
export const createMemoryRateLimiter = (): TRateLimitBinding => {
  const buckets = new Map<string, TBucket>()

  return {
    async limit({ key }) {
      const now = Date.now()
      const current = buckets.get(key)
      const bucket =
        !current || current.resetAt <= now ? { count: 0, resetAt: now + WINDOW_MS } : current

      bucket.count += 1
      buckets.delete(key)
      buckets.set(key, bucket)

      while (buckets.size > MAX_KEYS) {
        const oldestKey = buckets.keys().next().value
        if (typeof oldestKey !== 'string') break
        buckets.delete(oldestKey)
      }

      return { success: bucket.count <= MAX_REQUESTS }
    },
  }
}
