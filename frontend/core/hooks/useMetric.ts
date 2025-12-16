import useGeneral from '~/hooks/useGeneral'
import type { TMetric } from '~/spec'

type TFmt = 'default' | 'lowercase'

export default (fmt: TFmt = 'default'): TMetric => {
  const { metric } = useGeneral()

  if (fmt === 'lowercase') {
    return metric.toLowerCase() as TMetric
  }

  return metric
}
