import { useCallback } from 'react'

import type { TPostLayout, TEditFunc } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TPostLayout
  getIsTouched: () => boolean
  saving: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { postLayout, saving } = store

  // drived
  const getIsTouched = useCallback(() => isChanged('postLayout'), [store])

  return {
    edit,
    layout: postLayout,
    saving,
    getIsTouched,
  }
}
