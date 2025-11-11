import { includes } from 'ramda'
import { COLOR_NAME } from '~/const/colors'
import { TOPBAR_LAYOUT } from '~/const/layout'
import METRIC from '~/const/metric'
import useMetric from '~/hooks/useMetric'
import useSubStore from '~/hooks/useSubStore'
import useTheme from '~/hooks/useTheme'
import type { TColorName, TTopbarLayout } from '~/spec'

type TRet = {
  hasTopbar: boolean
  topbar: TTopbarLayout
  topbarBg: TColorName
  isDarkBlack: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const metric = useMetric()
  const { isLightTheme } = useTheme()

  const hasTopbar =
    !includes(metric, [METRIC.APPLY_COMMUNITY, METRIC.LANDING]) &&
    store.topbarLayout === TOPBAR_LAYOUT.YES
  const isDarkBlack = !isLightTheme && store.topbarBg === COLOR_NAME.BLACK

  return {
    hasTopbar,
    topbar: store.topbarLayout,
    topbarBg: store.topbarBg,
    isDarkBlack,
  }
}
