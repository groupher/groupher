'use client'

import { usePathname } from 'next/navigation'
import { includes } from 'ramda'
import { BANNER_LAYOUT } from '~/const/layout'

import METRIC from '~/const/metric'
import { STATIC_ROUTES } from '~/const/route'
import useSubStore from '~/hooks/useSubStore'
import type { TMetric } from '~/spec'

export default (): TMetric => {
  const store = useSubStore('viewing')
  const { bannerLayout } = useSubStore('dashboard')

  const pathname = usePathname()
  if (includes(pathname, STATIC_ROUTES)) {
    return METRIC.HOME
  }

  if (store.metric === METRIC.COMMUNITY && bannerLayout === BANNER_LAYOUT.SIDEBAR) {
    return METRIC.COMMUNITY_SIDEBAR
  }

  if (store.metric === METRIC.DOC && bannerLayout === BANNER_LAYOUT.SIDEBAR) {
    return METRIC.COMMUNITY_SIDEBAR
  }

  if (store.metric === METRIC.DOC && bannerLayout === BANNER_LAYOUT.TABBER) {
    return METRIC.COMMUNITY
  }

  return store.metric as TMetric
}
