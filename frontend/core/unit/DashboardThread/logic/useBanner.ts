import type { TGlobalLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TGlobalLayout
  isTouched: boolean
  saving: boolean
}

export default function useBanner(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { globalLayout, saving } = dsb$

  const isTouched = isChanged('globalLayout')

  return {
    edit,
    layout: globalLayout,
    isTouched,
    saving,
  }
}
