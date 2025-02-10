import type {
  TAccount,
  TCommunity,
  TUser,
  TPagedArticles,
  TArticleOrder,
  TArticleCat,
  TArticleState,
  TResState,
} from '~/spec'

export type TInit = {
  pagedPosts?: TPagedArticles
  pagedChangelogs?: TPagedArticles

  // kanban's
  todo?: TPagedArticles
  wip?: TPagedArticles
  done?: TPagedArticles
}
export type TStore = TInit & {
  activeOrder: TArticleOrder | null
  activeCat: TArticleCat | null
  activeState: TArticleState | null

  resState: TResState

  updateActiveFilter: (filter: TArticleFilter) => void
  commit: (patch: Partial<TStore>) => void
}
