import type { TMetric } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

type TFmt = 'default' | 'lowercase'

export default (fmt: TFmt = 'default'): TMetric => {
  const { metric } = useDsb()

  if (fmt === 'lowercase') {
    return metric.toLowerCase() as TMetric
  }

  return metric
}
