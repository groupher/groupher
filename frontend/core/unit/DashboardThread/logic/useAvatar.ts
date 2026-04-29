import type { TAvatarLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
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

  const isTouched = isChanged(FIELD.AVATAR_LAYOUT)

  return {
    edit,
    layout: avatarLayout,
    isTouched,
    saving,
  }
}
