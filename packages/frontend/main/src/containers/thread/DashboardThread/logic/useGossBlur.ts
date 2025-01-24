import { useCallback } from 'react'
import { pick } from 'ramda'

import type { TEditFunc } from '~/spec'
import useSubStore from '~/hooks/useSubStore'

import useHelper from './useHelper'

type TRet = {
  edit: TEditFunc
  gossBlur: number
  gossBlurDark: number
  saving: boolean
  getIsTouched: () => boolean
  getIsDarkTouched: () => boolean
}

export default (): TRet => {
  const store = useSubStore('dashboard')
  const { isChanged, edit } = useHelper()

  // drived
  const getIsTouched = useCallback(() => isChanged('gossBlur'), [store])
  const getIsDarkTouched = useCallback(() => isChanged('gossBlurDark'), [store])

  return {
    edit,
    ...pick(['gossBlur', 'gossBlurDark', 'saving'], store),
    getIsTouched,
    getIsDarkTouched,
  }
}
