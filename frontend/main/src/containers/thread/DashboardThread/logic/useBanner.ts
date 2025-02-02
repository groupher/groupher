import { useCallback } from 'react'

import type { TBannerLayout, TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TBannerLayout
  getIsTouched: () => boolean
  saving: boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  const { bannerLayout, saving } = store

  // drived
  const getIsTouched = useCallback(() => isChanged('bannerLayout'), [store])

  return {
    edit,
    layout: bannerLayout,
    getIsTouched,
    saving,
  }
}
