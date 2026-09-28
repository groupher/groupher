/**
 * Resolves typed Article invalidation targets into precise TanStack Query matches.
 *
 *   domain invalidation target
 *     -> Article path/list scope matcher
 *     -> existing detail, list, or stats query keys
 *     -> shared invalidation executor
 *
 * Matchers stay private here; mutation-time cache patching is owned by `articleStatsCache`.
 */
import { THREAD } from '~/const/thread'
import type { TThread } from '~/spec'

import type { TArticlePath } from '../articlePath'
import { articleStatsCache } from '../articleStats'
import { articleQueryKeys } from '../key'
import type {
  TArticleListScope,
  TQueryInvalidationPlan,
  TQueryInvalidationTarget,
  TQueryMatch,
} from './types'

const prefixMatches = (queryKey: readonly unknown[], prefix: readonly unknown[]): boolean =>
  prefix.every((part, index) => queryKey[index] === part)

const isStatsBatch = (queryKey: readonly unknown[]): boolean =>
  queryKey[0] === articleQueryKeys.all[0] &&
  queryKey[1] === 'article-stats' &&
  typeof queryKey[2] === 'string' &&
  typeof queryKey[3] === 'string' &&
  Array.isArray(queryKey[4])

const statsBatchMatchesScope = (
  queryKey: readonly unknown[],
  community: string,
  thread: TThread,
): boolean => isStatsBatch(queryKey) && queryKey[2] === community && queryKey[3] === thread

const articleListMatches = (scope: TArticleListScope) => (queryKey: readonly unknown[]) => {
  const family = queryKey[1]
  const filter = queryKey[2]
  if (
    queryKey[0] !== articleQueryKeys.all[0] ||
    !['posts', 'changelogs'].includes(String(family)) ||
    !filter ||
    typeof filter !== 'object'
  ) {
    return false
  }

  if ((filter as { community?: string }).community !== scope.community) return false
  if (!scope.thread) return true
  return scope.thread === THREAD.CHANGELOG ? family === 'changelogs' : family === 'posts'
}

const targetMatch = (
  target: TQueryInvalidationTarget,
  matches: (queryKey: readonly unknown[]) => boolean,
): TQueryMatch => ({ domain: target.domain, target: target.target, matches })

/** Invalidates the exact public ArticleStats query and matching batch entries. */
export const stats = (path: TArticlePath): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'stats',
  path,
})

/** Invalidates all ArticleStats batch queries for a community and thread. */
export const statsBatch = (community: string, thread: TThread): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'stats-batch',
  community,
  thread,
})

/** Invalidates the exact public article content query. */
export const content = (path: TArticlePath): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'content',
  path,
})

/** Invalidates article list queries covered by a community/thread scope. */
export const lists = (scope: TArticleListScope): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'lists',
  scope,
})

/** Invalidates the tag-group query for a community and thread. */
export const tagGroups = (community: string, thread: TThread): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'tag-groups',
  community,
  thread,
})

/** Resolves an article invalidation target into query-key matchers. */
export const resolve = (target: TQueryInvalidationTarget): TQueryInvalidationPlan => {
  if (target.domain !== 'article') return { matches: [], refetch: 'active' }

  if (target.target === 'stats') {
    return {
      matches: [
        targetMatch(target, (queryKey) => articleStatsCache.contains(queryKey, target.path)),
      ],
      refetch: 'active',
    }
  }

  if (target.target === 'stats-batch') {
    return {
      matches: [
        targetMatch(target, (queryKey) =>
          statsBatchMatchesScope(queryKey, target.community, target.thread),
        ),
      ],
      refetch: 'active',
    }
  }

  if (target.target === 'content') {
    const exact = articleQueryKeys.detail(
      target.path.community,
      target.path.thread,
      target.path.innerId,
    )
    return {
      matches: [
        targetMatch(
          target,
          (queryKey) => prefixMatches(queryKey, exact) && queryKey.length === exact.length,
        ),
      ],
      refetch: 'active',
    }
  }

  if (target.target === 'lists') {
    return {
      matches: [targetMatch(target, articleListMatches(target.scope))],
      refetch: 'active',
    }
  }

  const exact = articleQueryKeys.tagGroups(target.community, target.thread)
  return {
    matches: [
      targetMatch(
        target,
        (queryKey) => prefixMatches(queryKey, exact) && queryKey.length === exact.length,
      ),
    ],
    refetch: 'active',
  }
}
