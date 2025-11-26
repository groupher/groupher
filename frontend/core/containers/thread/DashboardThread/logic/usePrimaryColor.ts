import useDashboard from '~/hooks/useDashboard'
import type { TColorName, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  primaryColor: TColorName
  saving: boolean
  isTouched: boolean
}

export default (): TRet => {
  const store = useDashboard()
  const { isChanged, edit } = useHelper()

  const { primaryColor, saving } = store

  const isTouched = isChanged('primaryColor')

  return {
    edit,
    primaryColor,
    saving,
    isTouched,
  }
}
