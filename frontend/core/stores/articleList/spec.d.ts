import type { TArticleCat, TArticleOrder, TArticleStatus, TThread } from '~/spec'

export type TInit = {
  thread?: TThread | null
}

export type TStore = TInit & {
  activeOrder: TArticleOrder | null
  activeCat: TArticleCat | null
  activeStatus: TArticleStatus | null

  updateActiveFilter: (filter: TArticleFilter) => void
  commit: (patch: Partial<TStore>) => void
}
