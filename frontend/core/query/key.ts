/**
 * Constructs stable TanStack Query identities for shared Groupher server state.
 *
 *   normalized domain input
 *     -> domain-specific key constructor
 *     -> Query cache / invalidation / hydration lookup
 *
 * This module only constructs keys and canonicalizes key inputs. Cache matching and mutation
 * behavior remain in their owning cache or invalidation modules.
 */
import type { TPagedArticlesParams, TThread } from '~/spec'

export type TNormalizedArticleFilter = {
  community: string
  page: number
  size: number
  communityTag: string | null
  communityTags: string[]
  cat: string | null
  status: string | null
  order: string | null
  when: string | null
  sort: string | null
}

const normalizeText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

const normalizeTextList = (values: string[] | null | undefined): string[] =>
  [...new Set((values || []).map((value) => value.trim()).filter(Boolean))].sort()

/** Canonicalizes supported list filters so keys and query variables stay aligned. */
export const normalizeArticleFilter = (filter: TPagedArticlesParams): TNormalizedArticleFilter => ({
  community: (filter.community || '').trim(),
  page: filter.page && filter.page > 0 ? filter.page : 1,
  size: filter.size && filter.size > 0 ? filter.size : 20,
  communityTag: normalizeText(filter.communityTag),
  communityTags: normalizeTextList(filter.communityTags),
  cat: normalizeText(filter.cat),
  status: normalizeText(filter.status),
  order: normalizeText(filter.order),
  when: normalizeText(filter.when),
  sort: normalizeText(filter.sort),
})

/** True only for the one changelog result that the community-scoped SSR cache can represent. */
export const isCanonicalDefaultArticleFilter = (filter: TPagedArticlesParams): boolean => {
  const normalized = normalizeArticleFilter(filter)

  return (
    !!normalized.community &&
    normalized.page === 1 &&
    normalized.size === 20 &&
    normalized.communityTag === null &&
    normalized.communityTags.length === 0 &&
    normalized.cat === null &&
    normalized.status === null &&
    normalized.order === null &&
    normalized.when === null &&
    normalized.sort === null
  )
}

/** Constructors for public Article content, stats, tag, and list query identities. */
export const articleQueryKeys = {
  all: ['article'] as const,
  posts: (filter: TPagedArticlesParams) =>
    [...articleQueryKeys.all, 'posts', normalizeArticleFilter(filter)] as const,
  changelogs: (filter: TPagedArticlesParams) =>
    [...articleQueryKeys.all, 'changelogs', normalizeArticleFilter(filter)] as const,
  kanban: (community: string) => [...articleQueryKeys.all, 'kanban', community] as const,
  detail: (community: string, thread: TThread, innerId: string | number) =>
    [...articleQueryKeys.all, 'detail', community, thread, String(innerId)] as const,
  statsPrefix: (community: string, thread: TThread) =>
    [...articleQueryKeys.all, 'article-stats', community, thread] as const,
  stats: (community: string, thread: TThread, innerId: string | number) =>
    [...articleQueryKeys.statsPrefix(community, thread), String(innerId)] as const,
  statsBatch: (community: string, thread: TThread, innerIds: readonly (string | number)[]) =>
    [...articleQueryKeys.statsPrefix(community, thread), [...innerIds].map(String).sort()] as const,
  tagStats: (community: string, thread: TThread, slug: string | null | undefined) =>
    [...articleQueryKeys.all, 'tag-stats', community, thread, normalizeText(slug)] as const,
  tagGroups: (community: string, thread: TThread) =>
    [...articleQueryKeys.all, 'tag-groups', community, thread] as const,
}

/** Constructors for Comment list and reconcile query identities. */
export const commentKeys = {
  all: ['comment'] as const,
  articlePrefix: (community: string, thread: TThread, innerId: string | number) =>
    [...commentKeys.all, 'list', community, thread, String(innerId)] as const,
  list: (
    community: string,
    thread: TThread,
    innerId: string | number,
    page = 1,
    mode = 'REPLIES',
  ) => [...commentKeys.all, 'list', community, thread, String(innerId), { mode, page }] as const,
  reconcile: (
    community: string,
    thread: TThread,
    innerId: string | number,
    commentRefs: readonly string[],
  ) =>
    [
      ...commentKeys.articlePrefix(community, thread, innerId),
      'reconcile',
      [...commentRefs].sort(),
    ] as const,
  matchesArticle: (
    query: { queryKey: readonly unknown[] },
    community: string,
    thread: TThread,
    innerId: string | number,
  ): boolean => {
    const prefix = commentKeys.articlePrefix(community, thread, innerId)
    return prefix.every((part, index) => query.queryKey[index] === part)
  },
}

/** Constructors for account-scoped Article and Comment private-state query identities. */
export const viewerQueryKeys = {
  all: ['viewer'] as const,
  session: () => [...viewerQueryKeys.all, 'session'] as const,
  articleStatePrefix: (accountRef: string) =>
    [...viewerQueryKeys.all, accountRef, 'article-state'] as const,
  articleStates: (accountRef: string, articlePathKeys: readonly string[]) =>
    [...viewerQueryKeys.articleStatePrefix(accountRef), [...articlePathKeys].sort()] as const,
  articleInteractionStatePrefix: (accountRef: string) =>
    [...viewerQueryKeys.all, accountRef, 'article-interaction-state'] as const,
  articleInteractionStates: (accountRef: string, articlePathKeys: readonly string[]) =>
    [
      ...viewerQueryKeys.articleInteractionStatePrefix(accountRef),
      [...articlePathKeys].sort(),
    ] as const,
  commentStatePrefix: (accountRef: string, articleKey: string) =>
    [...viewerQueryKeys.all, accountRef, 'comment-state', articleKey] as const,
  commentStates: (accountRef: string, articleKey: string, commentInnerIds: readonly string[]) =>
    [
      ...viewerQueryKeys.commentStatePrefix(accountRef, articleKey),
      [...commentInnerIds].sort(),
    ] as const,
  commentSummary: (accountRef: string, articleKey: string) =>
    [...viewerQueryKeys.all, accountRef || 'anonymous', 'comment-summary', articleKey] as const,
}

/** Constructors for serialized optimistic mutation lanes. */
export const mutationKeys = {
  all: ['mutation'] as const,
  article: (articleKey: string, operation: string) =>
    [...mutationKeys.all, 'article', articleKey, operation] as const,
  comment: (commentKey: string, operation: string) =>
    [...mutationKeys.all, 'comment', commentKey, operation] as const,
}

/** Constructors for visitor-analysis query identities. */
export const visitorKeys = {
  all: ['visitor-location-map'] as const,
  locationMap: (community: string, locale: string) =>
    [...visitorKeys.all, community, locale] as const,
}
