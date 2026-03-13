import type { TInit as TArticleInit } from '~/stores/article/spec'
import type { TInit as TCommentsInit } from '~/stores/comments/spec'

/**
 * Shared preview payload shape consumed by the generic preview framework.
 * Thread-specific adapters are free to decide how these init snapshots are
 * produced, but the cached reopen path and the real route path must agree on
 * this contract.
 */
export type TPreviewCacheEntry = {
  key: string
  communitySlug: string
  thread: string
  innerId: number
  articleInitData: TArticleInit
  commentsInitData: TCommentsInit
  cachedAt: number
}
