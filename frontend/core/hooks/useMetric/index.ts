import useDashboard from '~/stores/dashboard/hooks'
import type { TMetric } from '~/spec'

type TFmt = 'default' | 'lowercase'

export default (fmt: TFmt = 'default'): TMetric => {
  const { metric } = useDashboard()

  if (fmt === 'lowercase') {
    return metric.toLowerCase() as TMetric
  }

  return metric
}
