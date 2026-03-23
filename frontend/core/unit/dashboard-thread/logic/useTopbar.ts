import type { TColorName, TEditFunc, TTopbarLayout } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TTopbarLayout
  isLayoutTouched: boolean
  isBgTouched: boolean
  saving: boolean
  bg: TColorName
}

export default function useTopbar(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { topbarLayout, topbarBg, saving } = dsb$

  const isLayoutTouched = isChanged('topbarLayout')
  const isBgTouched = isChanged('topbarBg')

  return {
    edit,
    layout: topbarLayout,
    isLayoutTouched,
    isBgTouched,
    bg: topbarBg,
    saving,
  }
}
