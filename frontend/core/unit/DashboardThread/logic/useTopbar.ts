import type { TColorName, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  enabled: boolean
  isLayoutTouched: boolean
  isBgTouched: boolean
  saving: boolean
  bg: TColorName
}

export default function useTopbar(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { topbarEnabled, topbarBg, saving } = dsb$

  const isLayoutTouched = isChanged('topbarEnabled')
  const isBgTouched = isChanged('topbarBg')

  return {
    edit,
    enabled: topbarEnabled,
    isLayoutTouched,
    isBgTouched,
    bg: topbarBg,
    saving,
  }
}
