import type {
  TArticleCat,
  TArticleOrder,
  TArticleStatus,
  TPagedArticles,
  TResState,
  TTag,
  TTagGroup,
  TTagStats,
  TThread,
} from '~/spec'

export type TInit = {
  thread?: TThread | null
  pagedPosts?: TPagedArticles
  pagedChangelogs?: TPagedArticles

  // kanban's
  backlog?: TPagedArticles
  todo?: TPagedArticles
  wip?: TPagedArticles
  done?: TPagedArticles
  rejected?: TPagedArticles

  tagGroups?: TTagGroup[]
  activeTag?: TTag | null
  activeTagStats?: TTagStats | null
}

export type TStore = TInit & {
  activeOrder: TArticleOrder | null
  activeCat: TArticleCat | null
  activeStatus: TArticleStatus | null

  resState: TResState

  updateActiveFilter: (filter: TArticleFilter) => void
  commit: (patch: Partial<TStore>) => void
}
