'use client'

import { usePathname } from 'next/navigation'
import { includes } from 'ramda'
import { BANNER_LAYOUT } from '~/const/layout'

import METRIC from '~/const/metric'
import { STATIC_ROUTES } from '~/const/route'
import useDashboard from '~/hooks/useDashboard'
import useSubStore from '~/hooks/useSubStore'
import type { TMetric } from '~/spec'

type TFmt = 'default' | 'lowercase'

export default (fmt: TFmt = 'default'): TMetric => {
  const store = useSubStore('viewing')
  const { bannerLayout } = useDashboard()

  const pathname = usePathname()

  let metric: TMetric

  if (includes(pathname, STATIC_ROUTES)) {
    metric = METRIC.LANDING
  } else if (store.metric === METRIC.COMMUNITY && bannerLayout === BANNER_LAYOUT.SIDEBAR) {
    metric = METRIC.COMMUNITY_SIDEBAR
  } else if (store.metric === METRIC.DOC && bannerLayout === BANNER_LAYOUT.SIDEBAR) {
    metric = METRIC.COMMUNITY_SIDEBAR
  } else if (store.metric === METRIC.DOC && bannerLayout === BANNER_LAYOUT.TABBER) {
    metric = METRIC.COMMUNITY
  } else {
    metric = store.metric as TMetric
  }

  if (fmt === 'lowercase') {
    return metric.toLowerCase() as TMetric
  }

  return metric
}
