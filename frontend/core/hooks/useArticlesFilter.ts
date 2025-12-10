import useArticles from '~/hooks/useArticles'
import type { TArticleCat, TArticleFilter, TArticleOrder, TArticleState } from '~/spec'

type TRes = {
  cat: TArticleCat
  state: TArticleState
  order: TArticleOrder
  updateActiveFilter: (filter: TArticleFilter) => void
}

export default (): TRes => {
  const articles = useArticles()
  const { activeOrder: order, activeState: state, activeCat: cat, updateActiveFilter } = articles

  return {
    order,
    cat,
    state,
    updateActiveFilter,
  }
}
