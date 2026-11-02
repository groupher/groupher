import type { TArticleCat, TArticleOrder, TThread } from '~/spec'

export type TInit = {
  thread?: TThread | null
}

export type TStore = TInit & {
  activeOrder: TArticleOrder | null | undefined
  activeCat: TArticleCat | null | undefined

  updateActiveFilter: (filter: TArticleFilter) => void
  commit: (patch: Partial<TStore>) => void
}
