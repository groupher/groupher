import type { TThread } from '~/spec'

import { articleKeys } from '../key'
import type {
  TArticleInvalidationRef,
  TArticleListScope,
  TQueryInvalidationPlan,
  TQueryInvalidationTarget,
  TQueryMatch,
} from './types'

const prefixMatches = (queryKey: readonly unknown[], prefix: readonly unknown[]): boolean =>
  prefix.every((part, index) => queryKey[index] === part)

const statsBatchContains = (ref: TArticleInvalidationRef) => (queryKey: readonly unknown[]) =>
  articleKeys.matchesStatsBatch(queryKey, ref.community, ref.thread, ref.innerId)

const articleListMatches = (scope: TArticleListScope) => (queryKey: readonly unknown[]) =>
  articleKeys.matchesArticleList(queryKey, scope.community, scope.thread)

const targetMatch = (
  target: TQueryInvalidationTarget,
  matches: (queryKey: readonly unknown[]) => boolean,
): TQueryMatch => ({ domain: target.domain, target: target.target, matches })

/** Invalidates the exact public ArticleStats query and matching batch entries. */
export const stats = (ref: TArticleInvalidationRef): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'stats',
  ref,
})

/** Invalidates all ArticleStats batch queries for a community and thread. */
export const statsBatch = (community: string, thread: TThread): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'stats-batch',
  community,
  thread,
})

/** Invalidates the exact public article content query. */
export const content = (ref: TArticleInvalidationRef): TQueryInvalidationTarget => ({
  domain: 'article',
  target: 'content',
  ref,
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
    const exact = articleKeys.stats(target.ref.community, target.ref.thread, target.ref.innerId)
    return {
      matches: [
        targetMatch(
          target,
          (queryKey) => prefixMatches(queryKey, exact) && queryKey.length === exact.length,
        ),
        targetMatch(target, statsBatchContains(target.ref)),
      ],
      refetch: 'active',
    }
  }

  if (target.target === 'stats-batch') {
    return {
      matches: [
        targetMatch(target, (queryKey) =>
          articleKeys.matchesStatsBatchScope(queryKey, target.community, target.thread),
        ),
      ],
      refetch: 'active',
    }
  }

  if (target.target === 'content') {
    const exact = articleKeys.detail(target.ref.community, target.ref.thread, target.ref.innerId)
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

  const exact = articleKeys.tagGroups(target.community, target.thread)
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
