import useDashboard from '~/stores/dashboard/hooks'
import type { TColorName, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  primaryColor: TColorName
  saving: boolean
  isTouched: boolean
}

export default function usePrimaryColor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { primaryColor, saving } = dsb$

  const isTouched = isChanged('primaryColor')

  return {
    edit,
    primaryColor,
    saving,
    isTouched,
  }
}
