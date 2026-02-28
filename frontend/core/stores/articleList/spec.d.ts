import type {
  TArticleCat,
  TArticleOrder,
  TArticleState,
  TPagedArticles,
  TResState,
  TTag,
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

  tags?: TTag[]
  activeTag?: TTag | null
}

export type TStore = TInit & {
  activeOrder: TArticleOrder | null
  activeCat: TArticleCat | null
  activeState: TArticleState | null

  resState: TResState

  updateActiveFilter: (filter: TArticleFilter) => void
  commit: (patch: Partial<TStore>) => void
}
