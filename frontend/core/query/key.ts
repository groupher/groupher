import { THREAD } from '~/const/thread'
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

export const articleKeys = {
  all: ['article'] as const,
  posts: (filter: TPagedArticlesParams) =>
    [...articleKeys.all, 'posts', normalizeArticleFilter(filter)] as const,
  changelogs: (filter: TPagedArticlesParams) =>
    [...articleKeys.all, 'changelogs', normalizeArticleFilter(filter)] as const,
  kanban: (community: string) => [...articleKeys.all, 'kanban', community] as const,
  detail: (community: string, thread: TThread, innerId: string | number) =>
    [...articleKeys.all, 'detail', community, thread, String(innerId)] as const,
  statsPrefix: (community: string, thread: TThread) =>
    [...articleKeys.all, 'article-stats', community, thread] as const,
  stats: (community: string, thread: TThread, innerId: string | number) =>
    [...articleKeys.statsPrefix(community, thread), String(innerId)] as const,
  statsBatch: (community: string, thread: TThread, innerIds: readonly (string | number)[]) =>
    [...articleKeys.statsPrefix(community, thread), [...innerIds].map(String).sort()] as const,
  tagStats: (community: string, thread: TThread, slug: string | null | undefined) =>
    [...articleKeys.all, 'tag-stats', community, thread, normalizeText(slug)] as const,
  tagGroups: (community: string, thread: TThread) =>
    [...articleKeys.all, 'tag-groups', community, thread] as const,
  isArticleEntity: (queryKey: readonly unknown[]): boolean =>
    queryKey[0] === articleKeys.all[0] &&
    typeof queryKey[1] === 'string' &&
    ['changelogs', 'detail', 'posts'].includes(queryKey[1]),
  isStats: (queryKey: readonly unknown[]): boolean =>
    queryKey[0] === articleKeys.all[0] &&
    queryKey[1] === 'article-stats' &&
    typeof queryKey[2] === 'string' &&
    typeof queryKey[3] === 'string' &&
    typeof queryKey[4] === 'string',
  isStatsBatch: (queryKey: readonly unknown[]): boolean =>
    queryKey[0] === articleKeys.all[0] &&
    queryKey[1] === 'article-stats' &&
    typeof queryKey[2] === 'string' &&
    typeof queryKey[3] === 'string' &&
    Array.isArray(queryKey[4]),
  matchesStatsBatch: (
    queryKey: readonly unknown[],
    community: string,
    thread: TThread,
    innerId: string | number,
  ): boolean =>
    articleKeys.isStatsBatch(queryKey) &&
    queryKey[2] === community &&
    queryKey[3] === thread &&
    (queryKey[4] as unknown[]).map(String).includes(String(innerId)),
  matchesStatsBatchScope: (
    queryKey: readonly unknown[],
    community: string,
    thread: TThread,
  ): boolean =>
    articleKeys.isStatsBatch(queryKey) && queryKey[2] === community && queryKey[3] === thread,
  matchesArticleList: (
    queryKey: readonly unknown[],
    community: string,
    thread?: TThread,
  ): boolean => {
    const family = queryKey[1]
    const filter = queryKey[2]
    if (
      queryKey[0] !== articleKeys.all[0] ||
      !['posts', 'changelogs'].includes(String(family)) ||
      !filter ||
      typeof filter !== 'object'
    ) {
      return false
    }

    if ((filter as TNormalizedArticleFilter).community !== community) return false
    if (!thread) return true
    return thread === THREAD.CHANGELOG ? family === 'changelogs' : family === 'posts'
  },
}

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

export const viewerKeys = {
  all: ['viewer'] as const,
  session: () => [...viewerKeys.all, 'session'] as const,
  articleStatePrefix: (accountRef: string) =>
    [...viewerKeys.all, accountRef, 'article-state'] as const,
  articleStates: (accountRef: string, articleKeys: readonly string[]) =>
    [...viewerKeys.articleStatePrefix(accountRef), [...articleKeys].sort()] as const,
  matchesArticleState: (query: { queryKey: readonly unknown[] }, articleKey: string): boolean => {
    const [domain, _accountRef, target, articleKeys] = query.queryKey
    return (
      domain === viewerKeys.all[0] &&
      target === 'article-state' &&
      Array.isArray(articleKeys) &&
      articleKeys.includes(articleKey)
    )
  },
  articleInteractionStates: (accountRef: string, articleKeys: readonly string[]) =>
    [...viewerKeys.all, accountRef, 'article-interaction-state', [...articleKeys].sort()] as const,
  commentStatePrefix: (accountRef: string, articleKey: string) =>
    [...viewerKeys.all, accountRef, 'comment-state', articleKey] as const,
  commentStates: (accountRef: string, articleKey: string, commentInnerIds: readonly string[]) =>
    [
      ...viewerKeys.commentStatePrefix(accountRef, articleKey),
      [...commentInnerIds].sort(),
    ] as const,
  commentSummary: (accountRef: string, articleKey: string) =>
    [...viewerKeys.all, accountRef || 'anonymous', 'comment-summary', articleKey] as const,
}

export const mutationKeys = {
  all: ['mutation'] as const,
  article: (articleKey: string, operation: string) =>
    [...mutationKeys.all, 'article', articleKey, operation] as const,
  comment: (commentKey: string, operation: string) =>
    [...mutationKeys.all, 'comment', commentKey, operation] as const,
}

export const visitorKeys = {
  all: ['visitor-location-map'] as const,
  locationMap: (community: string, locale: string) =>
    [...visitorKeys.all, community, locale] as const,
}
