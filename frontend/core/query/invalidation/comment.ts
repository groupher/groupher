import type { TArticlePath } from '../articlePath'
import { commentKeys } from '../key'
import type { TQueryInvalidationPlan, TQueryInvalidationTarget } from './types'

/** Invalidates the comment list for one article. */
export const list = (path: TArticlePath): TQueryInvalidationTarget => ({
  domain: 'comment',
  target: 'list',
  path,
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
            target.path.community,
            target.path.thread,
            target.path.innerId,
          ),
      },
    ],
    refetch: 'active',
  }
}
