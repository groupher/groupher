/** Marks a failure raised by a narrowly scoped optimistic cache boundary. */
export class OptimisticCacheError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'OptimisticCacheError'
  }
}

/** Checks whether an exception is eligible for cache-only optimistic degradation. */
export const isOptimisticCacheError = (error: unknown): error is OptimisticCacheError =>
  error instanceof OptimisticCacheError

/** Wraps a cache-boundary exception while retaining its original cause. */
export const asOptimisticCacheError = (error: unknown): OptimisticCacheError =>
  error instanceof OptimisticCacheError
    ? error
    : new OptimisticCacheError('Optimistic cache preparation failed', { cause: error })

/** Wraps only a domain-owned cache calculation, leaving unrelated operation errors untouched. */
export const prepareOptimisticCache = <T>(prepare: () => T): T => {
  try {
    return prepare()
  } catch (error) {
    throw asOptimisticCacheError(error)
  }
}

/** Marks the setter/notification boundary where a prepared cache write can fail. */
export const commitOptimisticCache = (commit: () => void): void => {
  try {
    commit()
  } catch (error) {
    throw asOptimisticCacheError(error)
  }
}
