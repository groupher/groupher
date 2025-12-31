import { includes } from 'ramda'
import { COLOR_NAME } from '~/const/colors'
import { TOPBAR_LAYOUT } from '~/const/layout'
import METRIC from '~/const/metric'
import useDashboard from '~/hooks/useDashboard'
import useMetric from '~/hooks/useMetric'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TTopbarLayout } from '~/spec'

type TRet = {
  hasTopbar: boolean
  topbar: TTopbarLayout
  topbarBg: TColorName
  isDarkBlack: boolean
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const metric = useMetric()
  const { isLightTheme } = useTheme()

  const hasTopbar =
    !includes(metric, [METRIC.APPLY_COMMUNITY, METRIC.LANDING]) &&
    dsb$.topbarLayout === TOPBAR_LAYOUT.YES
  const isDarkBlack = !isLightTheme && dsb$.topbarBg === COLOR_NAME.BLACK

  return {
    hasTopbar,
    topbar: dsb$.topbarLayout,
    topbarBg: dsb$.topbarBg,
    isDarkBlack,
  }
}
