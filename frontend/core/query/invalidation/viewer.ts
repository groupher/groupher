import { viewerQueryKeys } from '../key'
import type { TQueryInvalidationPlan, TQueryInvalidationTarget } from './types'

const prefix = (key: readonly unknown[]) => (queryKey: readonly unknown[]) =>
  key.every((part, index) => queryKey[index] === part)

/** Invalidates viewer-specific article state for an account. */
export const articleState = (accountRef: string): TQueryInvalidationTarget => ({
  domain: 'viewer',
  target: 'article-state',
  accountRef,
})

/** Invalidates viewer-specific comment state for an account and article. */
export const commentState = (accountRef: string, articleKey: string): TQueryInvalidationTarget => ({
  domain: 'viewer',
  target: 'comment-state',
  accountRef,
  articleKey,
})

/** Resolves a viewer invalidation target into query-key matchers. */
export const resolve = (target: TQueryInvalidationTarget): TQueryInvalidationPlan => {
  if (target.domain !== 'viewer') return { matches: [], refetch: 'active' }

  const key =
    target.target === 'article-state'
      ? viewerQueryKeys.articleStatePrefix(target.accountRef)
      : viewerQueryKeys.commentStatePrefix(target.accountRef, target.articleKey)

  return {
    matches: [{ domain: target.domain, target: target.target, matches: prefix(key) }],
    refetch: 'active',
  }
}
