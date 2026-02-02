import useDashboard from '~/hooks/useDashboard'
import type { TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  darkFloat: boolean
  saving: boolean
  isTouched: boolean
  edit: TEditFunc
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const { edit, isChanged } = useHelper()

  const { darkFloat, saving } = dsb$

  return {
    darkFloat,
    saving,
    edit,
    isTouched: isChanged('darkFloat'),
  }
}
