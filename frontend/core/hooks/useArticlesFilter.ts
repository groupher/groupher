import type { TArticleFilter, TArticleCat, TArticleState, TArticleOrder } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

type TRes = {
  cat: TArticleCat
  state: TArticleState
  order: TArticleOrder
  updateActiveFilter: (filter: TArticleFilter) => void
}

export default (): TRes => {
  const articles = useSubStore('articles')
  const { activeOrder: order, activeState: state, activeCat: cat, updateActiveFilter } = articles

  return {
    order,
    cat,
    state,
    updateActiveFilter,
  }
}
