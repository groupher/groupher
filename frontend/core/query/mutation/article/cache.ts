import type { QueryClient } from '@tanstack/react-query'

import type { TArticle, TArticleStats, TThread } from '~/spec'

import { articleKeys } from '../../key'
import type { TOptimisticChange, TOperationContext, TQueryTarget } from '../optimistic/types'

export type TArticlePath = { community: string; thread: TThread; innerId: string }

/** Derives the stable public path shared by Article Query owners and mutations. */
export const articlePath = (article: TArticle): TArticlePath => ({
  community: article.community.slug,
  thread: article.meta.thread,
  innerId: String(article.innerId),
})

/** Encodes one public Article path as the canonical optimistic entity key. */
export const articleKeyFor = (path: TArticlePath): string =>
  `${path.community}:${path.thread}:${path.innerId}`

const isTarget = (article: Partial<TArticle>, path: TArticlePath): boolean =>
  String(article.innerId) === path.innerId &&
  article.community?.slug === path.community &&
  article.meta?.thread === path.thread

const patchData = (
  value: unknown,
  path: TArticlePath,
  updater: (article: TArticle) => TArticle,
): unknown => {
  if (!value || typeof value !== 'object') return value
  if (isTarget(value as TArticle, path)) return updater(value as TArticle)

  const paged = value as { entries?: TArticle[] }
  if (!Array.isArray(paged.entries)) return value

  let changed = false
  const entries = paged.entries.map((article) => {
    if (!isTarget(article, path)) return article
    changed = true
    return updater(article)
  })
  return changed ? { ...paged, entries } : value
}

const readField = (value: unknown, path: TArticlePath, field: keyof TArticle): unknown => {
  if (!value || typeof value !== 'object') return undefined
  if (isTarget(value as TArticle, path)) return (value as TArticle)[field]
  const entries = (value as { entries?: TArticle[] }).entries
  if (!Array.isArray(entries)) return undefined
  return entries.find((article) => isTarget(article, path))?.[field]
}

const readArticle = (value: unknown, path: TArticlePath): TArticle | null => {
  if (!value || typeof value !== 'object') return null
  if (isTarget(value as TArticle, path)) return value as TArticle
  const entries = (value as { entries?: TArticle[] }).entries
  if (!Array.isArray(entries)) return null
  return entries.find((article) => isTarget(article, path)) || null
}

const ARTICLE_ENTITY_QUERY_KINDS = new Set(['changelogs', 'detail', 'posts'])

const isArticleEntityQuery = (query: { queryKey: readonly unknown[] }): boolean =>
  query.queryKey[0] === articleKeys.all[0] &&
  typeof query.queryKey[1] === 'string' &&
  ARTICLE_ENTITY_QUERY_KINDS.has(query.queryKey[1])

/** Returns only loaded Query shapes that are declared owners of Article entities. */
export const articleQueryTargets = (queryClient: QueryClient): readonly TQueryTarget[] =>
  queryClient
    .getQueryCache()
    .findAll({ predicate: isArticleEntityQuery })
    .map(({ queryKey }) => ({ queryKey, exact: true }))

/** Returns loaded normalized ArticleStats entities that mutations may invalidate or reconcile. */
export const articleStatsQueryTargets = (queryClient: QueryClient): readonly TQueryTarget[] =>
  queryClient
    .getQueryCache()
    .findAll({
      predicate: ({ queryKey }) =>
        queryKey[0] === articleKeys.all[0] &&
        queryKey[1] === 'article-stats' &&
        typeof queryKey[2] === 'string' &&
        typeof queryKey[3] === 'string' &&
        typeof queryKey[4] === 'string',
    })
    .map(({ queryKey }) => ({ queryKey, exact: true }))

/** Applies an optimistic ArticleStats field patch and records its exact inverse. */
export const patchArticleStatsChanges = (
  queryClient: QueryClient,
  path: TArticlePath,
  field: keyof TArticleStats,
  updater: (stats: TArticleStats) => TArticleStats,
  context?: TOperationContext,
): TOptimisticChange[] => {
  const queryKey = articleKeys.articleStats(path.community, path.thread, path.innerId)
  const previous = queryClient.getQueryData<TArticleStats>(queryKey)
  if (!previous) return []
  const next = updater(previous)
  queryClient.setQueryData(queryKey, next)
  if (!context) return []
  return [
    {
      type: 'field',
      queryKey,
      entityKey: articleKeyFor(path),
      field: String(field),
      before: previous[field],
      optimistic: next[field],
      commandId: context.commandId,
      rollback: 'refetch',
      restore: () => queryClient.setQueryData(queryKey, previous),
    },
  ]
}

/** Applies one ArticleStats update to the canonical normalized entity cache. */
export const patchArticleStatsEverywhere = (
  queryClient: QueryClient,
  path: TArticlePath,
  updater: (stats: TArticleStats) => TArticleStats,
): void => {
  const queryKey = articleKeys.articleStats(path.community, path.thread, path.innerId)
  queryClient.setQueryData<TArticleStats>(queryKey, (current) =>
    current ? updater(current) : current,
  )
}

/** Applies a field patch to the legacy Article entity cache. Use only for non-stat fields. */
export const patchArticleChanges = (
  queryClient: QueryClient,
  path: TArticlePath,
  field: keyof TArticle,
  updater: (article: TArticle) => TArticle,
  context?: TOperationContext,
): TOptimisticChange[] => {
  const changes: TOptimisticChange[] = []
  for (const { queryKey } of articleQueryTargets(queryClient)) {
    const previous = queryClient.getQueryData(queryKey)
    const before = readField(previous, path, field)
    const next = patchData(previous, path, updater)
    if (next === previous) continue
    queryClient.setQueryData(queryKey, next)
    if (!context) continue
    changes.push({
      type: 'field',
      queryKey,
      entityKey: articleKeyFor(path),
      field: String(field),
      before,
      optimistic: readField(next, path, field),
      commandId: context.commandId,
      rollback: 'restore-if-owned',
      restore: () => {
        queryClient.setQueryData(queryKey, (current: unknown) =>
          patchData(current, path, (article) => ({ ...article, [field]: before })),
        )
      },
    })
  }
  return changes
}

/** Applies one entity update to every registered article-bearing query shape. */
export const patchArticleEverywhere = (
  queryClient: QueryClient,
  path: TArticlePath,
  updater: (article: TArticle) => TArticle,
): void => {
  for (const { queryKey } of articleQueryTargets(queryClient)) {
    queryClient.setQueryData(queryKey, (data) => patchData(data, path, updater))
  }
}

/** Reads the canonical article entity from any loaded Article Query shape. */
export const selectArticleFromCache = (
  queryClient: QueryClient,
  article: TArticle | null,
): TArticle | null => {
  if (!article) return null
  const path = articlePath(article)
  for (const { queryKey } of articleQueryTargets(queryClient)) {
    const match = readArticle(queryClient.getQueryData(queryKey), path)
    if (match) return match
  }
  return article
}
