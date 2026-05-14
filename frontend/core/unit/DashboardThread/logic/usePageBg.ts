import usePageBgCommon from '~/hooks/usePageBg'
import type { TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
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
    isChanged(FIELD.PAGE_BG) ||
    isChanged(FIELD.PAGE_CUSTOM_BG) ||
    isChanged(FIELD.PAGE_CUSTOM_INTENSITY)
  const darkTouched =
    isChanged(FIELD.PAGE_BG_DARK) ||
    isChanged(FIELD.PAGE_CUSTOM_BG_DARK) ||
    isChanged(FIELD.PAGE_CUSTOM_INTENSITY_DARK)
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
