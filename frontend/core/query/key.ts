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
  tagStats: (community: string, thread: TThread, slug: string | null | undefined) =>
    [...articleKeys.all, 'tag-stats', community, thread, normalizeText(slug)] as const,
  tagGroups: (community: string, thread: TThread) =>
    [...articleKeys.all, 'tag-groups', community, thread] as const,
}

export const commentKeys = {
  all: ['comment'] as const,
  list: (
    community: string,
    thread: TThread,
    innerId: string | number,
    page = 1,
    mode = 'REPLIES',
  ) => [...commentKeys.all, 'list', community, thread, String(innerId), { mode, page }] as const,
}

export const viewerKeys = {
  all: ['viewer'] as const,
  articleStates: (viewerScope: string, articleKeys: readonly string[]) =>
    [...viewerKeys.all, viewerScope, 'article-state', [...articleKeys].sort()] as const,
  articleState: (viewerScope: string, articleKey: string) =>
    [...viewerKeys.all, viewerScope, 'article-detail-state', articleKey] as const,
  commentStates: (viewerScope: string, articleKey: string, page: number, mode: string) =>
    [...viewerKeys.all, viewerScope, 'comment-state', articleKey, { mode, page }] as const,
  commentSummary: (viewerScope: string, articleKey: string) =>
    [...viewerKeys.all, viewerScope || 'anonymous', 'comment-summary', articleKey] as const,
}

export const mutationKeys = {
  all: ['mutation'] as const,
  article: (articleKey: string, operation: string) =>
    [...mutationKeys.all, 'article', articleKey, operation] as const,
  comment: (commentKey: string, operation: string) =>
    [...mutationKeys.all, 'comment', commentKey, operation] as const,
}
