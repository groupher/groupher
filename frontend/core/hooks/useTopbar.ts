import { includes } from 'ramda'
import { TOPBAR_LAYOUT } from '~/const/layout'
import METRIC from '~/const/metric'
import useDashboard from '~/hooks/useDashboard'
import useMetric from '~/hooks/useMetric'
import type { TColorName, TTopbarLayout } from '~/spec'

type TRet = {
  hasTopbar: boolean
  topbar: TTopbarLayout
  topbarBg: TColorName
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const metric = useMetric()

  const hasTopbar =
    !includes(metric, [METRIC.APPLY_COMMUNITY, METRIC.LANDING]) &&
    dsb$.topbarLayout === TOPBAR_LAYOUT.YES

  return {
    hasTopbar,
    topbar: dsb$.topbarLayout,
    topbarBg: dsb$.topbarBg,
  }
}
