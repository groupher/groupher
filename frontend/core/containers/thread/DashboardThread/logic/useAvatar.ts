import useDashboard from '~/hooks/useDashboard'
import type { TAvatarLayout, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TAvatarLayout
  isTouched: boolean
  saving: boolean
}

export default (): TRet => {
  const store = useDashboard()
  const { isChanged, edit } = useHelper()

  const { avatarLayout, saving } = store

  const isTouched = isChanged('avatarLayout')

  return {
    edit,
    layout: avatarLayout,
    isTouched,
    saving,
  }
}
