import type { TMetric } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TFmt = 'default' | 'lowercase'

export default (fmt: TFmt = 'default'): TMetric => {
  const { metric } = useDashboard()

  if (fmt === 'lowercase') {
    return metric.toLowerCase() as TMetric
  }

  return metric
}
