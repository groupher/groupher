import type { TBrandLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
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

  const isTouched = isChanged(FIELD.BRAND_LAYOUT)

  return {
    edit,
    layout: brandLayout,
    saving,
    isTouched,
  }
}
