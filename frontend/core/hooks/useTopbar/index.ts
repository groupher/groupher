'use client'

import { includes } from 'ramda'

import METRIC from '~/const/metric'
import useMetric from '~/hooks/useMetric'
import type { TColorName } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TRet = {
  hasTopbar: boolean
  topbarEnabled: boolean
  topbarBg: TColorName
}

export default function useTopbar(): TRet {
  const dsb$ = useDashboard()
  const metric = useMetric()

  const hasTopbar =
    !includes(metric, [METRIC.APPLY_COMMUNITY, METRIC.LANDING]) && dsb$.topbarEnabled

  return {
    hasTopbar,
    topbarEnabled: dsb$.topbarEnabled,
    topbarBg: dsb$.topbarBg,
  }
}
