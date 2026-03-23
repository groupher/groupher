import useArticleList from '~/stores/articleList/hooks'
import type { TArticleCat, TArticleFilter, TArticleOrder, TArticleState } from '~/spec'

type TRes = {
  cat: TArticleCat
  state: TArticleState
  order: TArticleOrder
  updateActiveFilter: (filter: TArticleFilter) => void
}

export default function useArticlesFilter(): TRes {
  const store = useArticleList()
  const { activeOrder: order, activeState: state, activeCat: cat, updateActiveFilter } = store

  return {
    order,
    cat,
    state,
    updateActiveFilter,
  }
}
