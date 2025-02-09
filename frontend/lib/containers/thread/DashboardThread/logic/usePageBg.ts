import { useCallback } from 'react'

import type { TEditFunc } from '~/spec'

import usePageBgCommon from '~/hooks/usePageBg'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  rawBg: string
  saving: boolean
  getIsTouched: () => boolean
  getIsDarkTouched: () => boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()
  const { rawBg } = usePageBgCommon()

  const { saving } = store

  // drived
  const getIsTouched = useCallback(() => isChanged('pageBg'), [store])
  const getIsDarkTouched = useCallback(() => isChanged('pageBgDark'), [store])

  return {
    rawBg,
    edit,
    saving,
    getIsTouched,
    getIsDarkTouched,
  }
}
