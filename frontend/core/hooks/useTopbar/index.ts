import { includes } from 'ramda'
import { TOPBAR_LAYOUT } from '~/const/layout'
import METRIC from '~/const/metric'
import useMetric from '~/hooks/useMetric'
import type { TColorName, TTopbarLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TRet = {
  hasTopbar: boolean
  topbar: TTopbarLayout
  topbarBg: TColorName
}

export default function useTopbar(): TRet {
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
