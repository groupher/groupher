import { viewerQueryKeys } from '../key'
import type { TQueryInvalidationPlan, TQueryInvalidationTarget } from './types'

const prefix = (key: readonly unknown[]) => (queryKey: readonly unknown[]) =>
  key.every((part, index) => queryKey[index] === part)

/** Invalidates viewer-specific article state for an account. */
export const articleState = (accountScope: string): TQueryInvalidationTarget => ({
  domain: 'viewer',
  target: 'article-state',
  accountScope,
})

/** Invalidates viewer-specific comment state for an account and article. */
export const commentState = (
  accountScope: string,
  articleKey: string,
): TQueryInvalidationTarget => ({
  domain: 'viewer',
  target: 'comment-state',
  accountScope,
  articleKey,
})

/** Resolves a viewer invalidation target into query-key matchers. */
export const resolve = (target: TQueryInvalidationTarget): TQueryInvalidationPlan => {
  if (target.domain !== 'viewer') return { matches: [], refetch: 'active' }

  const key =
    target.target === 'article-state'
      ? viewerQueryKeys.articleStatePrefix(target.accountScope)
      : viewerQueryKeys.commentStatePrefix(target.accountScope, target.articleKey)

  return {
    matches: [{ domain: target.domain, target: target.target, matches: prefix(key) }],
    refetch: 'active',
  }
}
