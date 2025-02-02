import useTwBelt from '~/hooks/useTwBelt'

import METRIC from '~/const/metric'
import useMetric from '~/hooks/useMetric'

export default () => {
  const { cn, breakOut } = useTwBelt()
  const metric = useMetric()

  return {
    wrapper: cn(
      'column-align-both min-h-14 mt-20 pt-14 pb-8',
      breakOut(),
      metric === METRIC.HOME && 'px-32',
    ),
  }
}
