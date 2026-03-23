import type { TColorName, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  subPrimaryColor: TColorName
  saving: boolean
  isTouched: boolean
}

export default function useSubPrimaryColor(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { subPrimaryColor, saving } = dsb$

  const isTouched = isChanged('subPrimaryColor')

  return {
    edit,
    subPrimaryColor,
    saving,
    isTouched,
  }
}
