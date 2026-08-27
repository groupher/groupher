import type { TAvatarLayout, TEditFunc } from '~/spec'
import useDsb from '~/stores/dsb/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TAvatarLayout
  isTouched: boolean
  saving: boolean
}

/** Exposes avatar state and actions through the shared React hook boundary. */
export default function useAvatar(): TRet {
  const dsb$ = useDsb()
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
