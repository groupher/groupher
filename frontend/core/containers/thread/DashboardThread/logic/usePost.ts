import useDashboard from '~/hooks/useDashboard'
import type { TEditFunc, TPostLayout } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TPostLayout
  isTouched: boolean
  saving: boolean
}

export default (): TRet => {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { postLayout, saving } = dsb$

  const isTouched = isChanged('postLayout')

  return {
    edit,
    layout: postLayout,
    saving,
    isTouched,
  }
}
