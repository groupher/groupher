import usePageBgCommon from '~/hooks/usePageBg'
import type { TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  rawBg: string
  saving: boolean
  isTouched: boolean
  isDarkTouched: boolean
}

export default function usePageBg(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()
  const { rawBg } = usePageBgCommon()

  const { saving } = dsb$

  const lightTouched =
    isChanged('pageBg') || isChanged('pageCustomBg') || isChanged('pageCustomIntensity')
  const darkTouched =
    isChanged('pageBgDark') || isChanged('pageCustomBgDark') || isChanged('pageCustomIntensityDark')
  const isTouched = lightTouched || darkTouched
  const isDarkTouched = isTouched

  return {
    rawBg,
    edit,
    saving,
    isTouched,
    isDarkTouched,
  }
}
