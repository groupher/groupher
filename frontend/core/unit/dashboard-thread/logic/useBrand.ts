import useDashboard from '~/stores/dashboard/hooks'
import type { TBrandLayout, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TBrandLayout
  isTouched: boolean
  saving: boolean
}

export default function useBrand(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { brandLayout, saving } = dsb$

  const isTouched = isChanged('brandLayout')

  return {
    edit,
    layout: brandLayout,
    saving,
    isTouched,
  }
}
