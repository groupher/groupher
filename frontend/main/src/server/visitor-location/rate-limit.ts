import 'server-only'

type TBucket = { tokens: number; updatedAt: number }

const buckets = new Map<string, TBucket>()
const COMMUNITY_CAPACITY = 30
const GLOBAL_CAPACITY = 90
const REFILL_WINDOW_MS = 60_000

const take = (key: string, capacity: number, now: number): boolean => {
  const previous = buckets.get(key) ?? { tokens: capacity, updatedAt: now }
  const replenished = Math.min(
    capacity,
    previous.tokens + ((now - previous.updatedAt) / REFILL_WINDOW_MS) * capacity,
  )

  if (replenished < 1) {
    buckets.set(key, { tokens: replenished, updatedAt: now })
    return false
  }

  buckets.set(key, { tokens: replenished - 1, updatedAt: now })

  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.updatedAt > REFILL_WINDOW_MS * 2) buckets.delete(bucketKey)
    }
  }

  return true
}

/** Applies both global and per-community limits to a visitor-location request. */
export const allowVisitorLocationRequest = (ip: string, community: string, now = Date.now()) =>
  take(`global:${ip}`, GLOBAL_CAPACITY, now) &&
  take(`community:${ip}:${community}`, COMMUNITY_CAPACITY, now)
