import useDashboard from '~/stores/dashboard/hooks'
import usePageBgCommon from '~/hooks/usePageBg'
import type { TEditFunc } from '~/spec'

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

  const isTouched = isChanged('pageBg')
  const isDarkTouched = isChanged('pageBgDark')

  return {
    rawBg,
    edit,
    saving,
    isTouched,
    isDarkTouched,
  }
}
