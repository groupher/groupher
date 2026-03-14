import useDashboard from '~/hooks/useDashboard'
import type { TAvatarLayout, TEditFunc } from '~/spec'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TAvatarLayout
  isTouched: boolean
  saving: boolean
}

export default function useAvatar(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const { avatarLayout, saving } = dsb$

  const isTouched = isChanged('avatarLayout')

  return {
    edit,
    layout: avatarLayout,
    isTouched,
    saving,
  }
}
