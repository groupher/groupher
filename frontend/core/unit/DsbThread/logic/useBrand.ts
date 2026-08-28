import type { TBrandLayout, TEditFunc } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TBrandLayout
  isTouched: boolean
  saving: boolean
}

/** Exposes brand state and actions through the shared React hook boundary. */
export default function useBrand(): TRet {
  const dsb$ = useDsb()
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
