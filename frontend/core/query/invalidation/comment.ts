import { commentKeys } from '../key'
import type {
  TArticleInvalidationRef,
  TQueryInvalidationPlan,
  TQueryInvalidationTarget,
} from './types'

/** Invalidates the comment list for one article. */
export const list = (ref: TArticleInvalidationRef): TQueryInvalidationTarget => ({
  domain: 'comment',
  target: 'list',
  ref,
})

/** Resolves a comment invalidation target into query-key matchers. */
export const resolve = (target: TQueryInvalidationTarget): TQueryInvalidationPlan => {
  if (target.domain !== 'comment' || target.target !== 'list') {
    return { matches: [], refetch: 'active' }
  }

  return {
    matches: [
      {
        domain: target.domain,
        target: target.target,
        matches: (queryKey) =>
          commentKeys.matchesArticle(
            { queryKey },
            target.ref.community,
            target.ref.thread,
            target.ref.innerId,
          ),
      },
    ],
    refetch: 'active',
  }
}
