import type { TRateLimitBinding } from '../rate-limit'

const MAX_REQUESTS = 10

export type TResettableRateLimiter = TRateLimitBinding & {
  reset: () => void
}

export const createE2ERateLimiter = (): TResettableRateLimiter => {
  const counts = new Map<string, number>()

  return {
    async limit({ key }) {
      const count = (counts.get(key) || 0) + 1
      counts.set(key, count)
      return { success: count <= MAX_REQUESTS }
    },
    reset() {
      counts.clear()
    },
  }
}
