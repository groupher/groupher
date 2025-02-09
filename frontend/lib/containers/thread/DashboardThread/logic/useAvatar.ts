import { useCallback } from 'react'

import type { TAvatarLayout, TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TAvatarLayout
  getIsTouched: () => boolean
  saving: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { avatarLayout, saving } = store

  // drived
  const getIsTouched = useCallback(() => isChanged('avatarLayout'), [store])

  return {
    edit,
    layout: avatarLayout,
    getIsTouched,
    saving,
  }
}
