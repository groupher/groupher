import { useCallback } from 'react'

import type { TColorName, TEditFunc } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  primaryColor: TColorName
  saving: boolean
  getIsTouched: () => boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { primaryColor, saving } = store

  // drived
  const getIsTouched = useCallback(() => isChanged('primaryColor'), [store])

  return {
    edit,
    primaryColor,
    saving,
    getIsTouched,
  }
}
