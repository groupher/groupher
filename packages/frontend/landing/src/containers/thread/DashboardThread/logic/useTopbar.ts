import { useCallback } from 'react'

import type { TTopbarLayout, TColorName, TEditFunc } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  layout: TTopbarLayout
  getIsLayoutTouched: () => boolean
  getIsBgTouched: () => boolean
  saving: boolean
  bg: TColorName
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  if (store === null) {
    throw new Error('Store cannot be null, please add a context provider')
  }

  const { topbarLayout, topbarBg, saving } = store

  // drived
  const getIsLayoutTouched = useCallback(() => isChanged('topbarLayout'), [store])
  const getIsBgTouched = useCallback(() => isChanged('topbarBg'), [store])

  return {
    edit,
    layout: topbarLayout,
    getIsLayoutTouched,
    getIsBgTouched,
    bg: topbarBg,
    saving,
  }
}
