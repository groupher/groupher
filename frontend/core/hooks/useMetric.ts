'use client'

import METRIC from '~/const/metric'
import type { TMetric } from '~/spec'

type TFmt = 'default' | 'lowercase'

export default (fmt: TFmt = 'default'): TMetric => {
  let metric: TMetric

  metric = METRIC.COMMUNITY

  if (fmt === 'lowercase') {
    return metric.toLowerCase() as TMetric
  }

  return metric
}
