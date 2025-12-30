import METRIC from '~/const/metric'
import { THREAD } from '~/const/thread'
import useArticleList from '~/hooks/useArticleList'
import useMetric from '~/hooks/useMetric'

import type { TThread } from '~/spec'

export default (): TThread => {
  const metric = useMetric()
  if (metric === METRIC.LANDING) {
    return THREAD.POST
  }

  const articleList$ = useArticleList()

  return articleList$.thread
}
