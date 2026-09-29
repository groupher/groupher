import type { QueryClient } from '@tanstack/react-query'

import { resolve as resolveArticle } from './article'
import { resolve as resolveComment } from './comment'
import { resolve as resolveCommunity } from './community'
import type {
  TQueryInvalidationFailure,
  TQueryInvalidationResult,
  TQueryInvalidationTarget,
} from './types'
import { resolve as resolveViewer } from './viewer'

const resolverFor = (target: TQueryInvalidationTarget) => {
  switch (target.domain) {
    case 'article':
      return resolveArticle(target)
    case 'comment':
      return resolveComment(target)
    case 'community':
      return resolveCommunity(target)
    case 'viewer':
      return resolveViewer(target)
  }
}

/** Marks one owner-provided exact query stale without triggering a refetch. */
export const markStale = async (
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' })
}

/** Executes typed invalidation plans without exposing TanStack filters to domains. */
export const invalidate = async (
  queryClient: QueryClient,
  targets: TQueryInvalidationTarget | readonly TQueryInvalidationTarget[],
): Promise<TQueryInvalidationResult> => {
  const normalized = Array.isArray(targets) ? targets : [targets]
  const failures: TQueryInvalidationFailure[] = []
  const matches = normalized.flatMap((target) => {
    try {
      return resolverFor(target).matches
    } catch {
      failures.push({ domain: target.domain, target: target.target, reason: 'resolver' })
      return []
    }
  })
  const queries = queryClient.getQueryCache().findAll()
  const matchedQueries = new Map<
    string,
    { queryKey: readonly unknown[]; refetch: 'active' | 'none' }
  >()
  let rawMatched = 0

  for (const query of queries) {
    for (const match of matches) {
      if (!match.matches(query.queryKey)) continue
      rawMatched += 1
      const key = query.queryHash
      matchedQueries.set(key, { queryKey: query.queryKey, refetch: 'active' })
      break
    }
  }

  let refetched = 0
  await Promise.all(
    [...matchedQueries.values()].map(async ({ queryKey, refetch }) => {
      try {
        const query = queryClient.getQueryCache().find({ queryKey, exact: true })
        if (query?.isActive()) refetched += 1
        await queryClient.invalidateQueries({
          queryKey,
          exact: true,
          refetchType: refetch,
        })
      } catch {
        failures.push({ domain: 'query', target: 'executor', reason: 'executor' })
      }
    }),
  )

  return {
    matched: matchedQueries.size,
    deduped: Math.max(0, rawMatched - matchedQueries.size),
    refetched,
    markedStale: matchedQueries.size,
    failures,
  }
}
